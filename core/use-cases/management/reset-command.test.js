const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const {
  createAttendanceVoteController,
} = require('../../ports/attendance-vote-controller');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  RESET_MESSAGES,
  RESET_STATE_KEYS,
  createResetCommand,
  parseResetRequest,
} = require('./reset-command');

function createContext(args = [], actorId = '123') {
  return {
    command: 'reset',
    args,
    actor: { platform: 'telegram', externalId: actorId },
    conversation: { externalId: '456', threadId: null },
  };
}

function createResetRouter({ isAdmin = true, loadError, saveError } = {}) {
  const state = {
    bench: [[1, { name: 'Alice' }]],
    teamA: [[1, { name: 'Alice' }]],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
    manifest: [{ relation: 'same' }],
    san: 'Sân A',
    tiensan: 500000,
    tiennuoc: 80000,
    teamThua: 'AWAY',
    activeVote: { platform: 'telegram', chatId: '456', messageId: 77 },
  };
  const loads = [];
  const saves = [];
  const closes = [];
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createResetCommand({
        voteController: createAttendanceVoteController({
          async close(reference) {
            closes.push(reference);
            return { closed: true };
          },
        }),
      }),
    ]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loads.push(keys);
        if (loadError) throw loadError;
        return keys.reduce((selected, key) => {
          selected[key] = state[key];
          return selected;
        }, {});
      },
      async save(changes) {
        if (saveError) throw saveError;
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
  });

  return { router, state, loads, saves, closes };
}

test('shared /reset parser supports confirmation and cancel', () => {
  assert.deepEqual(parseResetRequest([]), { kind: 'confirm' });
  assert.deepEqual(parseResetRequest(['CONFIRM']), { kind: 'reset' });
  assert.deepEqual(parseResetRequest(['cancel']), { kind: 'cancel' });
  assert.equal(parseResetRequest(['now']), null);
});

test('independent /reset asks before loading or changing state', async () => {
  const { router, loads, saves, closes } = createResetRouter();

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, RESET_MESSAGES.confirmation);
  assert.equal(routed.result.messages[0].actions.length, 2);
  assert.deepEqual(loads, []);
  assert.deepEqual(saves, []);
  assert.deepEqual(closes, []);
});

test('independent /reset closes vote and saves one full reset', async () => {
  const { router, state, loads, saves, closes } = createResetRouter();

  const routed = await router.run(createContext(['confirm']));

  assert.deepEqual(loads, [RESET_STATE_KEYS]);
  assert.equal(closes.length, 1);
  assert.equal(saves.length, 1);
  assert.deepEqual(state.bench, []);
  assert.deepEqual(state.teamA, []);
  assert.equal(state.san, null);
  assert.equal(state.tiensan, 0);
  assert.equal(state.activeVote, null);
  assert.equal(routed.result.messages[0].channel, 'announcement');
  assert.equal(routed.result.messages[0].text, RESET_MESSAGES.success);
});

test('independent /reset handles cancel, permission, and storage errors', async () => {
  const current = createResetRouter();
  const denied = createResetRouter({ isAdmin: false });
  const loadFailure = createResetRouter({
    loadError: new Error('storage unavailable'),
  });
  const saveFailure = createResetRouter({
    saveError: new Error('storage unavailable'),
  });

  const cancel = await current.router.run(createContext(['cancel']));
  const deniedResult = await denied.router.run(
    createContext(['confirm'], '999')
  );
  const loadResult = await loadFailure.router.run(createContext(['confirm']));
  const saveResult = await saveFailure.router.run(createContext(['confirm']));

  assert.equal(cancel.result.messages[0].text, RESET_MESSAGES.cancelled);
  assert.equal(
    deniedResult.result.messages[0].text,
    RESET_MESSAGES.permissionDenied
  );
  assert.deepEqual(denied.loads, []);
  assert.equal(loadResult.result.messages[0].text, RESET_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, RESET_MESSAGES.saveError);
});
