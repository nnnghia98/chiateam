const {
  createPermissionPolicy,
} = require('../../core/ports/permission-policy');

function parseAdminIds(env) {
  const ids = [env.BOT_OWNER_ID];

  if (env.BOT_ADMIN_IDS) {
    ids.push(...String(env.BOT_ADMIN_IDS).split(','));
  }

  return new Set(ids.map(id => String(id ?? '').trim()).filter(Boolean));
}

function createTelegramPermissionPolicy({ env = process.env } = {}) {
  const adminIds = parseAdminIds(env);

  return createPermissionPolicy({
    isAllowed(context, permission) {
      if (permission === 'player') {
        return true;
      }

      if (context.actor.platform !== 'telegram') {
        return false;
      }

      if (permission === 'admin') {
        return adminIds.has(context.actor.externalId);
      }

      return false;
    },
  });
}

module.exports = {
  createTelegramPermissionPolicy,
  parseAdminIds,
};
