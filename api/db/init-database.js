require('../../config/load-env').loadEnv();

const { db } = require('./config');
const {
  ensureCurrentMatchTable,
  ensureStorageTable,
} = require('../services/bot-storage-service');
const {
  ensureWorldCupPredictionTables,
} = require('../services/world-cup-predictions-service');
const { ensureMatchMediaTables } = require('../services/match-media-service');
const { ensureMatchResultColumns } = require('../routes/matches');

async function ensurePlayersAvatarColumn() {
  await db.query(
    'ALTER TABLE IF EXISTS players ADD COLUMN IF NOT EXISTS avatar TEXT'
  );
}

/**
 * Verify Supabase connection.
 * Schema is managed directly in Supabase Dashboard (SQL Editor).
 */
async function initDatabase() {
  try {
    const result = await db.query('SELECT NOW() AS now');
    await ensurePlayersAvatarColumn();
    await ensureMatchResultColumns();
    await ensureStorageTable();
    await ensureCurrentMatchTable();
    await ensureWorldCupPredictionTables();
    await ensureMatchMediaTables();
    console.log(
      '✅ Supabase connection successful. Server time:',
      result.rows[0].now
    );
    console.log('✅ Ensured players.avatar column exists');
    console.log('✅ Ensured match result columns exist');
    console.log('✅ Ensured storage table exists');
    console.log('✅ Ensured current_match table exists');
    console.log('✅ Ensured World Cup prediction tables exist');
    console.log('✅ Ensured match media tables exist');
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

module.exports = { initDatabase, ensurePlayersAvatarColumn };
