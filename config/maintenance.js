function isTruthy(value) {
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isMaintenanceModeEnabled() {
  return isProduction() && isTruthy(process.env.MAINTENANCE_MODE);
}

function getMaintenanceUntil() {
  return process.env.MAINTENANCE_UNTIL || 'until further notice';
}

module.exports = {
  isMaintenanceModeEnabled,
  getMaintenanceUntil,
};
