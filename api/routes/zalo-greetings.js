const { db } = require('../db/config');

const readyByDatabase = new WeakMap();

function ensureZaloGreetingsTable(database = db) {
  if (!readyByDatabase.has(database)) {
    const ready = database
      .query(
        `
      CREATE TABLE IF NOT EXISTS zalo_greetings (
        user_id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE zalo_greetings ENABLE ROW LEVEL SECURITY;
    `
      )
      .catch(error => {
        readyByDatabase.delete(database);
        throw error;
      });
    readyByDatabase.set(database, ready);
  }
  return readyByDatabase.get(database);
}

function createZaloGreetingRepository({ database = db } = {}) {
  return Object.freeze({
    async claim({ userId, chatId }) {
      await ensureZaloGreetingsTable(database);
      // Claim before sending: concurrent messages and restarts must not greet twice.
      const result = await database.query(
        `INSERT INTO zalo_greetings (user_id, chat_id) VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING RETURNING user_id`,
        [userId, chatId]
      );
      return result.rowCount === 1;
    },
  });
}

module.exports = { ensureZaloGreetingsTable, createZaloGreetingRepository };
