const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { createStateRepository } = require('../core/ports/state-repository');
const { createAddCommand } = require('../core/use-cases/bench/add-command');
const { createAddmeCommand } = require('../core/use-cases/bench/addme-command');
const { createBenchCommand } = require('../core/use-cases/bench/bench-command');
const {
  createClearbenchCommand,
} = require('../core/use-cases/bench/clearbench-command');
const {
  createEditbenchCommand,
} = require('../core/use-cases/bench/editbench-command');
const {
  createChiateamCommand,
} = require('../core/use-cases/teams/chiateam-command');
const {
  createAddtoteamCommand,
} = require('../core/use-cases/teams/addtoteam-command');
const {
  createClearteamCommand,
} = require('../core/use-cases/teams/clearteam-command');
const {
  createManifestCommand,
} = require('../core/use-cases/teams/manifest-command');
const { createTeamCommand } = require('../core/use-cases/teams/team-command');
const {
  createManifestsCommand,
} = require('../core/use-cases/teams/manifests-command');
const {
  createRemovemanifestCommand,
} = require('../core/use-cases/teams/removemanifest-command');
const {
  createClearmanifestsCommand,
} = require('../core/use-cases/teams/clearmanifests-command');
const {
  createChiatienCommand,
} = require('../core/use-cases/management/chiatien-command');
const {
  createSanCommand,
} = require('../core/use-cases/management/san-command');
const {
  createClearsanCommand,
} = require('../core/use-cases/management/clearsan-command');
const {
  createTiensanCommand,
} = require('../core/use-cases/management/tiensan-command');
const {
  createTiennuocCommand,
} = require('../core/use-cases/management/tiennuoc-command');
const {
  createWinnerCommand,
} = require('../core/use-cases/management/winner-command');
const {
  createLoserCommand,
} = require('../core/use-cases/management/loser-command');
const {
  createTaovoteCommand,
} = require('../core/use-cases/management/taovote-command');
const {
  createDemvoteCommand,
} = require('../core/use-cases/management/demvote-command');
const {
  createTelegramAttendanceVotePublisher,
} = require('../platforms/telegram/attendance-vote-publisher');
const {
  createTelegramAttendanceVoteController,
} = require('../platforms/telegram/attendance-vote-controller');
const { createMatchRepository } = require('../core/ports/match-repository');
const {
  createMatchSummaryGenerator,
} = require('../core/ports/match-summary-generator');
const { createPlayerRepository } = require('../core/ports/player-repository');
const {
  createStatisticsRepository,
} = require('../core/ports/statistics-repository');
const {
  createTelegramBenchIdentityPolicy,
} = require('../platforms/telegram/bench-identity-policy');
const {
  createTelegramPermissionPolicy,
} = require('../platforms/telegram/permission-policy');
const { createCommandDefinitions } = require('./create-command-definitions');
const { startBotRuntime } = require('./start-bot');

class MockTelegramBot extends EventEmitter {
  constructor() {
    super();
    this.sentMessages = [];
    this.sentPolls = [];
    this.stoppedPolls = [];
    this.answeredCallbacks = [];
  }

  async sendMessage(chatId, text, options) {
    this.sentMessages.push({ chatId, text, options });
    return { ok: true };
  }

  async sendPoll(chatId, question, pollOptions, options) {
    this.sentPolls.push({ chatId, question, pollOptions, options });
    return {
      poll: { id: `poll-${this.sentPolls.length}` },
      message_id: 700 + this.sentPolls.length,
    };
  }

  async stopPoll(chatId, messageId) {
    this.stoppedPolls.push({ chatId, messageId });
    return { ok: true };
  }

  async answerCallbackQuery(id, options) {
    this.answeredCallbacks.push({ id, options });
    return { ok: true };
  }
}

function createEvent(text, from = {}) {
  return {
    text,
    from: { id: 123, first_name: 'Nghia', ...from },
    chat: { id: 456 },
  };
}

test('bot runtime routes migrated /bench and leaves legacy commands alone', async () => {
  const bot = new MockTelegramBot();
  const stateRepository = createStateRepository({
    async load() {
      return { bench: [[1, { name: 'Nghia' }]] };
    },
    async save() {
      throw new Error('/bench must not save state');
    },
  });
  const runtime = startBotRuntime({
    bot,
    stateRepository,
    definitions: [createBenchCommand()],
  });

  assert.equal(await runtime.adapter.handleEvent(createEvent('/addme')), false);
  assert.equal(await runtime.adapter.handleEvent(createEvent('/bench')), true);
  assert.equal(bot.sentMessages.length, 1);
  assert.match(bot.sentMessages[0].text, /1\. Nghia/);

  runtime.stop();
  assert.equal(bot.listenerCount('message'), 0);
});

