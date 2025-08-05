const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const dbPath = path.join(__dirname, 'leaderboard.db');
const schemaPath = path.join(__dirname, '../script/tables.sql');

// Create database connection
const db = new sqlite3.Database(dbPath);

// Initialize database with schema
async function initLeaderboardDB() {
  return new Promise((resolve, reject) => {
    // Read schema file
    fs.readFile(schemaPath, 'utf8', (err, schema) => {
      if (err) {
        console.error('Error reading schema file:', err);
        reject(err);
        return;
      }

      // Execute schema
      db.exec(schema, err => {
        if (err) {
          console.error('Error initializing database:', err);
          reject(err);
        } else {
          console.log('✅ Leaderboard database initialized successfully');
          resolve();
        }
      });
    });
  });
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
      } else {
        console.log('✅ Database connection closed');
        resolve();
      }
    });
  });
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initLeaderboardDB()
    .then(() => closeDatabase())
    .then(() => {
      console.log('🎉 Leaderboard database initialized!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to initialize leaderboard database:', error);
      process.exit(1);
    });
}

module.exports = {
  initLeaderboardDB,
  closeDatabase,
};
