const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const {
  CHIATIEN_MESSAGES,
  createChiatienCommand,
} = require('./chiatien-command');

const EMPTY_FEE_STATE = Object.freeze({
  tiensan: 0,
  tiennuoc: 0,
  teamThua: null,
  teamA: [],
  teamB: [],
  team3A: [],
  team3B: [],
  team3C: [],
});

function createContext(args = []) {
  return {
    command: 'chiatien',
    args,
    actor: {
      platform: 'telegram',
      externalId: '123',
      displayName: 'Nghia',
      username: 'nghia',
    },
    conversation: {
      externalId: '456',
      threadId: null,
    },
  };
}

function createChiatienRouter(load) {
  return createCommandRouter({
    registry: createCommandRegistry([createChiatienCommand()]),
    stateRepository: createStateRepository({
      load,
      async save() {
        throw new Error('/chiatien must not save state');
      },
    }),
  });
}

test('independent /chiatien reports missing venue fee', async () => {
  const router = createChiatienRouter(async () => ({ ...EMPTY_FEE_STATE }));

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, CHIATIEN_MESSAGES.noFee);
  assert.equal(routed.result.messages[0].channel, 'default');
});

test('independent /chiatien distinguishes no teams from three teams', async () => {
  const states = [
    { ...EMPTY_FEE_STATE, tiensan: 300000 },
    {
      ...EMPTY_FEE_STATE,
      tiensan: 300000,
      team3A: [[1, { name: 'Extra player' }]],
    },
  ];
  const router = createChiatienRouter(async () => states.shift());

  const noTeams = await router.run(createContext());
  const threeTeams = await router.run(createContext());

  assert.equal(noTeams.result.messages[0].text, CHIATIEN_MESSAGES.noMembers);
  assert.equal(
    threeTeams.result.messages[0].text,
    CHIATIEN_MESSAGES.threeTeamUnsupported
  );
});

test('independent /chiatien returns an equal split without a result', async () => {
  const router = createChiatienRouter(async () => ({
    ...EMPTY_FEE_STATE,
    tiensan: 300000,
    teamA: [[1, { name: 'Alice' }]],
    teamB: [
      [2, { name: 'Bob' }],
      [3, { name: 'Carol' }],
    ],
  }));

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    '💸 Xem trước chia tiền\n' +
      'Tiền sân: 300.000 VND\n' +
      'Tiền nước: 0 VND (chưa tính vào phí)\n' +
      'Số người: 3\n\n' +
      '⚪ HOME (1 người):\n' +
      '• Alice: 100.000 VND\n\n' +
      '⚫ AWAY (2 người):\n' +
      '• Bob: 100.000 VND\n' +
      '• Carol: 100.000 VND'
  );
  assert.equal(routed.result.messages[0].channel, 'announcement');
});

test('independent /chiatien applies water to the selected losing team', async () => {
  const state = {
    ...EMPTY_FEE_STATE,
    tiensan: 300000,
    tiennuoc: 60000,
    teamThua: 'AWAY',
    teamA: [[1, { name: 'Alice_name' }]],
    teamB: [
      [2, { name: 'Bob' }],
      [3, { name: 'Carol' }],
    ],
  };
  const originalState = structuredClone(state);
  const router = createChiatienRouter(async () => state);

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    '💸 Xem trước chia tiền\n' +
      'Tiền sân: 300.000 VND\n' +
      'Tiền nước: 60.000 VND\n' +
      'Số người: 3\n\n' +
      '⚪ HOME (1 người):\n' +
      '• Alice_name: 100.000 VND\n\n' +
      '⚫ AWAY (2 người):\n' +
      '• Bob: 130.000 VND\n' +
      '• Carol: 130.000 VND'
  );
  assert.equal(routed.result.messages[0].channel, 'announcement');
  assert.deepEqual(state, originalState);
});

test('independent /chiatien handles invalid input and repository errors', async () => {
  const validRouter = createChiatienRouter(async () => ({
    ...EMPTY_FEE_STATE,
  }));
  const failingRouter = createChiatienRouter(async () => {
    throw new Error('API unavailable');
  });

  const invalidInput = await validRouter.run(createContext(['extra']));
  const loadError = await failingRouter.run(createContext());

  assert.equal(invalidInput.result.messages[0].text, CHIATIEN_MESSAGES.usage);
  assert.equal(loadError.result.messages[0].text, CHIATIEN_MESSAGES.loadError);
});
