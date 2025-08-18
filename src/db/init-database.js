const fs = require('fs');

const { dbPath, schemaPath, db } = require('./config');

// Initialize all database tables
async function initDatabase() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Checking database tables...');

    // Check if database file exists
    const dbExists = fs.existsSync(dbPath);

    if (dbExists) {
      // Check existing tables
      checkAndCreateTables(resolve, reject);
    } else {
      // Create new database with all tables
      console.log('🗄️ Creating new database...');
      createAllTables(resolve, reject);
    }
  });
}

// Check existing tables and create missing ones
function checkAndCreateTables(resolve, reject) {
  const tables = ['leaderboard', 'player'];
  let tablesChecked = 0;
  let tablesCreated = 0;

  tables.forEach(tableName => {
    db.get(
      // eslint-disable-next-line quotes
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
      (err, row) => {
        if (err) {
          console.error(`Error checking ${tableName} table:`, err);
          reject(err);
          return;
        }

        if (row) {
          console.log(`✅ ${tableName} table already exists`);
        } else {
          console.log(`📋 Creating ${tableName} table...`);
          createTable(tableName, resolve, reject);
          tablesCreated++;
        }

        tablesChecked++;
        if (tablesChecked === tables.length) {
          if (tablesCreated === 0) {
            console.log('✅ All tables already exist. Database is ready!');
            resolve();
          } else {
            console.log(
              `✅ Database initialization completed. Created ${tablesCreated} new tables.`
            );
            resolve();
          }
        }
      }
    );
  });
}

// Create a specific table
function createTable(tableName, resolve, reject) {
  let createTableSQL;

  switch (tableName) {
    case 'leaderboard':
      createTableSQL = `
        CREATE TABLE leaderboard (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_number INTEGER NOT NULL UNIQUE,
          total_match INTEGER DEFAULT 0,
          total_win INTEGER DEFAULT 0,
          total_lose INTEGER DEFAULT 0,
          total_draw INTEGER DEFAULT 0,
          winrate REAL DEFAULT 0.0,
          goal INTEGER DEFAULT 0,
          assist INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      break;

    case 'player':
      createTableSQL = `
        CREATE TABLE player (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tele_id INTEGER NOT NULL UNIQUE,
          number INTEGER NOT NULL,
          name TEXT NOT NULL,
          username TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      break;

    default:
      reject(new Error(`Unknown table: ${tableName}`));
      return;
  }

  db.exec(createTableSQL, err => {
    if (err) {
      console.error(`Error creating ${tableName} table:`, err);
      reject(err);
    } else {
      console.log(`✅ ${tableName} table created successfully`);
    }
  });
}

// Create all tables from schema file
function createAllTables(resolve, reject) {
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
        console.log('✅ Database initialized successfully with all tables');
        resolve();
      }
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
  console.log('🚀 Starting database initialization...');
  initDatabase()
    .then(() => closeDatabase())
    .then(() => {
      console.log('🎉 Database initialization completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to initialize database:', error);
      process.exit(1);
    });
}

module.exports = {
  initDatabase,
  closeDatabase,
};
