const test = require('node:test');
const assert = require('node:assert/strict');
const { createTwoNikeService } = require('./two-nike-service');

function createRepository() {
  const calls = [];
  return {
    calls,
    async listTwoNikesByVideoId(videoId) {
      calls.push(['list', videoId]);
      return [];
    },
    async insertTwoNike(payload) {
      calls.push(['insert', payload]);
      return { id: 1, ...payload, timestamp: '01:30' };
    },
  };
}

test('listTwoNikes requires a YouTube video ID', async () => {
  const repository = createRepository();
  const service = createTwoNikeService(repository);

  assert.deepEqual(await service.listTwoNikes('bad'), {
    ok: false,
    code: 'INVALID_VIDEO_ID',
  });
  assert.equal(repository.calls.length, 0);

  assert.deepEqual(await service.listTwoNikes('Q-FaES-lifU'), {
    ok: true,
    twoNikes: [],
  });
  assert.deepEqual(repository.calls, [['list', 'Q-FaES-lifU']]);
});

test('createTwoNike trims text and stores a valid timestamp', async () => {
  const repository = createRepository();
  const service = createTwoNikeService(repository);
  const result = await service.createTwoNike({
    videoId: 'Q-FaES-lifU',
    title: '  Team entrance  ',
    timestampSeconds: 90,
    createdBy: '  Nghia  ',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(repository.calls[0], [
    'insert',
    {
      videoId: 'Q-FaES-lifU',
      title: 'Team entrance',
      timestampSeconds: 90,
      createdBy: 'Nghia',
    },
  ]);
});

test('trusted creator overrides the submitted creator name', async () => {
  const repository = createRepository();
  const service = createTwoNikeService(repository);
  await service.createTwoNike(
    {
      videoId: 'Q-FaES-lifU',
      title: 'Team entrance',
      timestampSeconds: 90,
      createdBy: 'Submitted name',
    },
    'Trusted user'
  );

  assert.equal(repository.calls[0][1].createdBy, 'Trusted user');
});

test('createTwoNike rejects invalid timestamps before persistence', async () => {
  const repository = createRepository();
  const service = createTwoNikeService(repository);
  const result = await service.createTwoNike({
    videoId: 'Q-FaES-lifU',
    title: 'Team entrance',
    timestampSeconds: 90.5,
    createdBy: 'Nghia',
  });

  assert.deepEqual(result, {
    ok: false,
    code: 'INVALID_TIMESTAMP_SECONDS',
  });
  assert.equal(repository.calls.length, 0);
});
