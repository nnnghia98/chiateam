const {
  registerPlayer,
} = require('../../src/services/player-service');

describe('player-service', () => {
  it('returns INVALID_NUMBER for non-positive numbers', async () => {
    const result = await registerPlayer({
      teleUser: { id: 1, first_name: 'Test' },
      number: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_NUMBER');
  });
});

