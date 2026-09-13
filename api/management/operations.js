const { createZaloBotClient } = require('../../platforms/zalo/client');
const {
  createZaloAnnouncementRepository,
} = require('../routes/zalo-announcements');
const {
  createZaloAnnouncementService,
} = require('../services/zalo-announcement-service');

const ACTIONS = new Set([
  'webhook-info',
  'webhook-register',
  'webhook-remove',
  'subscribers',
  'subscriber-remove',
  'announcement-preview',
  'announcement-send',
  'announcement-status',
]);
const requireConfirm = body => body?.confirm === true;
const safeId = value =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 256 &&
  !/[\s]/.test(value);
const MANAGEMENT_SOURCE = Object.freeze({
  platform: 'telegram',
  sourceChatId: 'management',
  sourceThreadId: '',
});
const unwrap = value =>
  value?.ok === false
    ? null
    : value?.result === undefined
      ? value
      : value.result;
function safeWebhookInfo(result, mode = 'webhook') {
  const value = unwrap(result) || {};
  return {
    url: typeof value.url === 'string' ? value.url : '',
    mode,
    registrationStatus: value.url ? 'registered' : 'not_registered',
    pendingUpdateCount: Number.isInteger(value.pending_update_count)
      ? value.pending_update_count
      : 0,
  };
}
function withTimeout(promise, milliseconds) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error('SEND_TIMEOUT'), { code: 'SEND_TIMEOUT' })
        ),
      milliseconds
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function defaultZalo(env, fetchImpl) {
  const token = String(env.ZALO_BOT_TOKEN || '').trim();
  return createZaloBotClient({
    token,
    fetcher: (url, options = {}) =>
      fetchImpl(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.any([
          AbortSignal.timeout(8000),
          ...(options.signal ? [options.signal] : []),
        ]),
      }),
  });
}

