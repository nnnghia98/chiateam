const { sendMessage } = require('../../utils/chat');
const { formatMoney } = require('../../utils/format');
const { MATCH } = require('../../utils/messages');
const {
  getMatchByDate,
  getMatchWithPlayers,
  createOrUpdateMatch,
  updateMatchResult,
  addMatchPlayerStatDelta,
  setMatchMvp,
  isPlayerInMatch,
} = require('../../api/matches');
const { getAllPlayers, getPlayerByNumber } = require('../../api/players');
const sanCommand = require('../management/san');

const bot = require('../../bot');

/**
 * Get Thursday of the week containing the given date.
 * @param {Date} d
 * @returns {Date} Thursday (same week)
 */
function getThursdayOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day >= 4 ? 4 - day : -(day + 3);
  date.setDate(date.getDate() + diff);
  return date;
}

/**
 * Format date to YYYY-MM-DD for DB.
 * @param {Date} d
 * @returns {string}
 */
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse dd/mm/yyyy to Date. Returns null if invalid.
 * @param {string} str
 * @returns {Date|null}
 */
function parseDate(str) {
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
  if (isNaN(d.getTime()) || d.getDate() !== parseInt(dd, 10)) return null;
  return d;
}

/**
 * Resolve display name to player. Returns { playerId, displayName }.
 * @param {string} displayName
 * @param {Array} allPlayers
 * @returns {{ playerId: number|null, displayName: string }}
 */
function resolvePlayer(displayName, allPlayers) {
  const baseName = displayName.split(' (')[0].trim();
  const exact = allPlayers.find(
    p => p.name.toLowerCase() === baseName.toLowerCase()
  );
  if (exact) return { playerId: exact.id, displayName };
  const partial = allPlayers.find(
    p =>
      p.name.toLowerCase().includes(baseName.toLowerCase()) ||
      baseName.toLowerCase().includes(p.name.toLowerCase())
  );
  if (partial) return { playerId: partial.id, displayName };
  return { playerId: null, displayName };
}

/**
 * Build home/away player entries from team Maps.
 * @param {Map} teamA
 * @param {Map} teamB
 * @param {Array} allPlayers
 * @returns {{ homePlayers: Array, awayPlayers: Array }}
 */
function buildPlayerEntries(teamA, teamB, allPlayers) {
  const homePlayers = Array.from(teamA.values()).map(name =>
    resolvePlayer(name, allPlayers)
  );
  const awayPlayers = Array.from(teamB.values()).map(name =>
    resolvePlayer(name, allPlayers)
  );
  return { homePlayers, awayPlayers };
}

/**
 * Format match for display.
 * @param {Object} match
 * @param {string} dateLabel - e.g. "23/02/2026"
 * @returns {string}
 */
function formatMatchMessage(match, dateLabel) {
  let msg = `⚽ *Trận đấu ${dateLabel}* ⚽\n\n`;
  if (match.san) msg += `📍 Sân: ${match.san}\n`;
  if (match.tiensan) msg += `💸 Tiền sân: ${formatMoney(match.tiensan)} VND\n`;
  if (match.home_score != null && match.away_score != null) {
    msg += `\n📊 Kết quả: ${match.home_score} - ${match.away_score}\n`;
  }
  const fmt = p => {
    let s = `• ${p.label}`;
    if (p.goals != null || p.assists != null || p.isMvp) {
      const parts = [];
      if (p.goals) parts.push(`${p.goals}⚽`);
      if (p.assists) parts.push(`${p.assists}🎯`);
      if (p.isMvp) parts.unshift('⭐');
      if (parts.length) s += ` (${parts.join(' ')})`;
    }
    return s;
  };
  msg += '\n👤 *HOME:*\n';
  msg += (match.homePlayers || []).map(fmt).join('\n') || '• (trống)';
  msg += '\n\n👤 *AWAY:*\n';
  msg += (match.awayPlayers || []).map(fmt).join('\n') || '• (trống)';
  return msg;
}

/**
 * Format date for display (dd/mm/yyyy).
 * @param {string} isoDate - YYYY-MM-DD
 * @returns {string}
 */
