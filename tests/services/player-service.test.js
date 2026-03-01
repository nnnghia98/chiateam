const {
  registerPlayer,
} = require('../../src/services/player-service');

jest.mock('../../src/api/players', () => {
  const actual = jest.requireActual('../../src/api/players');
  return {
    ...actual,
    getPlayerByUserId: jest.fn().mockResolvedValue(null),
    getPlayerByNumber: jest.fn().mockImplementation((number) => {
      return Promise.resolve(
        number === 99
          ? { id: 1, user_id: 999, number: 99, name: 'Other', username: null }
          : null
      );
    }),
    createPlayer: jest.fn().mockRejectedValue(
      Object.assign(new Error('UNIQUE constraint failed: players.number'), {
        code: 'SQLITE_CONSTRAINT',
      })
    ),
  };
});

describe('player-service', () => {
  it('returns INVALID_NUMBER for non-positive numbers', async () => {
    const result = await registerPlayer({
      teleUser: { id: 1, first_name: 'Test' },
      number: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_NUMBER');
  });

  it('returns INVALID_NAME when first_name is missing or empty', async () => {
    const resultNull = await registerPlayer({
      teleUser: { id: 2, first_name: null },
      number: 10,
    });
    expect(resultNull.ok).toBe(false);
    expect(resultNull.code).toBe('INVALID_NAME');

    const resultEmpty = await registerPlayer({
      teleUser: { id: 3, first_name: '' },
      number: 11,
    });
    expect(resultEmpty.ok).toBe(false);
    expect(resultEmpty.code).toBe('INVALID_NAME');
  });

  it('returns INVALID_NAME when first_name is only whitespace', async () => {
    const result = await registerPlayer({
      teleUser: { id: 4, first_name: '   \t  ' },
      number: 12,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_NAME');
  });

  it('returns NUMBER_IN_USE when createPlayer fails with UNIQUE on players.number', async () => {
    const result = await registerPlayer({
      teleUser: { id: 100, first_name: 'Racer', username: null },
      number: 99,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NUMBER_IN_USE');
    expect(result.data).toBeDefined();
    expect(result.data.player).toBeDefined();
    expect(result.data.player.number).toBe(99);
    expect(result.data.player.name).toBe('Other');
  });
});

