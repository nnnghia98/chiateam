const {
  createPermissionPolicy,
} = require('../../core/ports/permission-policy');

function parseMessengerAdminIds(env = process.env) {
  const raw = env.MESSENGER_ADMIN_IDS;
  if (raw == null) return new Set();
  return new Set(
    String(raw)
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
  );
}

function createMessengerPermissionPolicy({ env = process.env } = {}) {
  const adminIds = parseMessengerAdminIds(env);
  return createPermissionPolicy({
    isAllowed(context, permission) {
      if (permission === 'player') return true;
      if (context.actor.platform !== 'messenger') return false;
      return permission === 'admin' && adminIds.has(context.actor.externalId);
    },
  });
}

module.exports = {
  createMessengerPermissionPolicy,
  parseMessengerAdminIds,
};
