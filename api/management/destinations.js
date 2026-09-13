const LOCAL_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:8389',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8389',
]);

function originOf(value) {
  try {
    const url = new URL(String(value));
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

function allowedOrigins(env = process.env) {
  const configured = String(env.MANAGEMENT_ALLOWED_ORIGINS || '')
    .split(',')
    .map(originOf)
    .filter(Boolean);
  return new Set(configured);
}

function safeDestination(value, env = process.env) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error('DESTINATION_NOT_ALLOWED');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !allowedOrigins(env).has(url.origin)
  )
    throw new Error('DESTINATION_NOT_ALLOWED');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function fixedProviderUrl(provider, token, method) {
  const bases = {
    telegram: 'https://api.telegram.org',
    zalo: 'https://bot-api.zaloplatforms.com',
  };
  if (!bases[provider]) throw new Error('UNKNOWN_PROVIDER');
  if (!token || /[/\s]/.test(String(token)))
    throw new Error('MISSING_PROVIDER_TOKEN');
  return `${bases[provider]}/bot${token}/${method}`;
}

module.exports = {
  LOCAL_ORIGINS,
  originOf,
  allowedOrigins,
  safeDestination,
  fixedProviderUrl,
};
