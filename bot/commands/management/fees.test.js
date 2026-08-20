const test = require('node:test');
const assert = require('node:assert/strict');

function createMockBot() {
  const handlers = [];
  const sentMessages = [];

  return {
    handlers,
    sentMessages,
    bot: {
      onText(pattern, handler) {
        handlers.push({ pattern, handler });
      },
      async sendMessage(chatId, message, options) {
        sentMessages.push({ chatId, message, options });
        return { ok: true };
      },
    },
  };
}

function loadCommand(commandName, mockBot) {
  const commandPath = require.resolve(`./${commandName}`);
  const chatPath = require.resolve('../../utils/chat');
  const telegramClientPath = require.resolve('../../telegram-client');

  delete require.cache[commandPath];
  delete require.cache[chatPath];
  delete require.cache[telegramClientPath];

  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  return require(commandPath);
}

async function invokeCommand(handlers, command) {
  const match = handlers.find(({ pattern }) => pattern.test(command));
  assert.ok(match, `Missing handler for ${command}`);

  await match.handler(
    {
      from: { id: 123 },
      chat: { id: 456 },
      text: command,
    },
    command.match(match.pattern)
  );

  await Promise.resolve();
}

test('/tiennuoc reads and updates the stored water fee', async () => {
  const mock = createMockBot();
  const tiennuocCommand = loadCommand('tien-nuoc', mock.bot);
  let tiennuoc = 0;

  tiennuocCommand(
    () => tiennuoc,
    value => {
      tiennuoc = value;
    }
  );

  await invokeCommand(mock.handlers, '/tiennuoc');
  assert.match(mock.sentMessages.at(-1).message, /Chưa thêm tiền nước/);

  await invokeCommand(mock.handlers, '/tiennuoc 60,000');
  assert.equal(tiennuoc, 60000);
  assert.match(mock.sentMessages.at(-1).message, /60\.000 VND/);

  await invokeCommand(mock.handlers, '/tiennuoc');
  assert.match(mock.sentMessages.at(-1).message, /60\.000 VND/);
});

test('legacy /tiensan handler can leave the command to shared runtime', () => {
  const mock = createMockBot();
  const tiensanCommand = loadCommand('tien-san', mock.bot);

  tiensanCommand(
    () => 0,
    () => {},
    { registerCommand: false }
  );

  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/tiensan')),
    false
  );
  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/tiensan 500000')),
    false
  );
});

test('legacy /tiennuoc handler can leave the command to shared runtime', () => {
  const mock = createMockBot();
  const tiennuocCommand = loadCommand('tien-nuoc', mock.bot);

  tiennuocCommand(
    () => 0,
    () => {},
    { registerCommand: false }
  );

  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/tiennuoc')),
    false
  );
  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/tiennuoc 60000')),
    false
  );
});

test('/winner and /loser use the renamed team-result commands', async () => {
  const mock = createMockBot();
  const teamThuaCommand = loadCommand('team-thua', mock.bot);
  const teamA = new Map([
    [1, { name: 'Alice' }],
    [2, { name: 'Bob' }],
  ]);
  const teamB = new Map([[3, { name: 'Carol' }]]);
  let teamThua = null;

  teamThuaCommand({
    getTiensan: () => 500000,
    getTiennuoc: () => 60000,
    getTeamThua: () => teamThua,
    setTeamThua: value => {
      teamThua = value;
    },
    teamA,
    teamB,
  });

  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/winner HOME')),
    true
  );
  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/loser HOME')),
    true
  );
  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/teamthang HOME')),
    false
  );
  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/teamthua HOME')),
    false
  );

  await invokeCommand(mock.handlers, '/winner HOME');

  assert.equal(teamThua, 'AWAY');
  assert.match(mock.sentMessages.at(-1).message, /HOME \(thắng\)/);
  assert.match(mock.sentMessages.at(-1).message, /AWAY \(thua\)/);
  assert.match(mock.sentMessages.at(-1).message, /226\.667 VND/);

  await invokeCommand(mock.handlers, '/loser HOME');

  assert.equal(teamThua, 'HOME');
  assert.match(mock.sentMessages.at(-1).message, /AWAY \(thắng\)/);
  assert.match(mock.sentMessages.at(-1).message, /HOME \(thua\)/);
});

test('legacy result handlers can leave /winner and /loser to shared runtime', () => {
  const mock = createMockBot();
  const teamResultCommand = loadCommand('team-thua', mock.bot);

  teamResultCommand({
    getTiensan: () => 0,
    getTiennuoc: () => 0,
    getTeamThua: () => null,
    setTeamThua: () => {},
    teamA: new Map(),
    teamB: new Map(),
    registerCommands: false,
  });

  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/winner HOME')),
    false
  );
  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/loser HOME')),
    false
  );
});

test('/chiatien uses the selected losing team for the water fee', async () => {
  const mock = createMockBot();
  const chiaTienCommand = loadCommand('chia-tien', mock.bot);
  const teamA = new Map([[1, { name: 'Alice' }]]);
  const teamB = new Map([
    [2, { name: 'Bob' }],
    [3, { name: 'Carol' }],
  ]);

  chiaTienCommand(
    () => 300000,
    () => 60000,
    () => 'AWAY',
    { teamA, teamB }
  );

  await invokeCommand(mock.handlers, '/chiatien');

  assert.match(
    mock.sentMessages.at(-1).message,
    /Mỗi người đội thắng: 100\.000 VND/
  );
  assert.match(
    mock.sentMessages.at(-1).message,
    /Mỗi người đội thua: 100\.000 \+ 30\.000 = \*130\.000 VND\*/
  );
});
