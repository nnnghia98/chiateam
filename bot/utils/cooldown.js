const cooldowns = new Map();

function createCooldownKey(msg, command) {
  return `${msg?.chat?.id}:${command}`;
}

function isOnCooldown(msg, command, cooldownMs = 2000) {
  const key = createCooldownKey(msg, command);
  const now = Date.now();
  const expiresAt = cooldowns.get(key) || 0;

  if (expiresAt > now) {
    return true;
  }

  const nextExpiresAt = now + cooldownMs;
  cooldowns.set(key, nextExpiresAt);

  const timer = setTimeout(() => {
    if (cooldowns.get(key) === nextExpiresAt) {
      cooldowns.delete(key);
    }
  }, cooldownMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return false;
}

module.exports = {
  isOnCooldown,
};
