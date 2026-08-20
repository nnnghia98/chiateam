const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApiMatchSummaryGenerator,
} = require('./api-match-summary-generator');

test('API match summary generator normalizes optional AI output', async () => {
  const generator = createApiMatchSummaryGenerator({
    async generate(match) {
      assert.equal(match.id, 1);
      return '  Trận đấu rất hay!  ';
    },
  });

  assert.equal(await generator.generate({ id: 1 }), 'Trận đấu rất hay!');
});
