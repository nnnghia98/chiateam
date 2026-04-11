require('dotenv').config();
const { createUiApiServer } = require('./routes/server');

function installProcessCrashLogging() {
  process.on('uncaughtException', err => {
    console.error('💥 [API] uncaughtException:', err);
  });

  process.on('unhandledRejection', reason => {
    console.error('💥 [API] unhandledRejection:', reason);
  });

  process.on('SIGTERM', () => {
    console.error('🛑 [API] Received SIGTERM, shutting down...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.error('🛑 [API] Received SIGINT, shutting down...');
    process.exit(0);
  });
}

installProcessCrashLogging();

// Log environment information
console.log('🚀 Starting ChiaTeam API Server...');
console.log('');

const uiApi = createUiApiServer({
  getStatus: () => ({
    apiInitialized: true,
    timestamp: new Date().toISOString(),
  }),
});

uiApi
  .start()
  .then(({ port }) => {
    console.log('✅ API Server successfully started');
    console.log(`🧭 API running at http://localhost:${port}`);
  })
  .catch(err => {
    console.error('❌ Failed to start API Server:', err);
    process.exit(1);
  });