test('bot runtime saves /addme with Telegram-compatible identity', async () => {
  const bot = new MockTelegramBot();
  const state = { bench: [] };
  const saves = [];
  const stateRepository = createStateRepository({
    async load(keys) {
      assert.deepEqual(keys, ['bench']);
      return { bench: state.bench };
    },
    async save(changes) {
      saves.push(changes);
      Object.assign(state, changes);
      return state;
    },
  });
  const runtime = startBotRuntime({
    bot,
    stateRepository,
    definitions: [
      createAddmeCommand({
        identityPolicy: createTelegramBenchIdentityPolicy(),
      }),
    ],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7', main: '8' },
    },
  });

  assert.equal(await runtime.adapter.handleEvent(createEvent('/addme')), true);
  assert.deepEqual(saves, [{ bench: [[123, { name: 'Nghia', userId: 123 }]] }]);
  assert.deepEqual(bot.sentMessages[0], {
    chatId: '-100999',
    text: '✅ Nghia lên bench!',
    options: { message_thread_id: '8' },
  });

  assert.equal(await runtime.adapter.handleEvent(createEvent('/addme')), true);
  assert.equal(saves.length, 1);
  assert.deepEqual(bot.sentMessages[1], {
    chatId: '-100999',
    text: '⚠️ Đã có tên Nghia trong bench.',
    options: { message_thread_id: '7' },
  });

  runtime.stop();
});

test('bot runtime enforces Telegram admin permission for atomic /add', async () => {
  const bot = new MockTelegramBot();
  const state = { bench: [] };
  const saves = [];
  let guestNumber = 0;
  const stateRepository = createStateRepository({
    async load() {
      return { bench: state.bench };
    },
    async save(changes) {
      saves.push(changes);
      Object.assign(state, changes);
      return state;
    },
  });
  const runtime = startBotRuntime({
    bot,
    stateRepository,
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    definitions: [
      createAddCommand({
        createGuestId: () => `guest:${++guestNumber}`,
      }),
    ],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7' },
    },
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/add Alice, Bob 1')),
    true
  );
  assert.deepEqual(saves, [
    {
      bench: [
        ['guest:1', { name: 'Alice', memberId: 'guest:1' }],
        ['guest:2', { name: 'Bob 1', memberId: 'guest:2' }],
      ],
    },
  ]);
  assert.match(bot.sentMessages[0].text, /Đã thêm 2 member/);

  assert.equal(
    await runtime.adapter.handleEvent(
      createEvent('/add Carol', { id: 999, first_name: 'Other' })
    ),
    true
  );
  assert.equal(saves.length, 1);
  assert.equal(bot.sentMessages[1].text, '⛔ Chỉ admin mới có quyền.');

  runtime.stop();
});

test('bot runtime completes the /editbench button and follow-up flow', async () => {
  const bot = new MockTelegramBot();
  const state = {
    bench: [
      [11, { name: 'Nghia', userId: 11 }],
      [22, { name: 'Minh', userId: 22 }],
    ],
  };
  const saves = [];
  let actionHandler = null;
  let unregistered = false;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load() {
        return { bench: state.bench };
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    registerTelegramActionHandler(handler) {
      actionHandler = handler;
      return () => {
        unregistered = true;
      };
    },
    definitions: [createEditbenchCommand()],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/editbench')),
    true
  );
  assert.equal(typeof actionHandler, 'function');
  assert.equal(
    bot.sentMessages[0].options.reply_markup.inline_keyboard[1][0]
      .callback_data,
    'core:cmd:/editbench 2'
  );

  assert.equal(
    await actionHandler({
      id: 'callback-editbench',
      data: 'core:cmd:/editbench 2',
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 99 },
    }),
    true
  );
  assert.match(bot.sentMessages[1].text, /Nhập tên mới cho Minh/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('Minh Mới')),
    true
  );
  assert.deepEqual(saves, [
    {
      bench: [
        [11, { name: 'Nghia', userId: 11 }],
        [22, { name: 'Minh Mới', userId: 22 }],
      ],
    },
  ]);
  assert.equal(bot.sentMessages[2].text, '✅ Đã đổi tên: Minh → Minh Mới');

  runtime.stop();
  assert.equal(unregistered, true);
});

test('bot runtime removes one /clearbench action and clears all directly', async () => {
  const bot = new MockTelegramBot();
  const state = {
    bench: [
      [11, { name: 'Nghia', userId: 11 }],
      [22, { name: 'Minh', userId: 22 }],
    ],
  };
  const saves = [];
  let actionHandler = null;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load() {
        return { bench: state.bench };
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    registerTelegramActionHandler(handler) {
      actionHandler = handler;
    },
    definitions: [createClearbenchCommand()],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/clearbench')),
    true
  );
  assert.equal(
    bot.sentMessages[0].options.reply_markup.inline_keyboard[1][0]
      .callback_data,
    'core:cmd:/clearbench 2'
  );
  assert.equal(
    bot.sentMessages[0].options.reply_markup.inline_keyboard.at(-1)[0]
      .callback_data,
    'core:cmd:/clearbench all'
  );

  assert.equal(
    await actionHandler({
      id: 'callback-clearbench-one',
      data: 'core:cmd:/clearbench 2',
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 99 },
    }),
    true
  );
  assert.deepEqual(saves, [{ bench: [[11, { name: 'Nghia', userId: 11 }]] }]);
  assert.equal(bot.sentMessages[1].text, '✅ Đã xóa Minh khỏi bench.');

  assert.equal(
    await actionHandler({
      id: 'callback-clearbench-all',
      data: 'core:cmd:/clearbench all',
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 100 },
    }),
    true
  );
  assert.deepEqual(saves[1], { bench: [] });
  assert.equal(
    bot.sentMessages[2].text,
    '✅ Đã xóa toàn bộ member khỏi bench.'
  );

  runtime.stop();
});

