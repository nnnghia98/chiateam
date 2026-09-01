const {
  createPermissionPolicy,
} = require('../../core/ports/permission-policy');

function parseZaloAdminIds(env) {
  const ids = [env.ZALO_BOT_OWNER_ID];

  if (env.ZALO_BOT_ADMIN_IDS) {
    ids.push(...String(env.ZALO_BOT_ADMIN_IDS).split(','));
  }

  return new Set(ids.map(id => String(id ?? '').trim()).filter(Boolean));
}

function createZaloPermissionPolicy({ env = process.env } = {}) {
  const adminIds = parseZaloAdminIds(env);

  return createPermissionPolicy({
    isAllowed(context, permission) {
      if (permission === 'player') {
        return true;
      }

      if (context.actor.platform !== 'zalo') {
        return false;
      }

      return permission === 'admin' && adminIds.has(context.actor.externalId);
    },
  });
}

module.exports = {
  createZaloPermissionPolicy,
  parseZaloAdminIds,
};
