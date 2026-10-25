const ROUTE_TYPES = new Set([
  'main',
  'announcement',
  'statistics',
  'vip',
  'poll',
]);
const record = value =>
  value && typeof value === 'object' && !Array.isArray(value);
const text = value => String(value ?? '').trim() || null;

function destinationKey(destination) {
  return `${destination.chatId}/${destination.threadId || ''}`;
}

function normalizeTelegramRouting(value) {
  const input = typeof value === 'string' ? JSON.parse(value) : value;
  if (
    !record(input) ||
    Object.keys(input).some(
      key => !['default', 'channels', 'routes'].includes(key)
    )
  )
    throw new TypeError('Invalid Telegram routing configuration.');
  function destination(value) {
    if (
      !record(value) ||
      Object.keys(value).some(key => !['chatId', 'threadId'].includes(key))
    )
      throw new TypeError(
        'A Telegram destination requires a chat ID and optional topic ID.'
      );
    const chatId = text(value.chatId);
    const threadId = text(value.threadId);
    if (
      !chatId ||
      !/^-?[1-9]\d*$/.test(chatId) ||
      !Number.isSafeInteger(Number(chatId)) ||
      (threadId &&
        (!/^[1-9]\d*$/.test(threadId) ||
          !Number.isSafeInteger(Number(threadId))))
    )
      throw new TypeError(
        'Telegram chat and topic IDs must be valid integers.'
      );
    return Object.freeze({ chatId, threadId });
  }
  if (
    input.default === undefined ||
    !Array.isArray(input.channels) ||
    input.channels.length > 100 ||
    !record(input.routes)
  )
    throw new TypeError(
      'Telegram routing requires default, channels and routes.'
    );
  const defaultDestination =
    input.default === null ? null : destination(input.default);
  const channels = input.channels.map(destination);
  const keys = channels.map(destinationKey);
  if (
    new Set(keys).size !== keys.length ||
    (defaultDestination && keys.includes(destinationKey(defaultDestination)))
  )
    throw new TypeError('Telegram destinations must be unique.');
  const destinations = new Set(keys);
  if (defaultDestination) destinations.add(destinationKey(defaultDestination));
  const routes = {};
  for (const [kind, key] of Object.entries(input.routes)) {
    if (
      !ROUTE_TYPES.has(kind) ||
      typeof key !== 'string' ||
      !destinations.has(key)
    )
      throw new TypeError(
        'Telegram routes must reference a configured destination.'
      );
    routes[kind] = key;
  }
  return Object.freeze({
    default: defaultDestination,
    channels: Object.freeze(channels),
    routes: Object.freeze(routes),
  });
}

function createTelegramChannelConfig(env = process.env) {
  const routingValue = env.TELEGRAM_CHANNEL_ROUTING;
  return Object.freeze({
    ...(routingValue != null && routingValue !== ''
      ? { routing: normalizeTelegramRouting(routingValue) }
      : {}),
    chatId: text(env.CHAT_ID),
    threads: Object.freeze({
      default: text(env.DEFAULT_THREAD_ID),
      main: text(env.MAIN_THREAD_ID),
      announcement: text(env.ANNOUNCEMENT_THREAD_ID),
      vip: text(env.VIP_THREAD_ID),
      statistics: text(env.STATISTICS_THREAD_ID),
    }),
  });
}

function resolveTelegramDestination(config, context, kind = 'default') {
  const source = {
    chatId: context.conversation.externalId,
    threadId: context.conversation.threadId ?? null,
  };
  if (kind === 'private')
    return { chatId: context.actor.externalId, threadId: null };
  if (config.routing) {
    // Compose drafts remain bound to their source; Zalo delivery stays unchanged.
    if (['zalosay', 'say'].includes(context.command?.toLowerCase()))
      return source;
    const key = config.routing.routes[kind];
    return (
      (key &&
        [config.routing.default, ...config.routing.channels].find(
          destination => destination && destinationKey(destination) === key
        )) ||
      config.routing.default ||
      source
    );
  }
  // Keep legacy deployments stable until unified routing is explicitly applied.
  if (kind === 'poll')
    return config.chatId
      ? {
          chatId: config.chatId,
          threadId: config.threads?.announcement ?? null,
        }
      : source;
  if (
    context.conversation.type === 'private' ||
    context.command?.toLowerCase() === 'start' ||
    kind === 'source' ||
    !config.chatId ||
    !Object.hasOwn(config.threads || {}, kind)
  )
    return source;
  return { chatId: config.chatId, threadId: config.threads[kind] ?? null };
}

module.exports = {
  normalizeTelegramRouting,
  destinationKey,
  createTelegramChannelConfig,
  resolveTelegramDestination,
};
