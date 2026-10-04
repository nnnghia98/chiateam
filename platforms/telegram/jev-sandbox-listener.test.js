const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerJevSandboxListener } = require('./jev-sandbox-listener');

test('local sandbox sends all human text and logs readable action choices without executing commands', async () => {
  const bot = new EventEmitter();
  const logs = [];
  const requests = [];
  const sandbox = registerJevSandboxListener(bot, {
    env: { TELEGRAM_JEV_SANDBOX: 'true', TYPESAFE_API_KEY: 'test-secret', TELEGRAM_JEV_ENABLED: 'false' },
    logger: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    fetchImpl: async (url, options) => {
      requests.push(JSON.parse(options.body));
      const choice = ['vote_yes', 'vote_no', 'show_vote', 'no_match', 'clarify'][requests.length - 1];
      return { status: 200, json: async () => ({ model: 'jev-test', answers: { action: { type: 'choice', choice, probabilities: { [choice]: 0.03 }, confidence: 0.01 } } }) };
    },
  });
  for (const text of ['vote', 'không vote', '/vote 1', 'weather today?', 'x'.repeat(2001)]) {
    bot.emit('message', { text, from: { id: 1 }, chat: { id: 2, type: 'group' }, message_id: requests.length });
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests.map(r => r.state.message), ['vote', 'không vote', '/vote 1', 'weather today?', 'x'.repeat(2001)]);
  assert.equal(requests[0].questions.action.type, 'choice');
  assert.ok(!Object.hasOwn(requests[0].questions.action.criteria, 'help'));
  const responses = logs.filter(([label]) => label === '[jev.sandbox] response');
  assert.equal(responses.length, 5);
  assert.equal(responses[0][1], 'Message: "vote"\nChosen action: Confirm attendance\nCommand: /vote 1\nChance this action fits: 3%');
  assert.match(responses[1][1], /Decline attendance\nCommand: \/vote 0/);
  assert.match(responses[2][1], /Show current vote\nCommand: \/vote/);
  assert.match(responses[3][1], /No matching action\nCommand: None/);
  assert.match(responses[4][1], /Unclear request\nCommand: None/);
  assert.ok(!JSON.stringify(responses).includes('noul'));
  assert.ok(!JSON.stringify(logs).includes('test-secret'));
  sandbox.stop();
  assert.equal(bot.listenerCount('message'), 0);
});

test('sandbox requires opt-in and registers in production and Railway when enabled', () => {
  const bot = new EventEmitter();
  assert.equal(registerJevSandboxListener(bot, { env: { TYPESAFE_API_KEY: 'test' } }), null);
  for (const extra of [{ NODE_ENV: 'production' }, { RAILWAY_ENVIRONMENT_ID: 'production-id' }]) {
    const sandbox = registerJevSandboxListener(bot, {
      env: { TELEGRAM_JEV_SANDBOX: 'true', TYPESAFE_API_KEY: 'test', ...extra },
      logger: { log() {} },
    });
    assert.equal(bot.listenerCount('message'), 1);
    sandbox.stop();
    assert.equal(bot.listenerCount('message'), 0);
  }
});
