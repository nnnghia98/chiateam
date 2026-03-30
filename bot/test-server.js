/**
 * HTTP Test Server for Development
 *
 * Provides an HTTP endpoint to send test commands to the bot without
 * needing to manually type them in Telegram during development.
 *
 * Only runs when NODE_ENV=development
 *
 * Usage:
 *   POST http://localhost:3001/test-command
 *   Body: { "command": "/addme", "userId": 123456789 }
 */

const http = require('http');
const { CHAT_ID } = require('./utils/chat');

const PORT = process.env.TEST_SERVER_PORT || 3001;

// Default test user
const DEFAULT_TEST_USER = {
  id: 999999999,
  first_name: 'TestDev',
  username: 'testdev',
  is_bot: false,
  language_code: 'en',
};

/**
 * Create a mock Telegram message object
 */
function createMockMessage(text, userId = DEFAULT_TEST_USER.id, userInfo = {}) {
  const user = {
    id: userId,
    first_name: userInfo.first_name || DEFAULT_TEST_USER.first_name,
    username: userInfo.username || DEFAULT_TEST_USER.username,
    is_bot: false,
    language_code: userInfo.language_code || 'en',
  };

  return {
    message_id: Date.now(),
    from: user,
    chat: {
      id: CHAT_ID || 123456789,
      type: 'supergroup',
    },
    date: Math.floor(Date.now() / 1000),
    text,
  };
}

/**
 * Start the HTTP test server
 */
function startTestServer(bot) {
  if (process.env.NODE_ENV !== 'development') {
    console.log('⏭️  Test server only runs in development mode');
    return null;
  }

  if (!bot) {
    console.error('❌ Cannot start test server: bot instance not available');
    return null;
  }

  const server = http.createServer(async (req, res) => {
    // Set CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Only allow POST to /test-command
    if (req.method !== 'POST' || req.url !== '/test-command') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Not found',
          usage:
            'POST /test-command with body: { "command": string, "userId"?: number }',
        })
      );
      return;
    }

    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        if (!data.command || typeof data.command !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Missing or invalid "command" field',
              example: { command: '/addme', userId: 123456789 },
            })
          );
          return;
        }

        const userId = data.userId || DEFAULT_TEST_USER.id;
        const userInfo = data.userInfo || {};

        // Create mock message
        const msg = createMockMessage(data.command, userId, userInfo);

        // Process the update through the bot
        console.log(
          `📨 Test command received: ${data.command} (userId: ${userId})`
        );

        await bot.processUpdate({
          update_id: Date.now(),
          message: msg,
        });

        // Send success response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            command: data.command,
            userId,
            message: 'Command processed',
          })
        );
      } catch (error) {
        console.error('❌ Test server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Internal server error',
            details: error.message,
          })
        );
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`✅ Test server running on http://localhost:${PORT}`);
    console.log(
      `📝 Send test commands to: POST http://localhost:${PORT}/test-command`
    );
    console.log(
      `   Example: curl -X POST http://localhost:${PORT}/test-command \\`
    );
    console.log('            -H "Content-Type: application/json" \\');
    console.log('            -d \'{"command": "/addme"}\'');
  });

  return server;
}

module.exports = { startTestServer };
