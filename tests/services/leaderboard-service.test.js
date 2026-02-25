const {
  applyMatchResult,
} = require('../../src/services/leaderboard-service');

describe('leaderboard-service', () => {
  it('returns INVALID_RESULT for unknown result codes', async () => {
    const result = await applyMatchResult({
      result: 'UNKNOWN',
      playerNumbers: [1, 2],
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_RESULT');
  });
});

