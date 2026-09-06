// Optional real PostgreSQL-engine checks, without a server or production DB.
// BROADCAST_TEST_PGLITE_MODULE points to a temporary @electric-sql/pglite install.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
  createZaloAnnouncementRepository,
  ensureZaloAnnouncementTables,
} = require('./zalo-announcements');
const {
  createZaloAnnouncementService,
} = require('../services/zalo-announcement-service');
const {
  createApiZaloAnnouncementRepository,
} = require('../../runtime/repositories/api-zalo-announcement-repository');
const {
  createZaloBroadcastService,
  sourceIdentity,
} = require('../../platforms/zalo/broadcast-service');
const {
  createZaloWebhookApplication,
} = require('../../runtime/create-zalo-webhook-application');
const {
  createZaloBroadcastCommand,
} = require('../../core/use-cases/common/zalo-broadcast-command');
const { startBotRuntime } = require('../../runtime/start-bot');
const {
  createTelegramPermissionPolicy,
} = require('../../platforms/telegram/permission-policy');

const context = {
  actor: { platform: 'telegram', externalId: '11' },
  conversation: { externalId: 'source', threadId: '7' },
};
const source = sourceIdentity(context);

test(
  'broadcast PostgreSQL integration',
  { skip: !process.env.BROADCAST_TEST_PGLITE_MODULE, timeout: 60000 },
  async t => {
    const { PGlite } = require(process.env.BROADCAST_TEST_PGLITE_MODULE);
    const pg = new PGlite();
    t.after(() => pg.close());
    const database = {
      async query(sql, values) {
        if (!values) {
          await pg.exec(sql);
          return { rows: [], rowCount: 0 };
        }
        const result = await pg.query(sql, values);
        return { ...result, rowCount: result.affectedRows };
      },
    };
    await ensureZaloAnnouncementTables(database);
    const repository = createZaloAnnouncementRepository({ database });
    const api = createZaloAnnouncementService({ repository });
    const remote = createApiZaloAnnouncementRepository({
      request: async (path, options) =>
        api[path.split('/').at(-1)](options.body),
    });
    const reset = () =>
      pg.exec(
        'TRUNCATE zalo_announcement_deliveries, zalo_announcements, zalo_announcement_subscriptions'
      );
    const subscribe = (chatId, userId = chatId) =>
      remote.subscribe({ chatId, userId, chatType: 'private' });
    const draft = () =>
      remote.prepare({ ...source, message: 'Hello subscribers' });

    await t.test(
      'subscription upserts deduplicate users and preserve opt-out',
      async () => {
        await reset();
        await subscribe('a');
        await subscribe('a');
        await subscribe('new-a', 'a');
        await remote.unsubscribe({
          chatId: 'new-a',
          userId: 'a',
          chatType: 'private',
        });
        const rows = (
          await pg.query('SELECT * FROM zalo_announcement_subscriptions')
        ).rows;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].chat_id, 'new-a');
        assert.equal(rows[0].subscribed, false);
        assert.equal((await draft()).total, 0);
      }
    );

    await t.test(
      'only the original admin/chat/topic can confirm, once, before expiry',
      async () => {
        await reset();
        await subscribe('a');
        const d = await draft();
        for (const other of [
          { actorId: '22' },
          { sourceChatId: 'other' },
          { sourceThreadId: '8' },
        ]) {
          assert.equal(
            await remote.claim({ id: d.id, ...source, ...other }),
            null
          );
          assert.equal(
            await remote.cancel({ id: d.id, ...source, ...other }),
            false
          );
          assert.equal(
            await remote.status({ id: d.id, ...source, ...other }),
            null
          );
        }
        const results = await Promise.all([
          remote.claim({ id: d.id, ...source }),
          remote.claim({ id: d.id, ...source }),
        ]);
        assert.equal(results.filter(Boolean).length, 1);
        const expired = await draft();
        await pg.query(
          "UPDATE zalo_announcements SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1",
          [expired.id]
        );
        assert.equal(await remote.claim({ id: expired.id, ...source }), null);
        const cancelled = await draft();
        assert.equal(
          await remote.cancel({ id: cancelled.id, ...source }),
          true
        );
        assert.equal(await remote.claim({ id: cancelled.id, ...source }), null);
      }
    );

    await t.test(
      'preview snapshots recipients and dispatch rechecks later opt-outs',
      async () => {
        await reset();
        await subscribe('a');
        await subscribe('b');
        const d = await draft();
        assert.equal(d.total, 2);
        await remote.unsubscribe({
          chatId: 'b',
          userId: 'b',
          chatType: 'private',
        });
        await subscribe('c');
        await remote.claim({ id: d.id, ...source });
        assert.deepEqual(await remote.next({ id: d.id }), { chatId: 'a' });
        assert.equal(
          await remote.record({ id: d.id, chatId: 'a', status: 'sent' }),
          true
        );
        assert.equal(
          await remote.record({
            id: d.id,
            chatId: 'a',
            status: 'failed',
            errorCode: 'API_ERROR',
          }),
          false
        );
        assert.equal(await remote.next({ id: d.id }), null);
        await remote.finish({ id: d.id });
        assert.deepEqual(await remote.status({ id: d.id, ...source }), {
          id: d.id,
          status: 'finished',
          total: 2,
          sent: 1,
          failed: 0,
          uncertain: 0,
          pending: 0,
          skipped: 1,
        });
      }
    );

    await t.test(
      'progress survives runtime replacement and an uncertain send is not retried',
      async () => {
        await reset();
        await subscribe('a');
        await subscribe('b');
        const d = await draft();
        await remote.claim({ id: d.id, ...source });
        await remote.next({ id: d.id }); // Simulate process death after dispatch claim.
        const replacement = createZaloAnnouncementRepository({ database });
        const report = await replacement.status({ id: d.id, ...source });
        assert.equal(report.uncertain, 1);
        assert.equal(report.pending, 1);
        const service = createZaloBroadcastService({
          repository: remote,
          client: {
            getMe: async () => ({}),
            sendMessage: async () => {
              throw new Error('Must not resend');
            },
          },
        });
        assert.equal(
          (await service.confirm(d.id, context)).code,
          'UNAVAILABLE'
        );
      }
    );

    await t.test(
      'Zalo subscribe -> Telegram preview -> confirm -> recipient sends -> status',
      async () => {
        await reset();
        const zalo = new EventEmitter();
        const sent = [];
        zalo.sendMessage = async (chat, text) => {
          sent.push({ chat, text });
          return { message_id: 'sent' };
        };
        zalo.getMe = async () => ({});
        const noMatchState = {
          load: async () => {
            throw new Error('Unexpected match read');
          },
          save: async () => {
            throw new Error('Unexpected match write');
          },
        };
        const app = createZaloWebhookApplication({
          client: zalo,
          secretToken: 'test-secret',
          subscriptionRepository: remote,
          stateRepository: noMatchState,
          eventRepository: {
            claim: async () => ({ state: 'claimed', claimId: 'claim' }),
            complete: async () => true,
            release: async () => true,
          },
        });
        t.after(() => app.stop());
        async function receive(
          chat,
          command,
          chatType = 'PRIVATE',
          secret = 'test-secret'
        ) {
          return app.handleWebhook({
            headers: { 'X-Bot-Api-Secret-Token': secret },
            body: {
              ok: true,
              result: {
                event_name: 'message.text.received',
                message: {
                  message_id: `${chat}-${command}`,
                  text: command,
                  from: { id: chat },
                  chat: { id: chat, chat_type: chatType },
                },
              },
            },
          });
        }
        assert.equal(
          (await receive('forged', '/subscribe', 'PRIVATE', 'wrong-secret'))
            .statusCode,
          403
        );
        await receive('group', '/subscribe', 'GROUP');
        await receive('a', '/subscribe');
        await receive('b', '/subscribe');
        const before = sent.length;
        const telegram = new EventEmitter();
        const replies = [];
        telegram.sendMessage = async (chat, text) =>
          replies.push({ chat, text });
        const service = createZaloBroadcastService({
          repository: remote,
          client: zalo,
          sendIntervalMs: 0,
        });
        const runtime = startBotRuntime({
          bot: telegram,
          stateRepository: noMatchState,
          permissionPolicy: createTelegramPermissionPolicy({
            env: { BOT_OWNER_ID: '11' },
          }),
          definitions: [createZaloBroadcastCommand({ service })],
        });
        t.after(() => runtime.stop());
        const event = text => ({
          from: { id: '11' },
          chat: { id: 'source' },
          message_thread_id: '7',
          text,
        });
        await runtime.adapter.handleEvent(event('/zalosay Hello subscribers'));
        assert.equal(sent.length, before);
        const id = replies
          .at(-1)
          .text.match(/\/zalosay confirm ([a-f0-9-]+)/)[1];
        await receive('b', '/unsubscribe');
        const afterOptOut = sent.length;
        await runtime.adapter.handleEvent(event(`/zalosay confirm ${id}`));
        assert.deepEqual(sent.slice(afterOptOut), [
          { chat: 'a', text: 'Hello subscribers' },
        ]);
        assert.match(replies.at(-1).text, /Đã gửi: 1/);
        assert.match(replies.at(-1).text, /hủy đăng ký: 1/);
        await runtime.adapter.handleEvent(event(`/zalosay confirm ${id}`));
        assert.equal(sent.length, afterOptOut + 1);
        await runtime.adapter.handleEvent(event(`/zalosay status ${id}`));
        assert.match(replies.at(-1).text, /Đã gửi: 1/);
      }
    );

    await t.test(
      'public SQL roles cannot read recipients, drafts, or delivery records',
      async () => {
        await pg.exec(
          'CREATE ROLE announcement_public_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO announcement_public_reader; SET ROLE announcement_public_reader'
        );
        try {
          for (const table of [
            'zalo_announcement_subscriptions',
            'zalo_announcements',
            'zalo_announcement_deliveries',
          ]) {
            assert.equal(
              (await pg.query(`SELECT * FROM ${table}`)).rows.length,
              0
            );
          }
        } finally {
          await pg.exec('RESET ROLE');
        }
      }
    );
  }
);
