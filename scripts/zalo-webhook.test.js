const test = require('node:test');
const assert = require('node:assert/strict');

const { runZaloWebhookCommand } = require('./zalo-webhook');

test('Zalo webhook command registers without logging secrets', async () => {
  const calls = [];
  const logs = [];
  const result = await runZaloWebhookCommand({
    action: 'set',
    env: {
      ZALO_WEBHOOK_URL: 'https://example.com/webhook/zalo',
      ZALO_WEBHOOK_SECRET: 'secret-123',
    },
    client: {
      async setWebhook(...args) {
        calls.push(args);
        return { url: args[0] };
      },
    },
    log: message => logs.push(message),
  });

  assert.deepEqual(calls, [['https://example.com/webhook/zalo', 'secret-123']]);
  assert.deepEqual(result, {
    url: 'https://example.com/webhook/zalo',
  });
  assert.equal(
    logs.some(message => message.includes('secret-123')),
    false
  );
});

test('Zalo webhook command reads and removes webhook configuration', async () => {
  const actions = [];
  const client = {
    async getWebhookInfo() {
      actions.push('info');
      return { url: 'https://example.com/webhook/zalo' };
    },
    async deleteWebhook() {
      actions.push('delete');
      return true;
    },
    async testWebhook() {
      actions.push('test');
      return { ok: true };
    },
  };

  await runZaloWebhookCommand({ action: 'info', client, log: () => {} });
  await runZaloWebhookCommand({ action: 'test', client, log: () => {} });
  await runZaloWebhookCommand({ action: 'delete', client, log: () => {} });
  assert.deepEqual(actions, ['info', 'test', 'delete']);
});

test('Zalo webhook command reports failed endpoint verification', async () => {
  await assert.rejects(
    runZaloWebhookCommand({
      action: 'set',
      env: {
        ZALO_WEBHOOK_URL: 'https://example.com/webhook/zalo',
        ZALO_WEBHOOK_SECRET: 'secret-123',
      },
      client: {
        setWebhook: async () => ({
          verification: { ok: false, outcome: 'webhook.http.500' },
        }),
      },
      log: () => {},
    }),
    /verification failed \(webhook\.http\.500\)/
  );
});
