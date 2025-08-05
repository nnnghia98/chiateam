const { getChatId } = require('../../utils/chat');
const TAO_VOTE = {
  instruction:
    '📊 *Cách sử dụng /taovote:*\n' +
    '• `/taovote [question]` - Tạo vote với câu hỏi và 4 lựa chọn cố định (0, +1, +2, +3, +4)\n' +
    '• `/clearvote` - Xóa tất cả vote đang hoạt động\n' +
    '\nVí dụ: `/taovote Sân XX ngày YY giờ ZZ`\n' +
    '\n*Lưu ý:* Vote sẽ có 4 lựa chọn: 0, +1, +2, +3, +4',
  shortInstruction:
    '⚠️ Cần nhập câu hỏi cho vote.\n' +
    'Ví dụ: `/taovote Sân XX ngày YY giờ ZZ`',
  voteExists:
    '⚠️ Hiện tại đã có một vote đang hoạt động. Hãy xoá vote cũ trước khi tạo vote mới bằng lệnh /clearvote.',
  explanation: 'Vote được tạo bởi',
  error: '❌ Có lỗi xảy ra khi tạo vote. Vui lòng thử lại.',
  noVote: '📭 Không có vote nào đang hoạt động để xóa.',
  result: '📊 *Kết quả vote hiện tại:*\n*${question}*\n\n',
};

let activeVote = null;

const voteCommand = bot => {
  bot.on('poll_answer', pollAnswer => {
    if (!activeVote || pollAnswer.poll_id !== activeVote.id) {
      return;
    }

    const userId = pollAnswer.user.id;
    const userName =
      pollAnswer.user.first_name || pollAnswer.user.username || 'Unknown';

    activeVote.votes[userId] = {
      id: userId,
      name: userName,
      options: pollAnswer.option_ids,
    };

    activeVote.totalVoters = Object.keys(activeVote.votes).length;
  });

  bot.onText(/^\/taovote$/, msg => {
    bot.sendMessage(getChatId(msg, 'DEFAULT'), TAO_VOTE.instruction, {
      parse_mode: 'Markdown',
    });
  });

  bot.onText(/^\/taovote\s+(.+)$/, async (msg, match) => {
    const question = match[1].trim();

    if (!question) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), TAO_VOTE.shortInstruction);
      return;
    }

    if (activeVote) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), TAO_VOTE.voteExists);
      return;
    }

    // Fixed options with values: 0, +1, +2, +3, +4
    const options = ['0', '+1', '+2', '+3', '+4'];

    bot
      .sendPoll(getChatId(msg, 'ANNOUNCEMENT'), question, options, {
        is_anonymous: false,
        allows_multiple_answers: false,
        explanation: `${TAO_VOTE.explanation} ${msg.from.first_name || msg.from.username || 'Unknown'}`,
      })
      .then(pollMessage => {
        const voteId = pollMessage.poll.id;
        activeVote = {
          id: voteId,
          question,
          options,
          chatId: msg.chat.id,
          messageId: pollMessage.message_id,
          createdBy: msg.from.first_name || msg.from.username || 'Unknown',
          createdAt: new Date(),
          totalVoters: 0,
          votes: {},
        };
      })
      .catch(error => {
        console.error('Error creating vote:', error);
        bot.sendMessage(getChatId(msg, 'DEFAULT'), TAO_VOTE.error);
      });
  });

  bot.onText(/^\/clearvote$/, msg => {
    if (!activeVote) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), TAO_VOTE.noVote);
      return;
    }

    activeVote = null;

    bot.sendMessage(getChatId(msg, 'DEFAULT'), '🗑️ Đã xoá vote.');
  });

  bot.onText(/^\/demvote$/, msg => {
    if (!activeVote) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), TAO_VOTE.noVote);
      return;
    }

    const { question, options, votes, totalVoters } = activeVote;
    let resultText = `${TAO_VOTE.result.replace('{question}', question)}\n\n`;

    options.forEach((option, idx) => {
      const voters = Object.values(votes)
        .filter(vote => vote.options.includes(idx))
        .map(vote => vote.name);

      resultText += `*${option}* (${voters.length})\n`;
      if (voters.length > 0) {
        resultText += `*Ai vote?* ${voters.join(', ')}\n`;
      } else {
        resultText += '*Ai vote?* Chưa có ai vote\n';
      }
      resultText += '\n';
    });

    resultText += `*Số người vote:* ${totalVoters || 0}`;

    bot.sendMessage(getChatId(msg, 'MAIN'), resultText, {
      parse_mode: 'Markdown',
    });
  });
};

module.exports = voteCommand;
