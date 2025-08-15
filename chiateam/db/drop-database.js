const fs = require('fs');

const { dbPath } = require('./config');

// Drop/delete database
async function dropDatabase() {
  return new Promise((resolve, reject) => {
    console.log('🗑️ Checking if database exists...');

    if (fs.existsSync(dbPath)) {
      try {
        // Delete the database file
        fs.unlinkSync(dbPath);
        console.log('✅ Database file deleted successfully');
        resolve();
      } catch (err) {
        console.error('❌ Error deleting database file:', err);
        reject(err);
      }
    } else {
      console.log('ℹ️ Database file does not exist');
      resolve();
    }
  });
}

// Run drop operation if this file is executed directly
if (require.main === module) {
  console.log(
    '⚠️  WARNING: This will permanently delete the database and all data!'
  );
  console.log('📁 Database path:', dbPath);

  // Add a small delay to give user time to read the warning
  setTimeout(async () => {
    try {
      await dropDatabase();
      console.log('🎉 Database drop completed!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to drop database:', error);
      process.exit(1);
    }
  }, 2000);
}

module.exports = {
  dropDatabase,
};
