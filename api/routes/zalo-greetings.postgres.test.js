const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createZaloGreetingRepository } = require('./zalo-greetings');
const {
  createZaloGreetingService,
} = require('../services/zalo-greeting-service');
const {
  createApiZaloGreetingRepository,
} = require('../../runtime/repositories/api-zalo-greeting-repository');
const {
  createZaloWebhookApplication,
} = require('../../runtime/create-zalo-webhook-application');
const { ZaloBotClient } = require('../../platforms/zalo/client');

test(
  'Zalo greetings persist across messages and runtime restarts',
  { skip: !process.env.BROADCAST_TEST_PGLITE_MODULE },
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
    const createRemote = () => {
      const service = createZaloGreetingService({
        repository: createZaloGreetingRepository({ database }),
      });
      return createApiZaloGreetingRepository({
        request: async (path, options) => service.claim(options.body),
      });
    };
    const remote = createRemote();
    const calls = [];
    const client = new EventEmitter();
    client.sendMessage = async (chatId, text) => calls.push({ chatId, text });
    let subscriptions = 0;
    const createApp = (greetingRepository = createRemote()) =>
      createZaloWebhookApplication({
        client,
        secretToken: 'test-secret',
        greetingRepository,
        subscriptionRepository: {
          refreshSubscriber: async () => ({}),
          subscribe: async () => {
            subscriptions += 1;
          },
          unsubscribe: async () => ({}),
        },
        stateRepository: {
          load: async () => {
            throw new Error('Unexpected match read');
          },
          save: async () => {
            throw new Error('Unexpected match write');
          },
        },
        eventRepository: {
          claim: async () => ({ state: 'claimed', claimId: 'claim' }),
          complete: async () => true,
          release: async () => true,
        },
        onError: () => {},
      });
    const apps = [];
    const newApp = repository => {
      const app = createApp(repository);
      apps.push(app);
      return app;
    };
    t.after(() => apps.forEach(app => app.stop()));
    let messageId = 0;
    const update = (userId, text, overrides = {}) => ({
      ok: true,
      result: {
        event_name: 'message.text.received',
        message: {
          message_id: String(++messageId),
          text,
          from: { id: userId, display_name: 'Nghĩa' },
          chat: { id: userId, chat_type: 'PRIVATE' },
        },
        ...overrides,
      },
    });
    const receive = (app, body, secret = 'test-secret') =>
      app.handleWebhook({
        headers: { 'X-Bot-Api-Secret-Token': secret },
        body,
      });

    await t.test(
      'only one instance claims a user and another repository cannot reclaim them',
      async () => {
        const identity = {
          userId: 'race',
          chatId: 'race',
          chatType: 'private',
        };
        const claimed = await Promise.all([
          remote.claim(identity),
          createRemote().claim(identity),
        ]);
        assert.equal(claimed.filter(Boolean).length, 1);
        assert.equal(await createRemote().claim(identity), false);
      }
    );

    await t.test(
      'first chat greets, repeats and restarts stay quiet, /start always greets',
      async () => {
        const app = newApp();
        const first = update('first-user', 'hi');
        assert.equal(
          (await receive(app, first, 'wrong-secret')).statusCode,
          403
        );
        assert.equal(calls.length, 0);
        await receive(app, first);
        assert.equal(calls.length, 1);
        assert.match(calls[0].text, /^👋 Chào Nghĩa! Đây là bot ChiaTeam/);
        assert.match(
          calls[0].text,
          /\/subscribe.*\n\/poll.*\n\/team.*\n\/start/
        );
        await receive(app, first);
        await receive(app, update('first-user', 'hello again'));
        const restarted = newApp();
        await receive(restarted, update('first-user', 'hello after restart'));
        assert.equal(calls.length, 1);
        await receive(restarted, update('first-user', '/start'));
        await receive(restarted, update('first-user', '/start'));
        assert.equal(calls.length, 3);
        assert.match(calls.at(-1).text, /Chào Nghĩa/);
        assert.match(calls.at(-1).text, /\/demvote/);
        assert.doesNotMatch(calls.at(-1).text, /\/zalosay|\/say/);
        assert.equal(subscriptions, 0);
      }
    );

    await t.test(
      'first /start replies once and another first command still runs',
      async () => {
        const app = newApp();
        const before = calls.length;
        const start = update('start-user', '/start');
        delete start.result.message.from.display_name;
        await receive(app, start);
        assert.equal(calls.length, before + 1);
        assert.match(calls.at(-1).text, /Chào bạn!/);
        await receive(app, update('start-user', 'hello'));
        assert.equal(calls.length, before + 1);
        await receive(app, update('subscribe-user', '/subscribe'));
        assert.equal(calls.length, before + 3);
        assert.match(calls.at(-2).text, /Chào Nghĩa/);
        assert.match(calls.at(-1).text, /Đã đăng ký/);
        assert.equal(subscriptions, 1);
      }
    );

    await t.test(
      'media greets without running captions, groups and bot messages stay quiet',
      async () => {
        const app = newApp();
        const before = calls.length;
        for (const type of ['image', 'sticker', 'voice']) {
          const media = update(`media-${type}`, '/subscribe', {
            event_name: `message.${type}.received`,
          });
          await receive(app, media);
        }
        assert.equal(calls.length, before + 3);
        assert.equal(subscriptions, 1);
        for (const kind of ['group', 'bot']) {
          const body = update(kind, 'hi');
          if (kind === 'group') body.result.message.chat.chat_type = 'GROUP';
          else body.result.message.from.is_bot = true;
          await receive(app, body);
        }
        assert.equal(calls.length, before + 3);
        assert.equal(
          (
            await pg.query(
              'SELECT user_id FROM zalo_greetings WHERE user_id = ANY($1::text[])',
              [['group', 'bot']]
            )
          ).rows.length,
          0
        );
      }
    );

    await t.test(
      'polling forwards first media messages to the same greeting logic',
      async () => {
        const app = newApp();
        const polling = new ZaloBotClient({
          token: 'test-token',
          fetcher: async () => {
            throw new Error('Unexpected network call');
          },
        });
        let handled;
        polling.on('message', message => {
          handled = app.runtime.adapter.handleUpdate(message);
        });
        const before = calls.length;
        const media = update('polling-user', undefined, {
          event_name: 'message.image.received',
        });
        polling.processUpdate(media);
        await handled;
        assert.equal(calls.length, before + 1);
        assert.match(calls.at(-1).text, /Chào Nghĩa/);
      }
    );

    await t.test(
      'database outages cannot stop /start or commands',
      async () => {
        const app = newApp({
          claim: async () => {
            throw new Error('database-secret');
          },
        });
        const before = calls.length;
        await receive(app, update('outage', '/start'));
        await receive(app, update('outage', '/subscribe'));
        assert.equal(calls.length, before + 2);
        assert.match(calls.at(-2).text, /Chào Nghĩa/);
        assert.match(calls.at(-1).text, /Đã đăng ký/);
        assert.doesNotMatch(JSON.stringify(calls), /database-secret/);
      }
    );

    await t.test(
      'public SQL roles cannot read greeting identities',
      async () => {
        await pg.exec(
          'CREATE ROLE greeting_reader; GRANT SELECT ON zalo_greetings TO greeting_reader; SET ROLE greeting_reader'
        );
        try {
          assert.deepEqual(
            (await pg.query('SELECT * FROM zalo_greetings')).rows,
            []
          );
        } finally {
          await pg.exec('RESET ROLE');
        }
      }
    );
  }
);
