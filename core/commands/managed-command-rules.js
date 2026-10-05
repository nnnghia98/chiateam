function parseRules(value) {
  if (!value) return {};
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null;
    for (const rule of Object.values(parsed)) {
      if (
        !rule ||
        typeof rule !== 'object' ||
        Array.isArray(rule) ||
        Object.keys(rule).some(
          key => !['enabled', 'permission'].includes(key)
        ) ||
        ('enabled' in rule && typeof rule.enabled !== 'boolean') ||
        ('permission' in rule && !['player', 'admin'].includes(rule.permission))
      )
        return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function createManagedCommandRules(env = process.env) {
  const rules = {
    telegram: parseRules(env.TELEGRAM_COMMAND_RULES),
    zalo: parseRules(env.ZALO_COMMAND_RULES),
  };
  return (context, definition) => {
    if (context.actor.platform === 'zalo' && definition.name === 'unsubscribe')
      return {};
    const selected = rules[context.actor.platform];
    if (selected === null) return { enabled: false };
    return selected?.[definition.name] || {};
  };
}
module.exports = { createManagedCommandRules, parseRules };
