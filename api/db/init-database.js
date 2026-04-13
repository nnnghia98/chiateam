const { db } = require('./config');
const { ensureCurrentMatchTable } = require('../services/bot-storage-service');

/**
 * Verify Supabase connection.
 * Schema is managed directly in Supabase Dashboard (SQL Editor).
 */
async function initDatabase() {
  try {
    const result = await db.query('SELECT NOW() AS now');
    await ensureCurrentMatchTable();
    console.log('✅ Supabase connection successful. Server time:', result.rows[0].now);
    console.log('✅ Ensured current_match table exists');
  } catch (err) {
    console.error('❌ Failed to connect to Supabase:', err);
    throw err;
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('🎉 Database connection verified!');
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { initDatabase };
