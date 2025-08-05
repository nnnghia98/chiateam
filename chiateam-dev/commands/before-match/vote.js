let activeVote = null;

function getOpts(msg) {
  return msg.message_thread_id
    ? { message_thread_id: msg.message_thread_id }
    : {};
}

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

  bot.onText(/^\/vote$/, msg => {
    bot.sendMessage(
      msg.chat.id,
      '📊 *Cách sử dụng /vote:*\n' +
        '• `/vote [question] | [option1] | [option2] | [option3] | ...` - Tạo vote với câu hỏi và các lựa chọn\n' +
        '• `/clearvote` - Xóa tất cả vote đang hoạt động\n' +
        '\nVí dụ: `/vote Sân XX ngày YY giờ ZZ | 0 | +1 | +2`\n' +
        '\n*Lưu ý:* Tối thiểu 2 lựa chọn, tối đa 10 lựa chọn',
      getOpts(msg)
    );
  });

  bot.onText(/^\/vote\s+(.+)$/, async (msg, match) => {
    const pollText = match[1];
    const parts = pollText
      .split('|')
      .map(part => part.trim())
      .filter(part => part);

    if (parts.length < 3) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Cần ít nhất 1 câu hỏi và 2 lựa chọn.\n' +
          'Ví dụ: `/vote Sân XX ngày YY giờ ZZ | 0 | +1`',
        getOpts(msg)
      );
      return;
    }

    if (parts.length > 11) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Tối đa 10 lựa chọn cho mỗi vote.\n' +
          'Vui lòng giảm số lượng lựa chọn.',
        getOpts(msg)
      );
      return;
    }

    if (activeVote) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Hiện tại đã có một vote đang hoạt động. Hãy xoá vote cũ trước khi tạo vote mới bằng lệnh /clearvote.',
        getOpts(msg)
      );
      return;
    }

    const question = parts[0];
    const options = parts.slice(1);

    bot
      .sendPoll(msg.chat.id, question, options, {
        is_anonymous: false,
        allows_multiple_answers: false,
        explanation: `Vote được tạo bởi ${msg.from.first_name || msg.from.username || 'Unknown'}`,
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
        bot.sendMessage(
          msg.chat.id,
          '❌ Có lỗi xảy ra khi tạo vote. Vui lòng thử lại.',
          getOpts(msg)
        );
      });
  });

  bot.onText(/^\/clearvote$/, msg => {
    if (!activeVote) {
      bot.sendMessage(
        msg.chat.id,
        '📭 Không có vote nào đang hoạt động để xóa.',
        getOpts(msg)
      );
      return;
    }

    activeVote = null;

    bot.sendMessage(msg.chat.id, '🗑️ Đã xoá vote.', getOpts(msg));
  });

  bot.onText(/^\/demvote$/, msg => {
    if (!activeVote) {
      bot.sendMessage(
        msg.chat.id,
        '📭 Không có vote nào đang hoạt động.',
        getOpts(msg)
      );
      return;
    }

    const { question, options, votes, totalVoters } = activeVote;
    let resultText = `📊 *Kết quả vote hiện tại:*\n*${question}*\n\n`;

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

    bot.sendMessage(msg.chat.id, resultText, {
      ...getOpts(msg),
      parse_mode: 'Markdown',
    });
  });
};

module.exports = voteCommand;
