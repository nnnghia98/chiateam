const test = require('node:test');
const assert = require('node:assert/strict');
const { createManagedLease } = require('./managed-lease');

test('managed lease stops receiver when renewal is denied', async () => {
  const calls = [];
  let lost = 0;
  const lease = createManagedLease({
    instanceId: 'instance-1',
    renewEveryMs: 5,
    client: {
      lease: async (_id, action) => {
        calls.push(action);
        return { granted: action === 'acquire' };
      },
    },
    onLost: () => {
      lost += 1;
    },
  });
  await lease.acquire();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(lost, 1);
  assert.deepEqual(calls.slice(0, 2), ['acquire', 'renew']);
});
