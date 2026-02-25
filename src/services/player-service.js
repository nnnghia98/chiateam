const {
  createPlayer,
  getPlayerByUserId,
  getPlayerByNumber,
} = require('../api/players');

/**
 * Domain-level errors are represented as plain objects
 * that commands can pattern-match on without depending
 * on Error subclasses.
 *
 * Example:
 * { ok: false, code: 'ALREADY_REGISTERED', data: {...} }
 */

async function registerPlayer({ teleUser, number }) {
  const userId = teleUser.id;
  const name = teleUser.first_name;
  const username = teleUser.username ?? null;

  if (!Number.isInteger(number) || number <= 0) {
    return {
      ok: false,
      code: 'INVALID_NUMBER',
      data: { number },
    };
  }

  const existingByUser = await getPlayerByUserId(userId);
  if (existingByUser) {
    return {
      ok: false,
      code: 'ALREADY_REGISTERED',
      data: {
        player: existingByUser,
      },
    };
  }

  const existingByNumber = await getPlayerByNumber(number);
  if (existingByNumber) {
    return {
      ok: false,
      code: 'NUMBER_IN_USE',
      data: {
        player: existingByNumber,
      },
    };
  }

  try {
    const created = await createPlayer({
      userId,
      name,
      number,
      username,
    });

    return {
      ok: true,
      player: created,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'UNEXPECTED_ERROR',
      error,
    };
  }
}

async function getPlayerByTelegramId(teleId) {
  return getPlayerByUserId(teleId);
}

module.exports = {
  registerPlayer,
  getPlayerByTelegramId,
};