test('bot runtime assigns /chiateam atomically to the announcement channel', async () => {
  const bot = new MockTelegramBot();
  const state = {
    bench: [
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
      [3, { name: 'Carol', userId: 3 }],
      [4, { name: 'Dan', userId: 4 }],
    ],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
    manifest: null,
  };
  const saves = [];
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load() {
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7', announcement: '88' },
    },
    definitions: [createChiateamCommand({ random: () => 0 })],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/chiateam')),
    true
  );
  assert.equal(saves.length, 1);
  assert.deepEqual(Object.keys(saves[0]).sort(), ['teamA', 'teamB']);
  assert.equal(saves[0].teamA.length + saves[0].teamB.length, 4);
  assert.equal(bot.sentMessages[0].chatId, '-100999');
  assert.equal(bot.sentMessages[0].options.message_thread_id, '88');
  assert.equal(bot.sentMessages[0].options.parse_mode, 'MarkdownV2');
  assert.match(bot.sentMessages[0].text, /Chia team/);

  assert.equal(
    await runtime.adapter.handleEvent(
      createEvent('/chiateam 3', { id: 999, first_name: 'Other' })
    ),
    true
  );
  assert.equal(saves.length, 1);
  assert.equal(bot.sentMessages[1].text, '⛔ Chỉ admin mới có quyền.');
  assert.equal(bot.sentMessages[1].options.message_thread_id, '7');

  runtime.stop();
});

test('bot runtime completes the shared /addtoteam button flow atomically', async () => {
  const bot = new MockTelegramBot();
  const state = {
    bench: [
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
    ],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
  };
  const saves = [];
  let actionHandler = null;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load() {
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    registerTelegramActionHandler(handler) {
      actionHandler = handler;
    },
    definitions: [createAddtoteamCommand()],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/addtoteam HOME')),
    true
  );
  assert.equal(typeof actionHandler, 'function');
  assert.equal(
    bot.sentMessages[0].options.reply_markup.inline_keyboard[1][0]
      .callback_data,
    'core:cmd:/addtoteam 2 HOME 2'
  );

  assert.equal(
    await actionHandler({
      id: 'callback-addtoteam',
      data: 'core:cmd:/addtoteam 2 HOME 2',
      from: { id: 123, first_name: 'Nghia' },
      message: {
        chat: { id: 456 },
        message_thread_id: 10,
        message_id: 99,
      },
    }),
    true
  );
  assert.deepEqual(saves, [
    {
      teamA: [['team:tele:2', { name: 'Bob', userId: 2 }]],
    },
  ]);
  assert.equal(bot.sentMessages[1].chatId, '456');
  assert.equal(bot.sentMessages[1].options.message_thread_id, '10');
  assert.equal(bot.sentMessages[1].options.parse_mode, 'MarkdownV2');
  assert.match(bot.sentMessages[1].text, /Đã thêm 1 member/);

  assert.equal(
    await runtime.adapter.handleEvent(
      createEvent('/addtoteam 3 EXTRA all', {
        id: 999,
        first_name: 'Other',
      })
    ),
    true
  );
  assert.equal(saves.length, 1);
  assert.equal(bot.sentMessages[2].text, '⛔ Chỉ admin mới có quyền.');

  runtime.stop();
});

test('bot runtime confirms stack clear and removes team members by button', async () => {
  const bot = new MockTelegramBot();
  const state = {
    teamA: [
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
    ],
    teamB: [[3, { name: 'Carol', userId: 3 }]],
    team3A: [],
    team3B: [],
    team3C: [],
  };
  const saves = [];
  let actionHandler = null;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load() {
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    registerTelegramActionHandler(handler) {
      actionHandler = handler;
    },
    definitions: [createClearteamCommand()],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/clearteam HOME')),
    true
  );
  assert.equal(
    bot.sentMessages[0].options.reply_markup.inline_keyboard[1][0]
      .callback_data,
    'core:cmd:/clearteam 2 HOME 2'
  );

  assert.equal(
    await actionHandler({
      id: 'callback-clearteam-member',
      data: 'core:cmd:/clearteam 2 HOME 2',
      from: { id: 123, first_name: 'Nghia' },
      message: {
        chat: { id: 456 },
        message_thread_id: 10,
        message_id: 99,
      },
    }),
    true
  );
  assert.deepEqual(saves, [{ teamA: [[1, { name: 'Alice', userId: 1 }]] }]);
  assert.equal(bot.sentMessages[1].options.message_thread_id, '10');
  assert.match(bot.sentMessages[1].text, /Đã xóa 1 member/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/clearteam 2')),
    true
  );
  assert.equal(saves.length, 1);
  assert.equal(
    bot.sentMessages[2].options.reply_markup.inline_keyboard[0][0]
      .callback_data,
    'core:cmd:/clearteam 2 confirm'
  );

  assert.equal(
    await actionHandler({
      id: 'callback-clearteam-stack',
      data: 'core:cmd:/clearteam 2 confirm',
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 100 },
    }),
    true
  );
  assert.deepEqual(saves[1], { teamA: [], teamB: [] });
  assert.equal(
    bot.sentMessages[3].text,
    '✅ Đã xóa toàn bộ 2-team stack (HOME, AWAY).'
  );

  runtime.stop();
});

