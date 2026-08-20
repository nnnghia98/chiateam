const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('./command-registry');
const { createCommandRouter } = require('./command-router');
const { createPermissionPolicy } = require('../ports/permission-policy');
const { createStateRepository } = require('../ports/state-repository');

function createContext(command, args = []) {
  return {
    command,
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

function createRepository({ state = {}, onSave = () => {} } = {}) {
  return createStateRepository({
    async load(keys) {
      return keys.reduce((selected, key) => {
        selected[key] = state[key];
        return selected;
      }, {});
    },
    async save(changes) {
      onSave(changes);
      Object.assign(state, changes);
      return state;
    },
  });
}

test('registry finds a command by its name and alias', () => {
  const registry = createCommandRegistry();
  const definition = registry.register({
    name: 'manifests',
    aliases: ['mf'],
    instruction: {
      usage: '/manifests',
      description: 'Show team constraints',
      permission: 'player',
    },
    condition: async () => ({ ok: true }),
    action: async () => ({ changed: false }),
    reply: async () => ({ messages: [{ text: 'No manifests.' }] }),
  });

  assert.equal(registry.find('/manifests'), definition);
  assert.equal(registry.find('/MF@ChiaTeamBot'), definition);
  assert.deepEqual(registry.list(), [definition]);
});

test('registry rejects command and alias collisions', () => {
  const registry = createCommandRegistry();
  const baseDefinition = {
    name: 'team',
    aliases: [],
    instruction: {
      usage: '/team',
      description: 'Show teams',
      permission: 'player',
    },
    condition: async () => ({ ok: true }),
    action: async () => ({ changed: false }),
    reply: async () => ({ messages: [{ text: 'No teams.' }] }),
  };

  registry.register(baseDefinition);

  assert.throws(
    () =>
      registry.register({
        ...baseDefinition,
        name: 'other',
        aliases: ['team'],
      }),
    /already registered/
  );
});

test('router returns unhandled for commands outside the independent registry', async () => {
  let loadCount = 0;
  const repository = createStateRepository({
    async load() {
      loadCount += 1;
      return {};
    },
    async save() {},
  });
  const router = createCommandRouter({
    registry: createCommandRegistry(),
    stateRepository: repository,
  });

  const routed = await router.run(createContext('legacy-command'));

  assert.equal(routed.handled, false);
  assert.equal(routed.result, null);
  assert.equal(loadCount, 0);
});

test('router stops at a failed condition without action or state write', async () => {
  let actionCount = 0;
  let saveCount = 0;
  const registry = createCommandRegistry([
    {
      name: 'bench',
      aliases: [],
      instruction: {
        usage: '/bench',
        description: 'Show the bench',
        permission: 'player',
      },
      stateKeys: ['bench'],
      condition: async (context, state) => ({
        ok: state.bench.length > 0,
        code: 'EMPTY_BENCH',
      }),
      action: async () => {
        actionCount += 1;
        return { changed: false };
      },
      reply: async outcome => ({
        messages: [
          {
            text: outcome.code === 'EMPTY_BENCH' ? 'Bench is empty.' : 'Ready.',
          },
        ],
      }),
    },
  ]);
  const router = createCommandRouter({
    registry,
    stateRepository: createRepository({
      state: { bench: [] },
      onSave: () => {
        saveCount += 1;
      },
    }),
  });

  const routed = await router.run(createContext('bench'));

  assert.equal(routed.handled, true);
  assert.equal(routed.result.messages[0].text, 'Bench is empty.');
  assert.equal(actionCount, 0);
  assert.equal(saveCount, 0);
});

test('router checks command permission before loading state', async () => {
  let loadCount = 0;
  let actionCount = 0;
  const registry = createCommandRegistry([
    {
      name: 'add',
      aliases: [],
      instruction: {
        usage: '/add NAME',
        description: 'Add one guest',
        permission: 'admin',
      },
      stateKeys: ['bench'],
      condition: async () => ({ ok: true }),
      action: async () => {
        actionCount += 1;
        return { changed: false };
      },
      reply: async outcome => ({
        messages: [
          {
            text:
              outcome.code === 'PERMISSION_DENIED' ? 'Admin only.' : 'Ready.',
          },
        ],
      }),
    },
  ]);
  const router = createCommandRouter({
    registry,
    permissionPolicy: createPermissionPolicy({
      isAllowed: async () => false,
    }),
    stateRepository: createStateRepository({
      async load() {
        loadCount += 1;
        return { bench: [] };
      },
      async save() {},
    }),
  });

  const routed = await router.run(createContext('add', ['Guest']));

  assert.equal(routed.result.messages[0].text, 'Admin only.');
  assert.equal(loadCount, 0);
  assert.equal(actionCount, 0);
});

test('router resolves operation permission before loading state', async () => {
  const checkedPermissions = [];
  let loadCount = 0;
  const registry = createCommandRegistry([
    {
      name: 'san',
      aliases: [],
      instruction: {
        usage: '/san [NAME]',
        description: 'Read or update the venue',
        permission: 'player',
      },
      resolvePermission: context =>
        context.args.length > 0 ? 'admin' : 'player',
      stateKeys: ['san'],
      condition: async () => ({ ok: true }),
      action: async () => ({ changed: false }),
      reply: async outcome => ({
        messages: [
          {
            text:
              outcome.code === 'PERMISSION_DENIED'
                ? `${outcome.requiredPermission} only.`
                : 'Venue ready.',
          },
        ],
      }),
    },
  ]);
  const router = createCommandRouter({
    registry,
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) => {
        checkedPermissions.push(permission);
        return permission === 'player';
      },
    }),
    stateRepository: createStateRepository({
      async load() {
        loadCount += 1;
        return { san: null };
      },
      async save() {},
    }),
  });

  const readResult = await router.run(createContext('san'));
  const writeResult = await router.run(createContext('san', ['Field 1']));

  assert.equal(readResult.result.messages[0].text, 'Venue ready.');
  assert.equal(writeResult.result.messages[0].text, 'admin only.');
  assert.deepEqual(checkedPermissions, ['player', 'admin']);
  assert.equal(loadCount, 1);
});