function formatDateDisplay(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function matchCommand({ getTiensan, teamA, teamB }) {
  const getSan = sanCommand.getSan;

  bot.onText(/^\/match(?:\s+(.+))?$/, async (msg, match) => {
    const rawArgs = match[1]?.trim() || '';
    const parts = rawArgs ? rawArgs.split(/\s+/) : [];
    const isSave = parts.some(p => p.toUpperCase() === 'SAVE');
    const datePart = parts.find(p => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(p));
    const scorePart = parts.find(p => /^\d+-\d+$/.test(p));
    const goalIdx = parts.findIndex(p => p.toLowerCase() === 'goal');
    const assistIdx = parts.findIndex(p => p.toLowerCase() === 'assist');
    const mvpIdx = parts.findIndex(p => p.toLowerCase() === 'mvp');

    let matchDate;
    if (datePart) {
      const parsed = parseDate(datePart);
      if (!parsed) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: MATCH.invalidDate,
          options: { parse_mode: 'Markdown' },
        });
        return;
      }
      matchDate = toISODate(parsed);
    } else {
      const thursday = getThursdayOfWeek(new Date());
      matchDate = toISODate(thursday);
    }

    const runScoreUpdate = async () => {
      const [home, away] = scorePart.split('-').map(Number);
      if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
        sendMessage({ msg, type: 'DEFAULT', message: MATCH.invalidScore });
        return;
      }
      try {
        const m = await getMatchByDate(matchDate);
        if (!m) {
          sendMessage({ msg, type: 'DEFAULT', message: MATCH.noMatch, options: { parse_mode: 'Markdown' } });
          return;
        }
        await updateMatchResult(matchDate, home, away);
        const updated = await getMatchWithPlayers(matchDate);
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: `${MATCH.scoreUpdated}\n\n${formatMatchMessage(updated, formatDateDisplay(matchDate))}`,
          options: { parse_mode: 'Markdown' },
        });
      } catch (err) {
        console.error('Error updating score:', err);
        sendMessage({ msg, type: 'DEFAULT', message: '❌ Có lỗi xảy ra. Vui lòng thử lại.' });
      }
    };

    const runStatUpdate = async (action, playerNumStr, valueStr) => {
      const playerNum = parseInt(playerNumStr, 10);
      if (isNaN(playerNum) || playerNum < 1) {
        sendMessage({ msg, type: 'DEFAULT', message: MATCH.invalidPlayerNumber });
        return;
      }
      const player = await getPlayerByNumber(playerNum);
      if (!player) {
        sendMessage({ msg, type: 'DEFAULT', message: MATCH.invalidPlayerNumber });
        return;
      }
      const m = await getMatchByDate(matchDate);
      if (!m) {
        sendMessage({ msg, type: 'DEFAULT', message: MATCH.noMatch, options: { parse_mode: 'Markdown' } });
        return;
      }
      const inMatch = await isPlayerInMatch(m.id, player.id);
      if (!inMatch) {
        sendMessage({ msg, type: 'DEFAULT', message: MATCH.playerNotInMatch.replace('{number}', playerNum) });
        return;
      }
      try {
        if (action === 'goal') {
          const value = parseInt(valueStr, 10);
          if (isNaN(value) || value < 1) {
            sendMessage({ msg, type: 'DEFAULT', message: MATCH.invalidPlayerNumber });
            return;
          }
          await addMatchPlayerStatDelta(m.id, player.id, 'goals', value);
          sendMessage({ msg, type: 'DEFAULT', message: MATCH.goalUpdated });
        } else if (action === 'assist') {
          const value = parseInt(valueStr, 10);
          if (isNaN(value) || value < 1) {
            sendMessage({ msg, type: 'DEFAULT', message: MATCH.invalidPlayerNumber });
            return;
          }
          await addMatchPlayerStatDelta(m.id, player.id, 'assists', value);
          sendMessage({ msg, type: 'DEFAULT', message: MATCH.assistUpdated });
        } else if (action === 'mvp') {
          await setMatchMvp(m.id, player.id);
          sendMessage({ msg, type: 'DEFAULT', message: MATCH.mvpUpdated });
        }
      } catch (err) {
        console.error('Error updating stat:', err);
        sendMessage({ msg, type: 'DEFAULT', message: '❌ Có lỗi xảy ra. Vui lòng thử lại.' });
      }
    };

    if (scorePart) {
      await runScoreUpdate();
      return;
    }
    if (goalIdx >= 0 && parts.length >= goalIdx + 3) {
      await runStatUpdate('goal', parts[goalIdx + 1], parts[goalIdx + 2]);
      return;
    }
    if (assistIdx >= 0 && parts.length >= assistIdx + 3) {
      await runStatUpdate('assist', parts[assistIdx + 1], parts[assistIdx + 2]);
      return;
    }
    if (mvpIdx >= 0 && parts.length >= mvpIdx + 2) {
      await runStatUpdate('mvp', parts[mvpIdx + 1], null);
      return;
    }

    if (isSave) {
      const san = getSan();
      const tiensan = getTiensan();
      const hasTeams = teamA.size > 0 || teamB.size > 0;

      if (!hasTeams && !san && !tiensan) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: MATCH.noDataToSave,
        });
        return;
      }

      try {
        const allPlayers = await getAllPlayers();
        const { homePlayers, awayPlayers } = buildPlayerEntries(
          teamA,
          teamB,
          allPlayers
        );

        await createOrUpdateMatch({
          matchDate,
          san: san || null,
          tiensan: tiensan || null,
          homePlayers,
          awayPlayers,
        });

        const saved = await getMatchWithPlayers(matchDate);
        const dateLabel = formatDateDisplay(matchDate);

        sendMessage({
          msg,
          type: 'ANNOUNCEMENT',
          message: `${MATCH.saved}\n\n${formatMatchMessage(saved, dateLabel)}`,
          options: { parse_mode: 'Markdown' },
        });
      } catch (err) {
        console.error('Error saving match:', err);
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: '❌ Có lỗi xảy ra khi lưu trận đấu. Vui lòng thử lại.',
        });
      }
    } else {
      try {
        const m = await getMatchWithPlayers(matchDate);
        const dateLabel = formatDateDisplay(matchDate);

        if (!m) {
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: MATCH.noMatch,
            options: { parse_mode: 'Markdown' },
          });
          return;
        }

        sendMessage({
          msg,
          type: 'DEFAULT',
          message: formatMatchMessage(m, dateLabel),
          options: { parse_mode: 'Markdown' },
        });
      } catch (err) {
        console.error('Error fetching match:', err);
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: '❌ Có lỗi xảy ra khi tải trận đấu. Vui lòng thử lại.',
        });
      }
    }
  });
}

module.exports = matchCommand;