test('bot runtime completes the shared /manifest multi-step button flow', async () => {
  const bot = new MockTelegramBot();
  const state = {
    bench: [
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
      [3, { name: 'Carol', userId: 3 }],
    ],
    manifest: null,
  };
  const saves = [];
  let actionHandler = null;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load() {
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    registerTelegramActionHandler(handler) {
      actionHandler = handler;
    },
    definitions: [createManifestCommand()],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/manifest')),
    true
  );
  assert.equal(
    bot.sentMessages[0].options.reply_markup.inline_keyboard[0][0]
      .callback_data,
    'core:cmd:/manifest 1'
  );

  assert.equal(
    await actionHandler({
      id: 'callback-manifest-first',
      data: 'core:cmd:/manifest 1',
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 101 },
    }),
    true
  );
  assert.equal(
    bot.sentMessages[1].options.reply_markup.inline_keyboard[0][0]
      .callback_data,
    'core:cmd:/manifest 1 SAME'
  );

  assert.equal(
    await actionHandler({
      id: 'callback-manifest-relation',
      data: 'core:cmd:/manifest 1 SAME',
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 102 },
    }),
    true
  );
  assert.deepEqual(
    bot.sentMessages[2].options.reply_markup.inline_keyboard.map(
      row => row[0].callback_data
    ),
    ['core:cmd:/manifest 1 SAME 2', 'core:cmd:/manifest 1 SAME 3']
  );

  assert.equal(
    await actionHandler({
      id: 'callback-manifest-second',
      data: 'core:cmd:/manifest 1 SAME 2',
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 103 },
    }),
    true
  );
  assert.deepEqual(saves, [
    {
      manifest: [
        {
          relation: 'same',
          players: [
            { identity: 'tele:1', name: 'Alice' },
            { identity: 'tele:2', name: 'Bob' },
          ],
        },
      ],
    },
  ]);
  assert.match(bot.sentMessages[3].text, /Alice <3 Bob/);

  runtime.stop();
});

test('bot runtime translates migrated /team through the Telegram adapter', async () => {
  const bot = new MockTelegramBot();
  const stateRepository = createStateRepository({
    async load(keys) {
      assert.deepEqual(keys, ['teamA', 'teamB', 'team3A', 'team3B', 'team3C']);
      return {
        teamA: [[1, { name: 'Home' }]],
        teamB: [[2, { name: 'Away' }]],
        team3A: [],
        team3B: [],
        team3C: [],
      };
    },
    async save() {
      throw new Error('/team must not save state');
    },
  });
  const runtime = startBotRuntime({
    bot,
    stateRepository,
    definitions: [createBenchCommand(), createTeamCommand()],
  });

  assert.equal(await runtime.adapter.handleEvent(createEvent('/team 2')), true);
  assert.equal(bot.sentMessages.length, 1);
  assert.match(bot.sentMessages[0].text, /\*HOME \\\(1\\\):\*\nHome/);
  assert.match(bot.sentMessages[0].text, /\*AWAY \\\(1\\\):\*\nAway/);
  assert.equal(bot.sentMessages[0].options.parse_mode, 'MarkdownV2');

  runtime.stop();
});

