const LEVELS = {
  info: { icon: 'ℹ️', method: 'log' },
  success: { icon: '✅', method: 'log' },
  warn: { icon: '⚠️', method: 'warn' },
  error: { icon: '❌', method: 'error' },
};

function formatValue(value) {
  if (value == null || value === '') return '-';
  if (value instanceof Error) return value.message;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatFields(fields) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);

  if (entries.length === 0) return '';

  const width = Math.max(...entries.map(([key]) => key.length));

  return entries
    .map(([key, value]) => `  ${key.padEnd(width)} : ${formatValue(value)}`)
    .join('\n');
}

function logEvent(scope, title, fields = {}, level = 'info') {
  const { icon, method } = LEVELS[level] || LEVELS.info;
  const body = formatFields(fields);
  const message = body
    ? `${icon} [${scope}] ${title}\n${body}`
    : `${icon} [${scope}] ${title}`;

  console[method](message);
}

module.exports = {
  logEvent,
};
