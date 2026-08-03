const test = require('node:test');
const assert = require('node:assert/strict');

const poolQueries = [];
const clients = [];
let nextClient;

const db = {
  async query(sql, values) {
    poolQueries.push({ sql, values });

    if (sql.includes('UPDATE match_highlights')) {
      return {
        rows: [
          {
            id: 501,
            match_id: 42,
            timestamp_seconds: 930,
            caption: values[0],
            preferred_source_slot: null,
            created_by: 'admin@example.com',
            created_at: '2026-07-29T00:00:00.000Z',
            updated_at: '2026-07-29T00:00:00.000Z',
          },
        ],
      };
    }

    return { rows: [], rowCount: 0 };
  },
  async connect() {
    clients.push(nextClient);
    return nextClient;
  },
};

const configPath = require.resolve('../db/config');
require.cache[configPath] = {
  id: configPath,
  filename: configPath,
  loaded: true,
  exports: { db },
};

const {
  replaceVideoSources,
  updateHighlight,
} = require('./match-media-service');

function createClient(queryHandler) {
  const queries = [];
  let releaseCount = 0;

  return {
    queries,
    get releaseCount() {
      return releaseCount;
    },
    async query(sql, values) {
      queries.push({ sql, values });
      return queryHandler(sql, values);
    },
    release() {
      releaseCount += 1;
    },
  };
}

test('replaceVideoSources uses one client transaction and typed slot array', async () => {
  const sourceRow = {
    id: 101,
    match_id: 42,
    slot: 1,
    provider: 'youtube',
    video_id: 'dQw4w9WgXcQ',
    source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Cam 1',
    offset_seconds: 12,
    created_at: '2026-07-29T00:00:00.000Z',
    updated_at: '2026-07-29T00:00:00.000Z',
  };

  nextClient = createClient(async sql => {
    if (sql.includes('SELECT id FROM matches')) {
      return { rows: [{ id: 42 }] };
    }
    if (sql.includes('FROM match_video_sources') && sql.includes('SELECT')) {
      return { rows: [sourceRow] };
    }
    return { rows: [], rowCount: 1 };
  });

  const result = await replaceVideoSources(42, {
    sources: [
      {
        slot: 1,
        url: sourceRow.source_url,
        title: 'Cam 1',
        offsetSeconds: 12,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.sources[0].id, 101);
  assert.equal(clients.length, 1);
  assert.equal(nextClient.releaseCount, 1);
  assert.equal(nextClient.queries[0].sql, 'BEGIN');
  assert.equal(nextClient.queries.at(-1).sql, 'COMMIT');

  const omittedSlotDelete = nextClient.queries.find(({ sql }) =>
    sql.includes('slot <> ALL($2::smallint[])')
  );
  assert.deepEqual(omittedSlotDelete.values, [42, [1]]);

  const poolDataQueries = poolQueries.filter(
    ({ sql }) => !sql.includes('CREATE TABLE') && !sql.includes('CREATE INDEX')
  );
  assert.deepEqual(poolDataQueries, []);
});

test('replaceVideoSources rolls back once and releases when match is absent', async () => {
  nextClient = createClient(async sql => {
    if (sql.includes('SELECT id FROM matches')) return { rows: [] };
    return { rows: [], rowCount: 0 };
  });

  const result = await replaceVideoSources(42, { sources: [] });

  assert.deepEqual(result, { ok: false, code: 'MATCH_NOT_FOUND' });
  assert.equal(
    nextClient.queries.filter(({ sql }) => sql === 'ROLLBACK').length,
    1
  );
  assert.equal(nextClient.releaseCount, 1);
  assert.equal(
    nextClient.queries.some(({ sql }) => sql === 'COMMIT'),
    false
  );
});

test('replaceVideoSources rolls back once and releases after a SQL error', async () => {
  const databaseError = new Error('database write failed');
  nextClient = createClient(async sql => {
    if (sql.includes('SELECT id FROM matches')) {
      return { rows: [{ id: 42 }] };
    }
    if (sql.includes('INSERT INTO match_video_sources')) throw databaseError;
    return { rows: [], rowCount: 0 };
  });

  await assert.rejects(
    replaceVideoSources(42, {
      sources: [
        {
          slot: 1,
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      ],
    }),
    databaseError
  );

  assert.equal(
    nextClient.queries.filter(({ sql }) => sql === 'ROLLBACK').length,
    1
  );
  assert.equal(nextClient.releaseCount, 1);
});

test('updateHighlight builds correct placeholders for a partial update', async () => {
  const result = await updateHighlight(42, 501, { caption: '  Updated  ' });
  const updateQuery = poolQueries.find(({ sql }) =>
    sql.includes('UPDATE match_highlights')
  );

  assert.equal(result.ok, true);
  assert.equal(result.highlight.caption, 'Updated');
  assert.match(updateQuery.sql, /caption = \$1/);
  assert.match(updateQuery.sql, /match_id = \$2/);
  assert.match(updateQuery.sql, /id = \$3/);
  assert.deepEqual(updateQuery.values, ['Updated', 42, 501]);
});