test('bot runtime routes /manifests and its /mf transition alias once', async () => {
  const bot = new MockTelegramBot();
  const stateRepository = createStateRepository({
    async load(keys) {
      assert.deepEqual(keys, ['manifest']);
      return {
        manifest: {
          relation: 'different',
          players: [{ name: 'Alice' }, { name: 'Bob' }],
        },
      };
    },
    async save() {
      throw new Error('/manifests must not save state');
    },
  });
  const runtime = startBotRuntime({
    bot,
    stateRepository,
    definitions: [createManifestsCommand()],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/manifests')),
    true
  );
  assert.equal(await runtime.adapter.handleEvent(createEvent('/mf')), true);
  assert.equal(bot.sentMessages.length, 2);
  assert.match(bot.sentMessages[0].text, /Alice <\/3 Bob/);
  assert.doesNotMatch(bot.sentMessages[0].text, /\/mf/);
  assert.match(bot.sentMessages[1].text, /\/mf sẽ được thay thế/);
  assert.match(bot.sentMessages[1].text, /Alice <\/3 Bob/);

  runtime.stop();
});

test('bot runtime removes a manifest through a Telegram action', async () => {
  const bot = new MockTelegramBot();
  const state = {
    manifest: [
      {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Alice' },
          { identity: 'tele:2', name: 'Bob' },
        ],
      },
    ],
  };
  const saves = [];
  let actionHandler = null;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        assert.deepEqual(keys, ['manifest']);
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    registerTelegramActionHandler(handler) {
      actionHandler = handler;
    },
    definitions: [createRemovemanifestCommand()],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/removemanifest')),
    true
  );
  assert.equal(
    bot.sentMessages[0].options.reply_markup.inline_keyboard[0][0].callback_data.startsWith(
      'core:cmd:/removemanifest token '
    ),
    true
  );
  const callbackData =
    bot.sentMessages[0].options.reply_markup.inline_keyboard[0][0]
      .callback_data;

  assert.equal(
    await actionHandler({
      id: 'callback-remove-manifest',
      data: callbackData,
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 201 },
    }),
    true
  );
  assert.deepEqual(saves, [{ manifest: null }]);
  assert.equal(state.manifest, null);
  assert.equal(bot.sentMessages[1].text, '✅ Đã xóa manifest: Alice <3 Bob');

  assert.equal(
    await actionHandler({
      id: 'callback-remove-manifest-again',
      data: callbackData,
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 201 },
    }),
    true
  );
  assert.equal(saves.length, 1);
  assert.match(bot.sentMessages[2].text, /không còn tồn tại/);

  runtime.stop();
});

test('bot runtime clears manifests through a confirmed Telegram action', async () => {
  const bot = new MockTelegramBot();
  const state = {
    manifest: [
      {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Alice' },
          { identity: 'tele:2', name: 'Bob' },
        ],
      },
    ],
  };
  const saves = [];
  let actionHandler = null;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        assert.deepEqual(keys, ['manifest']);
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    registerTelegramActionHandler(handler) {
      actionHandler = handler;
    },
    definitions: [createClearmanifestsCommand()],
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/clearmanifests')),
    true
  );
  const confirmationButtons =
    bot.sentMessages[0].options.reply_markup.inline_keyboard;
  assert.equal(
    confirmationButtons[0][0].callback_data,
    'core:cmd:/clearmanifests confirm'
  );
  assert.equal(
    confirmationButtons[1][0].callback_data,
    'core:cmd:/clearmanifests cancel'
  );
  const confirmCallback = confirmationButtons[0][0].callback_data;

  assert.equal(
    await actionHandler({
      id: 'callback-clear-manifests',
      data: confirmCallback,
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 202 },
    }),
    true
  );
  assert.deepEqual(saves, [{ manifest: null }]);
  assert.equal(state.manifest, null);
  assert.equal(bot.sentMessages[1].text, '✅ Đã xóa tất cả manifest.');

  assert.equal(
    await actionHandler({
      id: 'callback-clear-manifests-again',
      data: confirmCallback,
      from: { id: 123, first_name: 'Nghia' },
      message: { chat: { id: 456 }, message_id: 202 },
    }),
    true
  );
  assert.equal(saves.length, 1);
  assert.equal(bot.sentMessages[2].text, 'Chưa có manifest nào.');

  runtime.stop();
});

test('bot runtime lets players read /san and only admins replace it', async () => {
  const bot = new MockTelegramBot();
  const state = { san: null };
  const saves = [];
  let loadCount = 0;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['san']);
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    definitions: [createSanCommand()],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7', announcement: '88' },
    },
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/san', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[0].text, /Chưa lưu sân nào/);

  assert.equal(
    await runtime.adapter.handleEvent(
      createEvent('/san Sân số 8', { id: 999 })
    ),
    true
  );
  assert.match(bot.sentMessages[1].text, /Chỉ admin/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/san Sân số 8')),
    true
  );
  assert.deepEqual(saves, [{ san: 'Sân số 8' }]);
  assert.equal(state.san, 'Sân số 8');
  assert.match(bot.sentMessages[2].text, /Đã lưu sân: Sân số 8/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/san', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[3].text, /Sân: Sân số 8/);
  assert.equal(loadCount, 3);
  assert.equal(bot.sentMessages[0].chatId, '-100999');
  assert.equal(bot.sentMessages[0].options.message_thread_id, '7');
  assert.equal(bot.sentMessages[3].chatId, '-100999');
  assert.equal(bot.sentMessages[3].options.message_thread_id, '88');

  runtime.stop();
});

test('bot runtime lets only admins clear the persistent venue', async () => {
  const bot = new MockTelegramBot();
  const state = { san: 'Sân số 8' };
  const saves = [];
  let loadCount = 0;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['san']);
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    definitions: [createClearsanCommand()],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7' },
    },
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/clearsan', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[0].text, /Chỉ admin/);
  assert.equal(loadCount, 0);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/clearsan')),
    true
  );
  assert.deepEqual(saves, [{ san: null }]);
  assert.equal(state.san, null);
  assert.match(bot.sentMessages[1].text, /Đã xóa sân/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/clearsan')),
    true
  );
  assert.equal(saves.length, 1);
  assert.match(bot.sentMessages[2].text, /Chưa lưu sân nào/);
  assert.equal(loadCount, 2);
  assert.equal(bot.sentMessages[1].chatId, '-100999');
  assert.equal(bot.sentMessages[1].options.message_thread_id, '7');

  runtime.stop();
});