test('router resolves operation state keys after permission', async () => {
  const loadedKeys = [];
  const registry = createCommandRegistry([
    {
      name: 'match',
      aliases: [],
      instruction: {
        usage: '/match ACTION',
        description: 'Read or save a match',
        permission: 'player',
      },
      stateKeys: [],
      resolveStateKeys: context =>
        context.args[0] === 'save' ? ['san', 'teamA', 'san'] : [],
      condition: async () => ({ ok: true }),
      action: async () => ({ changed: false }),
      reply: async () => ({ messages: [{ text: 'Match ready.' }] }),
    },
  ]);
  const router = createCommandRouter({
    registry,
    stateRepository: createStateRepository({
      async load(keys) {
        loadedKeys.push(keys);
        return { san: 'Field 1', teamA: [] };
      },
      async save() {},
    }),
  });

  await router.run(createContext('match', ['view']));
  await router.run(createContext('match', ['save']));

  assert.deepEqual(loadedKeys, [['san', 'teamA']]);
});

test('router runs instruction, condition, action, save, and reply once', async () => {
  const calls = [];
  const saved = [];
  const registry = createCommandRegistry([
    {
      name: 'add',
      aliases: [],
      instruction: {
        usage: '/add NAME',
        description: 'Add one player',
        permission: 'admin',
      },
      stateKeys: ['bench'],
      condition: async (context, state) => {
        calls.push(['condition', context.args[0], state.bench.length]);
        return { ok: true };
      },
      action: async (context, state) => {
        calls.push(['action', context.args[0]]);
        return {
          changed: true,
          changes: { bench: [...state.bench, context.args[0]] },
          addedName: context.args[0],
        };
      },
      reply: async outcome => {
        calls.push(['reply', outcome.addedName]);
        return {
          messages: [{ text: `${outcome.addedName} joined.` }],
        };
      },
    },
  ]);
  const router = createCommandRouter({
    registry,
    stateRepository: createRepository({
      state: { bench: ['Minh'] },
      onSave: changes => saved.push(changes),
    }),
  });

  const routed = await router.run(createContext('add', ['Nghia']));

  assert.deepEqual(calls, [
    ['condition', 'Nghia', 1],
    ['action', 'Nghia'],
    ['reply', 'Nghia'],
  ]);
  assert.deepEqual(saved, [{ bench: ['Minh', 'Nghia'] }]);
  assert.equal(routed.result.messages[0].text, 'Nghia joined.');
});

test('router returns a command reply when state save fails', async () => {
  const registry = createCommandRegistry([
    {
      name: 'addme',
      aliases: [],
      instruction: {
        usage: '/addme',
        description: 'Join the bench',
        permission: 'player',
      },
      stateKeys: ['bench'],
      condition: async () => ({ ok: true }),
      action: async () => ({
        changed: true,
        changes: { bench: ['Nghia'] },
      }),
      reply: async outcome => ({
        messages: [
          {
            text:
              outcome.code === 'STATE_SAVE_FAILED'
                ? 'Could not save bench.'
                : 'Joined.',
          },
        ],
      }),
    },
  ]);
  const router = createCommandRouter({
    registry,
    stateRepository: createStateRepository({
      async load() {
        return { bench: [] };
      },
      async save() {
        throw new Error('API unavailable');
      },
    }),
  });

  const routed = await router.run(createContext('addme'));

  assert.equal(routed.handled, true);
  assert.equal(routed.result.messages[0].text, 'Could not save bench.');
});
