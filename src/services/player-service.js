const {
  createPlayer,
  createPlayerWithPlaceholder,
  getPlayerByUserId,
  getPlayerByNumber,
  updatePlayerByNumber,
  deletePlayerByNumber: apiDeletePlayerByNumber,
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

  if (name == null || String(name).trim() === '') {
    return {
      ok: false,
      code: 'INVALID_NAME',
      data: {},
    };
  }

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
    // Admin-created slot (placeholder user_id < 0): claim it with current user
    if (existingByNumber.user_id < 0) {
      try {
        const updated = await updatePlayerByNumber(number, {
          userId,
          name,
          username,
        });
        return { ok: true, player: updated };
      } catch (error) {
        return {
          ok: false,
          code: 'UNEXPECTED_ERROR',
          error,
        };
      }
    }
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
    if (error.code === 'SQLITE_CONSTRAINT' && error.message) {
      const msg = error.message;
      if (msg.includes('players.number')) {
        const existing = await getPlayerByNumber(number);
        if (existing) {
          return {
            ok: false,
            code: 'NUMBER_IN_USE',
            data: { player: existing },
          };
        }
      }
      if (msg.includes('players.user_id')) {
        const existing = await getPlayerByUserId(userId);
        if (existing) {
          return {
            ok: false,
            code: 'ALREADY_REGISTERED',
            data: { player: existing },
          };
        }
      }
    }
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

/**
 * Register a player slot for another person (admin only). Uses a placeholder user_id
 * so the slot can be claimed later with /register NUMBER.
 */
async function registerPlayerForAnother({ name, number }) {
  const trimmedName = name == null ? '' : String(name).trim();
  if (trimmedName === '') {
    return { ok: false, code: 'INVALID_NAME', data: {} };
  }
  if (!Number.isInteger(number) || number <= 0) {
    return { ok: false, code: 'INVALID_NUMBER', data: { number } };
  }
  const existing = await getPlayerByNumber(number);
  if (existing) {
    return {
      ok: false,
      code: 'NUMBER_IN_USE',
      data: { player: existing },
    };
  }
  try {
    const created = await createPlayerWithPlaceholder(trimmedName, number);
    return { ok: true, player: created };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT' && error.message?.includes('players.number')) {
      const existingAfter = await getPlayerByNumber(number);
      if (existingAfter) {
        return {
          ok: false,
          code: 'NUMBER_IN_USE',
          data: { player: existingAfter },
        };
      }
    }
    return { ok: false, code: 'UNEXPECTED_ERROR', error };
  }
}

/**
 * Delete a registered player by shirt number (admin only).
 */
async function deletePlayerByNumber(number) {
  if (!Number.isInteger(number) || number <= 0) {
    return { ok: false, code: 'INVALID_NUMBER', data: { number } };
  }
  try {
    const deleted = await apiDeletePlayerByNumber(number);
    return deleted ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
  } catch (error) {
    return { ok: false, code: 'UNEXPECTED_ERROR', error };
  }
}

module.exports = {
  registerPlayer,
  registerPlayerForAnother,
  deletePlayerByNumber,
  getPlayerByTelegramId,
};

