const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { COMMAND_MANIFEST } = require('../../commands/command-manifest');
const { createStateRepository } = require('../../ports/state-repository');
const { createStartCommand } = require('./start-command');

test('independent /start generates help from the supported manifest', async () => {
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createStartCommand()]),
    stateRepository: createStateRepository({
      async load() {
        loadCount += 1;
        return {};
      },
      async save() {
        throw new Error('/start must not save');
      },
    }),
  });

  const routed = await router.run({
    command: 'start',
    args: ['telegram-deep-link-payload'],
    actor: {
      platform: 'telegram',
      externalId: '123',
      displayName: 'Nghia',
    },
    conversation: { externalId: '456', threadId: null },
  });
  const message = routed.result.messages[0];

  COMMAND_MANIFEST.forEach(entry => {
    assert.match(
      message.text,
      new RegExp(entry.usage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  });
  assert.match(message.text, /alias: \/mf/);
  assert.equal(message.channel, 'main');
  assert.equal(message.segments[0].bold, true);
  assert.equal(loadCount, 0);
});