async function runManagementOperation(
  action,
  body = {},
  {
    env = process.env,
    actor = {},
    fetchImpl = globalThis.fetch,
    providers = {},
    repository,
    announcementService,
    quiesce,
  } = {}
) {
  if (!ACTIONS.has(action)) return { ok: false, code: 'UNKNOWN_OPERATION' };
  const adminActor = String(
    actor.id || actor.sessionId || actor.actorId || ''
  ).trim();
  if (!adminActor) return { ok: false, code: 'ACTOR_REQUIRED' };
  try {
    const zalo = action.startsWith('webhook-')
      ? providers.zalo || defaultZalo(env, fetchImpl)
      : null;
    if (action === 'webhook-info')
      return {
        ok: true,
        action,
        result: safeWebhookInfo(await zalo.getWebhookInfo()),
      };
    if (action === 'webhook-register') {
      if (!requireConfirm(body)) return { ok: false, code: 'CONFIRM_REQUIRED' };
      if (typeof quiesce !== 'function')
        return { ok: false, code: 'POLLING_QUIESCE_REQUIRED' };
      const quiesced = await quiesce('zalo-polling');
      if (!quiesced || quiesced.stopped !== true || quiesced.leaseGone !== true)
        return { ok: false, code: 'POLLING_QUIESCE_REQUIRED' };
      const url = String(body.url || env.ZALO_WEBHOOK_URL || '').trim();
      const secret = String(
        body.secret || env.ZALO_WEBHOOK_SECRET || ''
      ).trim();
      if (!url || !secret)
        return { ok: false, code: 'WEBHOOK_SETTINGS_REQUIRED' };
      try {
        const parsed = new URL(url);
        if (
          parsed.protocol !== 'https:' ||
          parsed.username ||
          parsed.password ||
          parsed.hash
        )
          return { ok: false, code: 'INVALID_WEBHOOK_URL' };
      } catch {
        return { ok: false, code: 'INVALID_WEBHOOK_URL' };
      }
      if (secret.length < 8 || secret.length > 256 || /[\s]/.test(secret))
        return { ok: false, code: 'INVALID_WEBHOOK_SECRET' };
      await zalo.setWebhook(url, secret);
      return {
        ok: true,
        action,
        result: safeWebhookInfo({ url }, 'webhook'),
        actor: adminActor,
      };
    }
    if (action === 'webhook-remove') {
      if (!requireConfirm(body)) return { ok: false, code: 'CONFIRM_REQUIRED' };
      if (typeof quiesce !== 'function')
        return { ok: false, code: 'POLLING_QUIESCE_REQUIRED' };
      const quiesced = await quiesce('zalo-polling');
      if (!quiesced || quiesced.stopped !== true || quiesced.leaseGone !== true)
        return { ok: false, code: 'POLLING_QUIESCE_REQUIRED' };
      await zalo.deleteWebhook();
      return {
        ok: true,
        action,
        result: safeWebhookInfo({}, 'polling'),
        actor: adminActor,
      };
    }

    const repo =
      repository || providers.repository || createZaloAnnouncementRepository();
    if (action === 'subscribers') {
      const page = Number.isInteger(body.page) && body.page > 0 ? body.page : 1;
      if (typeof providers.listSubscribers === 'function')
        return {
          ok: true,
          action,
          result: await providers.listSubscribers({
            page,
            includeUnsubscribed: true,
          }),
        };
      if (!repo || typeof repo.listSubscribers !== 'function')
        return { ok: false, code: 'SUBSCRIBER_PROVIDER_REQUIRED' };
      return {
        ok: true,
        action,
        result: await repo.listSubscribers({ page, includeUnsubscribed: true }),
      };
    }
    if (action === 'subscriber-remove') {
      if (!requireConfirm(body)) return { ok: false, code: 'CONFIRM_REQUIRED' };
      if (!safeId(body.chatId) && !safeId(body.userId))
        return { ok: false, code: 'SUBSCRIBER_REQUIRED' };
      const remove =
        providers.removeSubscriber ||
        repo?.removeSubscriber ||
        repo?.setSubscription;
      if (typeof remove !== 'function')
        return { ok: false, code: 'SUBSCRIBER_PROVIDER_REQUIRED' };
      return {
        ok: true,
        action,
        result: await remove({
          chatId: body.chatId || `admin:${body.userId}`,
          userId: body.userId,
          subscribed: false,
        }),
        actor: adminActor,
      };
    }

    const service =
      announcementService ||
      providers.announcements ||
      createZaloAnnouncementService({ repository: repo });
    if (action === 'announcement-preview') {
      const previewRequest = {
        ...body,
        ...MANAGEMENT_SOURCE,
        actorId: adminActor,
      };
      delete previewRequest.confirm;
      const result =
        typeof service.preview === 'function'
          ? await service.preview(previewRequest)
          : await service.prepare(previewRequest);
      if (!result || result.ok === false)
        return { ok: false, code: 'INVALID_ANNOUNCEMENT_REQUEST' };
      const preview = unwrap(result) || {};
      return {
        ok: true,
        action,
        result: {
          id: preview.id,
          message: preview.message ?? previewRequest.message ?? '',
          photoUrl: preview.photoUrl ?? previewRequest.photoUrl,
          subscriberCount: Number(
            preview.subscriberCount ?? preview.total ?? 0
          ),
          status: preview.status || 'draft',
        },
        actor: adminActor,
      };
    }
    if (!safeId(body.id))
      return { ok: false, code: 'ANNOUNCEMENT_ID_REQUIRED' };
    if (action === 'announcement-status') {
      const statusFn = service.status || service.getStatus;
      if (typeof statusFn !== 'function')
        return { ok: false, code: 'ANNOUNCEMENT_NOT_FOUND' };
      const result = await statusFn({
        id: body.id,
        actorId: adminActor,
        ...MANAGEMENT_SOURCE,
      });
      if (!result || result.ok === false)
        return { ok: false, code: 'ANNOUNCEMENT_NOT_FOUND' };
      const status = unwrap(result) || {};
      return {
        ok: true,
        action,
        result: {
          id: status.id,
          status: status.status,
          counts: {
            total: Number(status.total || 0),
            sent: Number(status.sent || 0),
            failed: Number(status.failed || 0),
            skipped: Number(status.skipped || 0),
            pending: Number(status.pending || 0),
            uncertain: Number(status.uncertain || 0),
          },
        },
        actor: adminActor,
      };
    }
    if (!requireConfirm(body)) return { ok: false, code: 'CONFIRM_REQUIRED' };
    // Existing persistent flow: claim once, then process one delivery at a time.
    const binding = { id: body.id, actorId: adminActor, ...MANAGEMENT_SOURCE };
    let claimed = unwrap(await service.claim(binding));
    if (!claimed && typeof service.content === 'function') {
      const existing = unwrap(await service.content(binding));
      if (existing?.status === 'sending') claimed = existing;
    }
    if (!claimed || !['draft', 'sending'].includes(claimed.status || 'sending'))
      return { ok: false, code: 'ANNOUNCEMENT_NOT_CLAIMED' };
    const deliveries = [];
    const sendDelivery =
      providers.sendAnnouncementDelivery || providers.sendAnnouncement;
    const sender =
      sendDelivery ||
      (async ({ chatId, announcement }) => {
        const client = providers.zalo || defaultZalo(env, fetchImpl);
        return announcement.photoUrl
          ? client.sendPhoto(chatId, announcement.photoUrl, {
              caption: announcement.message,
            })
          : client.sendMessage(chatId, announcement.message);
      });
    let complete = false;
    for (let attempt = 0; attempt < 1; attempt += 1) {
      const next = unwrap(await service.next({ id: body.id }));
      if (!next) break;
      let delivery = next;
      if (typeof sender === 'function') {
        try {
          const sent = await withTimeout(
            sender({ ...next, announcement: claimed, actor: adminActor }),
            10000
          );
          await service.record({
            id: body.id,
            chatId: next.chatId,
            status: 'sent',
            errorCode: null,
          });
          delivery = { ...next, status: 'sent', result: sent };
        } catch (error) {
          // A transport failure cannot prove whether the provider accepted the message.
          const code =
            error.code === 'SEND_TIMEOUT' ? 'SEND_TIMEOUT' : 'SEND_UNKNOWN';
          await service.record({
            id: body.id,
            chatId: next.chatId,
            status: 'unknown',
            errorCode: code,
          });
          delivery = { ...next, status: 'unknown', errorCode: code };
        }
      }
      deliveries.push(delivery);
    }
    const statusResult = unwrap(await service.status({ ...binding }));
    if (
      Number(statusResult?.pending || 0) > 0 ||
      Number(statusResult?.uncertain || 0) > 0
    )
      complete = false;
    else {
      await service.finish({ id: body.id });
      complete = true;
    }
    return {
      ok: true,
      action,
      result: {
        id: body.id,
        status: complete ? 'finished' : 'sending',
        deliveries,
        counts: {
          total: Number(statusResult?.total || 0),
          sent: Number(statusResult?.sent || 0),
          failed: Number(statusResult?.failed || 0),
          uncertain: Number(statusResult?.uncertain || 0),
          pending: Number(statusResult?.pending || 0),
          skipped: Number(statusResult?.skipped || 0),
        },
      },
      actor: adminActor,
    };
  } catch (error) {
    const safeCodes = new Set([
      'POLLING_QUIESCE_REQUIRED',
      'WEBHOOK_SETTINGS_REQUIRED',
      'INVALID_WEBHOOK_URL',
      'INVALID_WEBHOOK_SECRET',
      'SUBSCRIBER_REQUIRED',
      'SUBSCRIBER_PROVIDER_REQUIRED',
      'ANNOUNCEMENT_NOT_FOUND',
      'ANNOUNCEMENT_ID_REQUIRED',
      'ANNOUNCEMENT_NOT_CLAIMED',
      'INVALID_ANNOUNCEMENT_REQUEST',
      'CONFIRM_REQUIRED',
      'SEND_TIMEOUT',
      'SEND_FAILED',
    ]);
    return {
      ok: false,
      code: safeCodes.has(error.code) ? error.code : 'OPERATION_FAILED',
    };
  }
}

module.exports = { ACTIONS, runManagementOperation };