test('bot runtime lets players read /tiensan and only admins update it', async () => {
  const bot = new MockTelegramBot();
  const state = { tiensan: 0 };
  const saves = [];
  let loadCount = 0;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['tiensan']);
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    definitions: [createTiensanCommand()],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7', announcement: '88' },
    },
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/tiensan', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[0].text, /Chưa thêm tiền sân/);

  assert.equal(
    await runtime.adapter.handleEvent(
      createEvent('/tiensan 500,000', { id: 999 })
    ),
    true
  );
  assert.match(bot.sentMessages[1].text, /Chỉ admin/);
  assert.equal(loadCount, 1);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/tiensan 500,000')),
    true
  );
  assert.deepEqual(saves, [{ tiensan: 500000 }]);
  assert.equal(state.tiensan, 500000);
  assert.match(bot.sentMessages[2].text, /Đã cập nhật tiền sân/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/tiensan', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[3].text, /Tiền sân hiện tại/);
  assert.equal(loadCount, 3);
  assert.equal(bot.sentMessages[0].chatId, '-100999');
  assert.equal(bot.sentMessages[0].options.message_thread_id, '7');
  assert.equal(bot.sentMessages[2].chatId, '-100999');
  assert.equal(bot.sentMessages[2].options.message_thread_id, '88');

  runtime.stop();
});

test('bot runtime lets players read /tiennuoc and only admins update it', async () => {
  const bot = new MockTelegramBot();
  const state = { tiennuoc: 0 };
  const saves = [];
  let loadCount = 0;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['tiennuoc']);
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    definitions: [createTiennuocCommand()],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7', announcement: '88' },
    },
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/tiennuoc', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[0].text, /Chưa thêm tiền nước/);

  assert.equal(
    await runtime.adapter.handleEvent(
      createEvent('/tiennuoc 60,000', { id: 999 })
    ),
    true
  );
  assert.match(bot.sentMessages[1].text, /Chỉ admin/);
  assert.equal(loadCount, 1);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/tiennuoc 60,000')),
    true
  );
  assert.deepEqual(saves, [{ tiennuoc: 60000 }]);
  assert.equal(state.tiennuoc, 60000);
  assert.match(bot.sentMessages[2].text, /Đã cập nhật tiền nước/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/tiennuoc', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[3].text, /Tiền nước hiện tại/);
  assert.equal(loadCount, 3);
  assert.equal(bot.sentMessages[0].chatId, '-100999');
  assert.equal(bot.sentMessages[0].options.message_thread_id, '7');
  assert.equal(bot.sentMessages[2].chatId, '-100999');
  assert.equal(bot.sentMessages[2].options.message_thread_id, '88');

  runtime.stop();
});

test('bot runtime migrates /winner and redirects transition /loser', async () => {
  const bot = new MockTelegramBot();
  const state = {
    tiensan: 300000,
    tiennuoc: 60000,
    teamThua: null,
    teamA: [[1, { name: 'Alice' }]],
    teamB: [
      [2, { name: 'Bob' }],
      [3, { name: 'Carol' }],
    ],
    team3A: [],
    team3B: [],
    team3C: [],
  };
  const saves = [];
  let loadCount = 0;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, [
          'tiensan',
          'tiennuoc',
          'teamThua',
          'teamA',
          'teamB',
          'team3A',
          'team3B',
          'team3C',
        ]);
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    definitions: [createWinnerCommand(), createLoserCommand()],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7', announcement: '88' },
    },
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/winner', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[0].text, /Chưa chọn team thắng/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/winner HOME', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[1].text, /Chỉ admin/);
  assert.equal(loadCount, 1);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/winner HOME')),
    true
  );
  assert.deepEqual(saves, [{ teamThua: 'AWAY' }]);
  assert.equal(state.teamThua, 'AWAY');
  assert.match(bot.sentMessages[2].text, /HOME/);
  assert.match(bot.sentMessages[2].text, /AWAY/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/winner', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[3].text, /Team thắng hiện tại/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/loser HOME', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[4].text, /\/winner AWAY/);
  assert.equal(loadCount, 3);
  assert.deepEqual(saves, [{ teamThua: 'AWAY' }]);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/teamthang HOME')),
    false
  );
  assert.equal(bot.sentMessages.length, 5);
  assert.equal(bot.sentMessages[0].options.message_thread_id, '7');
  assert.equal(bot.sentMessages[2].options.message_thread_id, '88');
  assert.equal(bot.sentMessages[4].options.message_thread_id, '7');

  runtime.stop();
});

