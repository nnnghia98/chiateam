const { createZaloBotClient } = require('./client');

function classifySendError(error) {
  const http = Number(error?.statusCode);
  const api = Number(error?.errorCode);
  if (http === 401 || api === 401) return 'UNAUTHORIZED';
  if (http === 429 || api === 429) return 'RATE_LIMITED';
  if (http >= 500 || api >= 500) return 'NETWORK_ERROR';
  if (
    error?.name === 'ZaloApiError' &&
    ((http >= 400 && http < 500) || (Number.isFinite(api) && api !== 0))
  )
    return 'API_ERROR';
  // A malformed successful response does not prove that delivery failed.
  return 'NETWORK_ERROR';
}

function sourceIdentity(context) {
  return {
    platform: context.actor.platform,
    actorId: context.actor.externalId,
    sourceChatId: context.conversation.externalId,
    sourceThreadId: context.conversation.threadId || '',
  };
}

function createZaloBroadcastService({
  repository,
  env = process.env,
  client,
  createClient = createZaloBotClient,
  wait = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds)),
  sendIntervalMs = 1000,
  onDiagnostic = fields =>
    console.error('[zalo.broadcast]', JSON.stringify(fields)),
} = {}) {
  for (const method of [
    'prepare',
    'claim',
    'next',
    'record',
    'finish',
    'status',
    'cancel',
  ]) {
    if (typeof repository?.[method] !== 'function')
      throw new TypeError(`Broadcast repository requires ${method}.`);
  }
  if (!Number.isFinite(sendIntervalMs) || sendIntervalMs < 0)
    throw new TypeError('Invalid broadcast interval.');
  let activeClient = client;

  function diagnostic(operation, code, id) {
    // Never log raw errors, URLs, tokens, recipient IDs, or message content.
    try {
      onDiagnostic({ operation, code, ...(id ? { id } : {}) });
    } catch {
      /* Logging must not change delivery. */
    }
  }

  return Object.freeze({
    async prepare(message, context) {
      return repository.prepare({ ...sourceIdentity(context), message });
    },
    async status(id, context) {
      return repository.status({ id, ...sourceIdentity(context) });
    },
    async cancel(id, context) {
      return repository.cancel({ id, ...sourceIdentity(context) });
    },
    async confirm(id, context) {
      const identity = { id, ...sourceIdentity(context) };
      try {
        if (!activeClient) {
          const token = String(env.ZALO_BOT_TOKEN || '').trim();
          if (!token) return { code: 'MISSING_TOKEN' };
          activeClient = createClient({
            token,
            fetcher: (url, options) =>
              fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
          });
        }
        // Read-only authentication check before consuming the one-use confirmation.
        await activeClient.getMe();
      } catch (error) {
        const code = classifySendError(error);
        diagnostic('preflight', code);
        return { code };
      }

      const draft = await repository.claim(identity);
      if (!draft) return { code: 'UNAVAILABLE' };
      let stopReason = null;
      let attempted = 0;
      try {
        for (;;) {
          if (attempted > 0 && sendIntervalMs > 0) await wait(sendIntervalMs);
          // A durable 'sending' claim is stored BEFORE the external call.
          // Never automatically retry it: a timeout may have delivered the message.
          const recipient = await repository.next({ id });
          if (!recipient) break;
          attempted += 1;
          let status = 'sent';
          let errorCode = null;
          try {
            await activeClient.sendMessage(recipient.chatId, draft.message);
          } catch (error) {
            errorCode = classifySendError(error);
            status = errorCode === 'NETWORK_ERROR' ? 'unknown' : 'failed';
            diagnostic('send', errorCode, id);
            if (
              ['UNAUTHORIZED', 'RATE_LIMITED', 'NETWORK_ERROR'].includes(
                errorCode
              )
            )
              stopReason = errorCode;
          }
          const recorded = await repository.record({
            id,
            chatId: recipient.chatId,
            status,
            errorCode,
          });
          if (!recorded) throw new Error('Delivery receipt was not saved.');
          if (stopReason) break;
        }
        await repository.finish({ id });
        return {
          code: 'FINISHED',
          stopReason,
          summary: await repository.status(identity),
        };
      } catch {
        diagnostic('storage', 'PROGRESS_UNAVAILABLE', id);
        return { code: 'PROGRESS_UNAVAILABLE', id };
      }
    },
  });
}

module.exports = {
  createZaloBroadcastService,
  classifySendError,
  sourceIdentity,
};
