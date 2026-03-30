/**
 * Test script to automate bot commands for local development
 * This sends HTTP requests to the test server to simulate Telegram messages
 *
 * Usage:
 *   1. Start the bot in development mode: yarn dev:bot
 *   2. Run this script: yarn test:commands
 *
 * Or directly:
 *   NODE_ENV=development node -r dotenv/config test-bot-commands.js
 *
 * Make sure your .env file has:
 *   - TELEGRAM_BOT_TOKEN
 *   - DATABASE_URL (Supabase cloud)
 *   - CHAT_ID (optional)
 *   - TEST_SERVER_PORT (optional, defaults to 3001)
 *
 * See docs/TESTING.md for detailed documentation
 */

const dotenv = require('dotenv');
const http = require('http');
dotenv.config();

const { getAllPlayers } = require('./api/routes/players');

const TEST_SERVER_PORT = process.env.TEST_SERVER_PORT || 3001;
const TEST_SERVER_HOST = 'localhost';

// Test user info
const TEST_USER = {
  id: 999999999, // Test user ID
  first_name: 'TestDev',
  username: 'testdev',
};

/**
 * Send HTTP request to test server
 */
function sendTestCommand(command, userId = TEST_USER.id, userInfo = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      command,
      userId,
      userInfo: Object.keys(userInfo).length > 0 ? userInfo : undefined,
    });

    const options = {
      hostname: TEST_SERVER_HOST,
      port: TEST_SERVER_PORT,
      path: '/test-command',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, res => {
      let responseData = '';

      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Simulate a bot command via HTTP
 */
async function simulateCommand(text, userId = TEST_USER.id, userInfo = {}) {
  console.log(`\n📤 Simulating command: ${text}`);

  try {
    const response = await sendTestCommand(text, userId, userInfo);
    console.log('✅ Command sent successfully');
    // Wait a bit for async operations to complete
    await sleep(1000);
  } catch (error) {
    console.error(`❌ Failed to send command: ${error.message}`);
    throw error;
  }
}

// Helper sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get this week's Thursday date in dd/mm/yyyy format
function getThisThursday() {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 4 = Thursday

  let daysUntilThursday;
  if (currentDay <= 4) {
    // Thursday is ahead this week
    daysUntilThursday = 4 - currentDay;
  } else {
    // Thursday is next week
    daysUntilThursday = 4 + (7 - currentDay);
  }

  const thursday = new Date(today);
  thursday.setDate(today.getDate() + daysUntilThursday);

  const day = String(thursday.getDate()).padStart(2, '0');
  const month = String(thursday.getMonth() + 1).padStart(2, '0');
  const year = thursday.getFullYear();

  return `${day}/${month}/${year}`;
}

// Get random players from array
function getRandomPlayers(players, count) {
  const shuffled = [...players].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Main test flow
async function runTestFlow() {
  console.log('🚀 Starting Bot Command Test Flow...\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Add me
    console.log('\n📝 Step 1: Adding test user with /addme');
    await simulateCommand('/addme', TEST_USER);

    // Step 2: Get all players from database and add them
    console.log('\n📝 Step 2: Adding all players from database');
    const allPlayers = await getAllPlayers();
    console.log(`Found ${allPlayers.length} players in database`);

    if (allPlayers.length > 0) {
      // Add players in batches (max 10 at a time to avoid too long messages)
      const playerNames = allPlayers.map(p => p.name);
      const batchSize = 10;

      for (let i = 0; i < playerNames.length; i += batchSize) {
        const batch = playerNames.slice(i, i + batchSize);
        await simulateCommand(`/add ${batch.join(', ')}`);
      }
    }

    // Step 3: Add random players to bench up to 15 players
    console.log('\n📝 Step 3: Adding random players to reach 15 total');
    const randomNames = [
      'Player1',
      'Player2',
      'Player3',
      'Player4',
      'Player5',
      'Player6',
      'Player7',
      'Player8',
      'Player9',
      'Player10',
    ];

    // Calculate how many more we need (we already have test user + db players)
    const currentCount = 1 + allPlayers.length;
    const needed = Math.max(0, 15 - currentCount);

    if (needed > 0) {
      const namesToAdd = randomNames.slice(0, needed);
      await simulateCommand(`/add ${namesToAdd.join(', ')}`);
    }

    // Step 4: Check bench
    console.log('\n📝 Step 4: Checking bench');
    await simulateCommand('/bench');

    // Step 5: Call /chiateam
    console.log('\n📝 Step 5: Dividing teams with /chiateam');
    await simulateCommand('/chiateam');

    // Step 6: Call /team
    console.log('\n📝 Step 6: Viewing teams with /team');
    await simulateCommand('/team');

    // Step 7: Set venue with thursday date
    const thursdayDate = getThisThursday();
    console.log(`\n📝 Step 7: Setting venue for Thursday (${thursdayDate})`);
    await simulateCommand(`/san 19h15 - ${thursdayDate} - sân số 8`);

    // Give a bit more time for team division to settle
    await sleep(1500);

    // Step 8 & 9: Adjust teams by adding specific bench players to teams
    // Note: After /chiateam, bench is NOT cleared, so we can still add from bench
    // These commands add bench players #3 and #1 to specific teams
    console.log('\n📝 Step 8: Adding 3rd bench player to AWAY team');
    await simulateCommand('/addtoteam AWAY 3');

    console.log('\n📝 Step 9: Adding 1st bench player to HOME team');
    await simulateCommand('/addtoteam HOME 1');

    // Step 10: Save match
    console.log('\n📝 Step 10: Saving match with /match SAVE');
    await simulateCommand('/match SAVE');

    // Step 11: Update score to "10 - 12"
    console.log('\n📝 Step 11: Updating match score to 10-12');
    await simulateCommand(`/match ${thursdayDate} 10-12`);

    // Step 12: View matches list
    console.log('\n📝 Step 12: Viewing matches list');
    await simulateCommand('/matches');

    // Step 13: View latest match detail
    console.log('\n📝 Step 13: Viewing latest match detail');
    await simulateCommand('/match');

    // Step 14: Clear data
    console.log('\n📝 Step 14: Clearing data');
    await simulateCommand('/clearbench');
    await simulateCommand('/clearteam');

    console.log(`\n${'='.repeat(50)}`);
    console.log('✅ Test flow completed!');
    console.log(
      '\n⚠️  Note: Some advanced features like adding goals, assists,'
    );
    console.log(
      '   and MVP stats to specific players require additional parameters.'
    );
    console.log('   See /match command documentation for full syntax.');
    console.log('   Example: /match [date] goal [player_number] [count]');
  } catch (error) {
    console.error('\n❌ Error during test flow:', error);
    console.error('\n💡 Make sure the bot is running with: yarn dev:bot');
    process.exit(1);
  } finally {
    // Give time for final messages to process
    await sleep(2000);
    console.log('\n🏁 Test script finished.');
    process.exit(0);
  }
}

// Check if required env vars are set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}

/**
 * Check if test server is available
 */
async function checkTestServer() {
  return new Promise(resolve => {
    const req = http.request(
      {
        hostname: TEST_SERVER_HOST,
        port: TEST_SERVER_PORT,
        path: '/test-command',
        method: 'OPTIONS',
      },
      res => {
        resolve(true);
      }
    );

    req.on('error', () => {
      resolve(false);
    });

    req.end();
  });
}

/**
 * Wait for test server to be available
 */
async function waitForTestServer(maxRetries = 10, delayMs = 1000) {
  console.log(
    `⏳ Waiting for test server at http://${TEST_SERVER_HOST}:${TEST_SERVER_PORT}...`
  );

  for (let i = 0; i < maxRetries; i++) {
    const isAvailable = await checkTestServer();

    if (isAvailable) {
      console.log('✅ Test server is ready!\n');
      return true;
    }

    if (i < maxRetries - 1) {
      await sleep(delayMs);
    }
  }

  return false;
}

// Main execution
(async () => {
  console.log('🚀 Bot Command Test Script\n');
  console.log('📋 Prerequisites:');
  console.log('   1. Start the bot in development mode: yarn dev:bot');
  console.log('   2. Wait for "Test server running" message');
  console.log('   3. Run this script\n');

  const serverReady = await waitForTestServer();

  if (!serverReady) {
    console.error('❌ Test server is not available');
    console.error('   Make sure the bot is running with: yarn dev:bot');
    console.error(
      '   The bot should show "✅ Test server running on http://localhost:3001"'
    );
    process.exit(1);
  }

  await runTestFlow();
})();