test('bot runtime creates one shared /taovote as a Telegram native poll', async () => {
  const bot = new MockTelegramBot();
  const state = { activeVote: null };
  const saves = [];
  let loadCount = 0;
  const telegramChannelConfig = {
    chatId: '-100999',
    threads: { default: '7', announcement: '88' },
  };
  const votePublisher = createTelegramAttendanceVotePublisher({
    bot,
    channelConfig: telegramChannelConfig,
  });
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['activeVote']);
        return state;
      },
      async save(changes) {
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    definitions: [
      createTaovoteCommand({
        votePublisher,
        now: () => new Date('2026-08-10T10:00:00.000Z'),
      }),
    ],
    telegramChannelConfig,
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/taovote', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[0].text, /Vote có 5 lựa chọn/);

  assert.equal(
    await runtime.adapter.handleEvent(
      createEvent('/taovote Sân A 20h', { id: 999 })
    ),
    true
  );
  assert.match(bot.sentMessages[1].text, /Chỉ admin/);
  assert.equal(loadCount, 1);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/taovote Sân A 20h')),
    true
  );
  assert.equal(bot.sentPolls.length, 1);
  assert.deepEqual(bot.sentPolls[0].pollOptions, ['0', '+1', '+2', '+3', '+4']);
  assert.equal(bot.sentPolls[0].chatId, '-100999');
  assert.equal(bot.sentPolls[0].options.message_thread_id, '88');
  assert.equal(state.activeVote.id, 'poll-1');
  assert.equal(state.activeVote.platform, 'telegram');
  assert.equal(state.activeVote.question, 'Sân A 20h');
  assert.equal(saves.length, 1);
  assert.match(bot.sentMessages[2].text, /Đã tạo vote/);

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/taovote Vote khác')),
    true
  );
  assert.equal(bot.sentPolls.length, 1);
  assert.equal(saves.length, 1);
  assert.match(bot.sentMessages[3].text, /đã có một vote/);
  assert.equal(loadCount, 3);
  assert.equal(bot.sentMessages[2].options.message_thread_id, '7');

  runtime.stop();
});

test('bot runtime renders migrated /demvote from normalized vote choices', async () => {
  const bot = new MockTelegramBot();
  const state = { activeVote: null };
  let loadCount = 0;
  let saveCount = 0;
  const runtime = startBotRuntime({
    bot,
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['activeVote']);
        return state;
      },
      async save() {
        saveCount += 1;
        return state;
      },
    }),
    definitions: [createDemvoteCommand()],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { default: '7', main: '55' },
    },
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/demvote', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[0].text, /Không có vote/);

  state.activeVote = {
    id: 'poll-1',
    question: 'Sân A 20h',
    options: ['0', '+1', '+2', '+3', '+4'],
    votes: {
      1: { id: 1, name: 'Alice', options: [2] },
      2: { id: 2, name: 'Bob', choice: '0' },
    },
  };

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/demvote', { id: 999 })),
    true
  );
  assert.match(bot.sentMessages[1].text, /Sân A 20h/);
  assert.match(bot.sentMessages[1].text, /Alice/);
  assert.match(bot.sentMessages[1].text, /Số người vote:\* 2/);
  assert.equal(bot.sentMessages[1].options.message_thread_id, '55');

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/demvote extra')),
    true
  );
  assert.match(bot.sentMessages[2].text, /không kèm tham số/);
  assert.equal(bot.sentMessages[2].options.message_thread_id, '7');
  assert.equal(loadCount, 3);
  assert.equal(saveCount, 0);

  runtime.stop();
});

test('bot runtime sends migrated /chiatien to the announcement channel', async () => {
  const bot = new MockTelegramBot();
  const stateRepository = createStateRepository({
    async load() {
      return {
        tiensan: 300000,
        tiennuoc: 60000,
        teamThua: 'AWAY',
        teamA: [[1, { name: 'Alice' }]],
        teamB: [[2, { name: 'Bob' }]],
        team3A: [],
        team3B: [],
        team3C: [],
      };
    },
    async save() {
      throw new Error('/chiatien must not save state');
    },
  });
  const runtime = startBotRuntime({
    bot,
    stateRepository,
    definitions: [createChiatienCommand()],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { announcement: '88' },
    },
  });

  assert.equal(
    await runtime.adapter.handleEvent(createEvent('/chiatien')),
    true
  );
  assert.equal(bot.sentMessages.length, 1);
  assert.equal(bot.sentMessages[0].chatId, '-100999');
  assert.equal(bot.sentMessages[0].options.message_thread_id, '88');
  assert.equal(bot.sentMessages[0].options.parse_mode, 'MarkdownV2');
  assert.match(bot.sentMessages[0].text, /Mỗi người đội thua/);

  runtime.stop();
});

