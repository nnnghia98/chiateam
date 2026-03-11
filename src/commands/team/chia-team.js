const shuffleArray = require('../../utils/shuffle');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');

const bot = require('../../bot');

const splitCommand = ({ members, teamA, teamB, team3A, team3B, team3C }) => {
  // Split into 2 teams (HOME / AWAY). Uses teamA/teamB. Bench is NOT cleared.
  bot.onText(/^\/chiateam$/, msg => {
    if (members.size < 2) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '❗ Không đủ người để chia',
      });
      return;
    }

    const entries = Array.from(members.values());
    shuffleArray(entries);

    const isOdd = entries.length % 2 !== 0;
    const extraToA = Math.random() < 0.5;
    const half =
      isOdd && !extraToA
        ? Math.floor(entries.length / 2)
        : Math.ceil(entries.length / 2);

    teamA.clear();
    teamB.clear();

    entries.slice(0, half).forEach((entry, idx) => {
      teamA.set(Date.now() + Math.random() + idx, entry);
    });
    entries.slice(half).forEach((entry, idx) => {
      teamB.set(Date.now() + Math.random() + half + idx, entry);
    });

    const message =
      `🎲 *Chia team* 🎲\n\n` +
      `👤 *HOME:*\n${Array.from(teamA.values()).map(getDisplayName).join('\n')}\n\n` +
      `👤 *AWAY:*\n${Array.from(teamB.values()).map(getDisplayName).join('\n')}`;

    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });

  // Split into 3 teams (HOME / AWAY / EXTRA). Uses team3A/team3B/team3C. Admin only. Bench is NOT cleared.
  bot.onText(/^\/chiateam 3$/, msg => {
    if (!requireAdmin(msg)) return;

    if (members.size < 3) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '❗ Cần ít nhất 3 người để chia 3 team',
      });
      return;
    }

    const entries = Array.from(members.values());
    shuffleArray(entries);

    const total = entries.length;
    const base = Math.floor(total / 3);
    const rem = total % 3;

    // Randomly choose which teams receive the extra player(s)
    const idxPool = [0, 1, 2];
    for (let i = idxPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxPool[i], idxPool[j]] = [idxPool[j], idxPool[i]];
    }
    const sizes = [base, base, base];
    for (let i = 0; i < rem; i++) {
      sizes[idxPool[i]]++;
    }

    team3A.clear();
    team3B.clear();
    team3C.clear();

    entries.slice(0, sizes[0]).forEach((entry, idx) => {
      team3A.set(Date.now() + Math.random() + idx, entry);
    });
    entries.slice(sizes[0], sizes[0] + sizes[1]).forEach((entry, idx) => {
      team3B.set(Date.now() + Math.random() + idx, entry);
    });
    entries.slice(sizes[0] + sizes[1]).forEach((entry, idx) => {
      team3C.set(Date.now() + Math.random() + idx, entry);
    });

    const message =
      `🎲 *Chia 3 team* 🎲\n\n` +
      `👤 *HOME:*\n${Array.from(team3A.values()).map(getDisplayName).join('\n')}\n\n` +
      `👤 *AWAY:*\n${Array.from(team3B.values()).map(getDisplayName).join('\n')}\n\n` +
      `👤 *EXTRA:*\n${Array.from(team3C.values()).map(getDisplayName).join('\n')}`;

    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = splitCommand;
