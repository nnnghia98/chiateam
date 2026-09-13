const crypto = require('node:crypto');
const SERVICE_TOKENS = {
  api: 'MANAGEMENT_API_TOKEN',
  telegram: 'MANAGEMENT_TELEGRAM_TOKEN',
  'zalo-polling': 'MANAGEMENT_ZALO_POLLING_TOKEN',
  'zalo-webhook': 'MANAGEMENT_ZALO_WEBHOOK_TOKEN',
  admin: 'MANAGEMENT_ADMIN_SERVICE_TOKEN',
};
function auth(req, env, kind, service) {
  const name =
      kind === 'admin' ? 'MANAGEMENT_ADMIN_TOKEN' : SERVICE_TOKENS[service],
    expected = env[name],
    supplied =
      req.headers[
        kind === 'admin' ? 'x-management-admin-auth' : 'x-management-auth'
      ];
  if (typeof expected !== 'string' || !expected || typeof supplied !== 'string')
    return false;
  // Reused credentials cannot provide meaningful service isolation.
  if (
    Object.values(SERVICE_TOKENS)
      .concat('MANAGEMENT_ADMIN_TOKEN')
      .some(key => key !== name && env[key] === expected)
  )
    return false;
  const a = Buffer.from(expected),
    b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function handleManagementRequest(
  req,
  res,
  { service, readJson, sendJson, env = process.env } = {}
) {
  const path = new URL(req.url || '/', 'http://management.local').pathname;
  if (path !== '/api/management' && !path.startsWith('/api/management/'))
    return false;
  const reply = (status, body) => {
    sendJson(res, status, body, { 'Cache-Control': 'no-store' });
    return true;
  };
  const runtime = path.match(
    /^\/api\/management\/runtime\/(api|telegram|zalo-polling|zalo-webhook|admin)(?:\/(report|lease))?$/
  );
  try {
    if (runtime) {
      if (!auth(req, env, 'service', runtime[1]))
        return reply(401, { error: 'UNAUTHORIZED' });
      if (req.method !== (runtime[2] ? 'POST' : 'GET'))
        return reply(405, { error: 'METHOD_NOT_ALLOWED' });
      const result = runtime[2]
        ? await service[runtime[2]](runtime[1], await readJson(req))
        : await service.runtime(runtime[1]);
      return reply(result.ok === false ? result.status || 400 : 200, result);
    }
    if (!auth(req, env, 'admin')) return reply(403, { error: 'FORBIDDEN' });
    if (path === '/api/management')
      return req.method === 'GET'
        ? reply(200, await service.snapshot())
        : reply(405, { error: 'METHOD_NOT_ALLOWED' });
    const action = path.slice('/api/management/'.length),
      operation = action.match(/^operations\/([a-z-]+)$/);
    if (
      !['save', 'test', 'apply', 'rollback', 'restart'].includes(action) &&
      !operation
    )
      return reply(404, { error: 'NOT_FOUND' });
    if (req.method !== 'POST')
      return reply(405, { error: 'METHOD_NOT_ALLOWED' });
    const body = await readJson(req);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return reply(400, { error: 'INVALID_PAYLOAD' });
    const actor =
      typeof req.headers['x-management-actor'] === 'string'
        ? req.headers['x-management-actor'].slice(0, 200)
        : 'trusted-admin';
    const result = operation
      ? await service.operation(operation[1], body, actor)
      : await service[action](body, actor);
    return reply(
      result?.ok === false
        ? Number.isInteger(result.status)
          ? result.status
          : 400
        : 200,
      result
    );
  } catch (error) {
    const code = /^[A-Z_]{1,64}$/.test(error.code || '')
      ? error.code
      : 'MANAGEMENT_UNAVAILABLE';
    return reply(
      [400, 409, 413, 503].includes(error.status) ? error.status : 503,
      { error: code }
    );
  }
}
module.exports = { handleManagementRequest, auth, SERVICE_TOKENS };
