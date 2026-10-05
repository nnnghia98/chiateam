const DEV_FALLBACK_TOKEN = 'local-internal-api-token-change-me';
const PLACEHOLDER_TOKENS = new Set([
  DEV_FALLBACK_TOKEN,
  'change-this-shared-internal-token',
]);

// Public example values are only accepted outside production.
function resolveInternalApiToken(env = process.env) {
  const configured = String(env.INTERNAL_API_AUTH_TOKEN || '').trim();
  const production = env.NODE_ENV === 'production';
  if (configured && !(production && PLACEHOLDER_TOKENS.has(configured))) {
    return configured;
  }
  return production ? null : DEV_FALLBACK_TOKEN;
}

function isPublicInternalApiToken(env = process.env) {
  const token = resolveInternalApiToken(env);
  return token !== null && PLACEHOLDER_TOKENS.has(token);
}

module.exports = {
  DEV_FALLBACK_TOKEN,
  isPublicInternalApiToken,
  resolveInternalApiToken,
};
