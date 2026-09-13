function formatStartupError(error, env = process.env) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (code === 'MANAGEMENT_ENCRYPTION_KEY_REQUIRED') {
    const value = env?.MANAGEMENT_ENCRYPTION_KEY;
    const state =
      value === undefined || value === null || value === ''
        ? 'missing'
        : 'invalid';
    return `${state === 'missing' ? 'Missing' : 'Invalid'} MANAGEMENT_ENCRYPTION_KEY. Add it to the root .env file. Use 32 random bytes encoded as base64. If saved settings already exist, reuse the original key.`;
  }
  if (code === 'EADDRINUSE')
    return 'Admin panel backend port is already in use. Check whether the admin panel backend is already running before changing MANAGEMENT_PORT.';
  if (['ERR_SOCKET_BAD_PORT', 'ERR_INVALID_ARG_VALUE'].includes(code))
    return 'Invalid admin panel backend port. Set MANAGEMENT_PORT to a number from 1 to 65535.';
  if (code === 'EACCES')
    return 'Permission denied while opening the admin panel backend port. Set MANAGEMENT_PORT to an allowed port.';
  if (code === 'MANAGEMENT_DATABASE_UNAVAILABLE')
    return 'Admin panel backend database is unavailable. Check MANAGEMENT_DATABASE_URL or DATABASE_URL and database access.';
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(code))
    return 'An admin panel backend dependency is unavailable. Check the configured database and service settings.';
  return 'Admin panel backend failed to start. Check the configured admin panel setup.';
}

async function start() {
  require('../config/load-env').loadEnv();
  const {
    createManagementControlServer,
  } = require('./management/control-server');
  const app = createManagementControlServer();
  await app.start();
  console.log('Admin panel backend ready');
  const stop = () =>
    void app.stop().catch(() => {
      process.exitCode = 1;
    });
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return app;
}
if (require.main === module)
  start().catch(error => {
    console.error(formatStartupError(error));
    process.exitCode = 1;
  });
module.exports = { start, formatStartupError };
