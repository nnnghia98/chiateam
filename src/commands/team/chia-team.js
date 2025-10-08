const shuffleArray = require('../../utils/shuffle');
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

      const newNames = Array.from(members.values());
      shuffleArray(newNames);

      newNames.forEach((name, index) => {
        const fakeId = Date.now() + Math.random() + index;
        if (teamA.size <= teamB.size) {
          teamA.set(fakeId, name);
        } else {
          teamB.set(fakeId, name);
        }
      });

      members.clear();

      const message = `🎲 *Thêm member mới vào team* 🎲\n\n👤 *Team A:*\n${Array.from(
        teamA.values()
      ).join('\n')}\n\n👤 *Team B:*\n${Array.from(teamB.values()).join('\n')}`;

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

    const names = Array.from(members.values());
    shuffleArray(names);

    const half = Math.ceil(names.length / 2);
    teamA.clear();
    teamB.clear();
    names.slice(0, half).forEach((name, idx) => {
      const fakeId = Date.now() + Math.random() + idx;
      teamA.set(fakeId, name);
    });
    names.slice(half).forEach((name, idx) => {
      const fakeId = Date.now() + Math.random() + half + idx;
      teamB.set(fakeId, name);
    });

    members.clear();

    const message = `🎲 *Chia team* 🎲\n\n👤 *HOME:*\n${Array.from(
      teamA.values()
    ).join('\n')}\n\n👤 *AWAY:*\n${Array.from(teamB.values()).join('\n')}`;

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
