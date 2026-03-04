const shuffleArray = require('../../utils/shuffle');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const splitCommand = ({ members, teamA, teamB }) => {
  bot.onText(/^\/chiateam$/, msg => {
    if (members.size < 2 && teamA.size === 0 && teamB.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '❗ Không đủ người để chia',
      });
      return;
    }

    if (teamA.size > 0 || teamB.size > 0) {
      if (members.size === 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: '❗ Không có member mới để thêm vào team',
        });
        return;
      }

      const newEntries = Array.from(members.values());
      shuffleArray(newEntries);

      newEntries.forEach((entry, index) => {
        const fakeId = Date.now() + Math.random() + index;
        if (teamA.size <= teamB.size) {
          teamA.set(fakeId, entry);
        } else {
          teamB.set(fakeId, entry);
        }
      });

      members.clear();

      const message = `🎲 *Thêm member mới vào team* 🎲\n\n👤 *Team A:*\n${Array.from(
        teamA.values()
      )
        .map(getDisplayName)
        .join('\n')}\n\n👤 *Team B:*\n${Array.from(teamB.values())
        .map(getDisplayName)
        .join('\n')}`;

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: message,
        options: {
          parse_mode: 'Markdown',
        },
      });
      return;
    }

    const entries = Array.from(members.values());
    shuffleArray(entries);

    const half = Math.ceil(entries.length / 2);
    teamA.clear();
    teamB.clear();
    entries.slice(0, half).forEach((entry, idx) => {
      const fakeId = Date.now() + Math.random() + idx;
      teamA.set(fakeId, entry);
    });
    entries.slice(half).forEach((entry, idx) => {
      const fakeId = Date.now() + Math.random() + half + idx;
      teamB.set(fakeId, entry);
    });

    members.clear();

    const message = `🎲 *Chia team* 🎲\n\n👤 *HOME:*\n${Array.from(teamA.values())
      .map(getDisplayName)
      .join('\n')}\n\n👤 *AWAY:*\n${Array.from(teamB.values())
      .map(getDisplayName)
      .join('\n')}`;

    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message: message,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });
};

module.exports = splitCommand;
