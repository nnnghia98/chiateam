const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createZaloAnnouncementRepository,
  ensureZaloAnnouncementTables,
} = require('./zalo-announcements');
const { createZaloAnnouncementService } = require('../services/zalo-announcement-service');

test('announcement image schema migration is repeatable and preserves drafts', {
  skip: !process.env.BROADCAST_TEST_PGLITE_MODULE,
  timeout: 60000,
}, async t => {
  const { PGlite } = require(process.env.BROADCAST_TEST_PGLITE_MODULE);
  const pg = new PGlite();
  t.after(() => pg.close());
  const database = {
    async query(sql, values) {
      if (values === undefined) {
        await pg.exec(sql);
        return { rows: [], rowCount: 0 };
      }
      const result = await pg.query(sql, values);
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    },
  };
  await pg.exec(`CREATE TABLE zalo_announcements (
    id UUID PRIMARY KEY, actor_id TEXT NOT NULL, source_chat_id TEXT NOT NULL,
    source_thread_id TEXT NOT NULL, message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'sending', 'finished', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT zalo_announcements_message_check CHECK (char_length(message) BETWEEN 1 AND 2000)
  );
  CREATE TABLE zalo_announcement_subscriptions (
    chat_id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, subscribed BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  INSERT INTO zalo_announcement_subscriptions(chat_id,user_id,subscribed)
    VALUES ('legacy-chat','legacy-user',TRUE);
  INSERT INTO zalo_announcements
    (id, actor_id, source_chat_id, source_thread_id, message, status, expires_at)
    VALUES ('22222222-2222-4222-8222-222222222222', 'legacy-admin', 'legacy-source', '',
      'Legacy text draft', 'draft', NOW() + INTERVAL '10 minutes');`);

  await Promise.all([
    ensureZaloAnnouncementTables(database),
    ensureZaloAnnouncementTables(database),
  ]);
  await ensureZaloAnnouncementTables(database);
  const databaseAgain = {
    async query(sql, values) {
      if (values === undefined) {
        await pg.exec(sql);
        return { rows: [], rowCount: 0 };
      }
      const result = await pg.query(sql, values);
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    },
  };
  await ensureZaloAnnouncementTables(databaseAgain);
  const legacy = (await pg.query('SELECT * FROM zalo_announcement_subscriptions')).rows;
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].user_id, 'legacy-user');

  const repository = createZaloAnnouncementRepository({ database });
  const service = createZaloAnnouncementService({
    repository,
    createId: () => '11111111-1111-4111-8111-111111111111',
  });
  const source = {
    platform: 'telegram', actorId: 'admin', sourceChatId: 'source', sourceThreadId: '',
  };
  const legacyClaim = await service.claim({
    id: '22222222-2222-4222-8222-222222222222',
    actorId: 'legacy-admin', sourceChatId: 'legacy-source', sourceThreadId: '',
    platform: 'telegram',
  });
  assert.deepEqual(legacyClaim.result, {
    id: '22222222-2222-4222-8222-222222222222',
    message: 'Legacy text draft',
  });
  const photo = 'https://cdn.example/photo.jpg';
  const prepared = await service.prepare({ ...source, message: '', photoUrl: photo });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.result.total, 1);
  const claimed = await service.claim({ ...source, id: prepared.result.id });
  assert.deepEqual(claimed.result, { id: prepared.result.id, message: '', photoUrl: photo });

  const replacement = createZaloAnnouncementRepository({ database });
  const afterReplacement = await replacement.claim({ ...source, id: prepared.result.id });
  assert.equal(afterReplacement, null);
  assert.equal(
    (await pg.query('SELECT photo_url FROM zalo_announcements WHERE id = $1', [prepared.result.id])).rows[0].photo_url,
    photo
  );

  for (const message of ['x'.repeat(2001), '']) {
    const response = await service.prepare({ ...source, message, ...(message ? {} : { photoUrl: undefined }) });
    assert.equal(response.ok, false);
    assert.equal(response.code, 'INVALID_ANNOUNCEMENT_REQUEST');
  }

  await assert.rejects(
    pg.query(
      `INSERT INTO zalo_announcements
       (id, actor_id, source_chat_id, source_thread_id, message, photo_url, status, expires_at)
       VALUES ('33333333-3333-4333-8333-333333333333', 'a', 's', '', $1, 'https://cdn.example/p.jpg', 'draft', NOW())`,
      ['x'.repeat(2001)]
    )
  );
  await assert.rejects(
    pg.query(
      `INSERT INTO zalo_announcements
       (id, actor_id, source_chat_id, source_thread_id, message, photo_url, status, expires_at)
       VALUES ('44444444-4444-4444-8444-444444444444', 'a', 's', '', NULL, 'https://cdn.example/p.jpg', 'draft', NOW())`
    )
  );
});