test('Telegram runtime routes the complete shared command catalog', async () => {
  const bot = new MockTelegramBot();
  const state = {
    bench: [],
    teamA: [[1, { name: 'Alice', userId: 1 }]],
    teamB: [[2, { name: 'Bob', userId: 2 }]],
    team3A: [],
    team3B: [],
    team3C: [],
    manifest: null,
    san: 'Sân A',
    tiensan: 500000,
    tiennuoc: 80000,
    teamThua: 'AWAY',
    activeVote: {
      id: 'poll-1',
      platform: 'telegram',
      chatId: '-100999',
      messageId: 77,
      question: 'Sân A 20h',
      options: ['0', '+1', '+2', '+3', '+4'],
      votes: {
        123: { id: 123, name: 'Nghia', choice: '+2' },
      },
    },
  };
  let player = null;
  let stats = null;
  const playerRepository = createPlayerRepository({
    async registerActor(actor, number) {
      player = {
        id: 100,
        user_id: Number(actor.externalId),
        name: actor.displayName,
        username: actor.username,
        number,
      };
      return { ok: true, player };
    },
    async registerGuest(name, number) {
      return { ok: true, player: { id: 101, name, number } };
    },
    async deleteByNumber() {
      return { ok: true };
    },
    async findByActor(actor) {
      return player?.user_id === Number(actor.externalId) ? player : null;
    },
    async findByNumber(number) {
      return player?.number === number ? player : null;
    },
    async list() {
      return player ? [player] : [];
    },
  });
  const statisticsRepository = createStatisticsRepository({
    async findByNumber(number) {
      return stats?.player_number === number ? stats : null;
    },
    async findMany(numbers) {
      return stats && numbers.includes(stats.player_number) ? [stats] : [];
    },
    async replaceTotals(number, totals) {
      stats = {
        player_number: number,
        total_match: totals.matches,
        total_win: totals.wins,
        total_lose: totals.losses,
        total_draw: totals.draws,
        goal: 0,
        assist: 0,
        winrate: totals.matches > 0 ? totals.wins / totals.matches : 0,
      };
    },
    async incrementGoals() {
      return { ok: true };
    },
    async incrementAssists() {
      return { ok: true };
    },
  });
  const detail = {
    id: 1,
    match_date: '2026-08-06',
    san: 'Sân A',
    tiensan: 500000,
    home_score: 3,
    away_score: 1,
    homePlayers: [{ label: 'Nghia - 10' }],
    awayPlayers: [{ label: 'Bob - 11' }],
    extraPlayers: [],
  };
  const matchRepository = createMatchRepository({
    async findByDate() {
      return detail;
    },
    async findWithPlayers() {
      return detail;
    },
    async save() {
      return detail;
    },
    async updateScore() {
      return detail;
    },
    async applyResult() {
      return { unchanged: false, winners: 1, losers: 0 };
    },
    async syncPlayerLinks() {
      return null;
    },
    async deleteByDate() {
      return true;
    },
    async list() {
      return [detail];
    },
    async containsPlayer() {
      return true;
    },
    async addPlayerStat() {},
    async setMvp() {},
  });
  const stateRepository = createStateRepository({
    async load(keys) {
      return keys.reduce((selected, key) => {
        selected[key] = state[key];
        return selected;
      }, {});
    },
    async save(changes) {
      Object.assign(state, changes);
      return state;
    },
  });
  const votePublisher = createTelegramAttendanceVotePublisher({ bot });
  const voteController = createTelegramAttendanceVoteController({ bot });
  const runtime = startBotRuntime({
    bot,
    stateRepository,
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    definitions: createCommandDefinitions({
      benchIdentityPolicy: createTelegramBenchIdentityPolicy(),
      votePublisher,
      voteController,
      playerRepository,
      statisticsRepository,
      matchRepository,
      matchSummaryGenerator: createMatchSummaryGenerator({
        async generate() {
          return 'HOME thắng đẹp.';
        },
      }),
    }),
    telegramChannelConfig: {
      chatId: '-100999',
      threads: {
        default: '7',
        main: '8',
        statistics: '9',
        announcement: '10',
      },
    },
  });
  const commands = [
    '/start',
    '/register 10',
    '/edit-stats 10 matches=8 wins=5 losses=2 draws=1',
    '/me',
    '/players',
    '/player 10',
    '/match view 06/08/2026',
    '/matches',
    '/sync',
    '/clearvote confirm',
    '/reset',
  ];

  for (const command of commands) {
    assert.equal(await runtime.adapter.handleEvent(createEvent(command)), true);
  }

  assert.equal(bot.sentMessages.length, commands.length);
  assert.match(bot.sentMessages[0].text, /CHIATEAM BOT/);
  assert.match(bot.sentMessages[1].text, /Đăng ký thành công/);
  assert.match(bot.sentMessages[2].text, /CẬP NHẬT THỐNG KÊ/);
  assert.match(bot.sentMessages[3].text, /Số áo: 10/);
  assert.match(bot.sentMessages[4].text, /Nghia/);
  assert.match(bot.sentMessages[5].text, /Tỷ lệ thắng/);
  assert.match(bot.sentMessages[6].text, /HOME thắng đẹp/);
  assert.match(bot.sentMessages[7].text, /06\/08\/2026/);
  assert.match(bot.sentMessages[8].text, /ĐÃ ĐỒNG BỘ TỪ VOTE/);
  assert.match(bot.sentMessages[9].text, /Đã đóng và xóa vote/);
  assert.match(bot.sentMessages[10].text, /ĐÃ RESET/);
  assert.deepEqual(bot.stoppedPolls, [{ chatId: '-100999', messageId: 77 }]);
  assert.deepEqual(state.bench, []);
  assert.equal(state.activeVote, null);

  runtime.stop();
});
