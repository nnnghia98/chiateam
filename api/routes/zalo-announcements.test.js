const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ensureZaloAnnouncementTables,
  createZaloAnnouncementRepository,
} = require('./zalo-announcements');

test('announcement tables are private, initialized once, and retried after bootstrap failure', async () => {
  const calls = [];
  let fail = true;
  const database = {
    async query(sql) {
      calls.push(sql);
      if (fail) throw new Error('database down');
      return {};
    },
  };
  await assert.rejects(ensureZaloAnnouncementTables(database));
  fail = false;
  await Promise.all([
    ensureZaloAnnouncementTables(database),
    ensureZaloAnnouncementTables(database),
  ]);
  assert.equal(calls.length, 2);
  assert.equal((calls[1].match(/ENABLE ROW LEVEL SECURITY/g) || []).length, 3);
  assert.doesNotMatch(calls[1], /DROP|TRUNCATE|UPDATE storage/);
});

test('broadcast repository parameterizes identities and claims drafts atomically', async () => {
  const calls = [];
  const database = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [], rowCount: 0 };
    },
  };
  const repository = createZaloAnnouncementRepository({ database });
  const p = {
    id: '11111111-1111-4111-8111-111111111111',
    actorId: "admin'",
    sourceChatId: 'chat',
    sourceThreadId: 'topic',
    message: "hello'; DROP TABLE storage; --",
  };
  await repository.prepare(p);
  assert.equal(await repository.claim(p), null);
  await repository.next({ id: p.id });
  assert.deepEqual(calls[1].values, [
    p.id,
    p.actorId,
    p.sourceChatId,
    p.sourceThreadId,
    p.message,
  ]);
  assert.doesNotMatch(calls[1].sql, /DROP TABLE storage/);
  assert.match(calls[2].sql, /status = 'draft' AND expires_at > NOW\(\)/);
  assert.match(calls[4].sql, /FOR UPDATE OF d SKIP LOCKED/);
  assert.match(calls[4].sql, /s.subscribed = TRUE/);
});
