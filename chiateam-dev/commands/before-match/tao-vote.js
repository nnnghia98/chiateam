const { getChatId, sendMessage } = require('../../utils/chat');
const { TAO_VOTE } = require('../../utils/messages');

const bot = require('../../bot');

let activeVote = null;

const voteCommand = () => {
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
    sendMessage(msg, 'DEFAULT', TAO_VOTE.instruction, {
      parse_mode: 'Markdown',
    });
  });

  bot.onText(/^\/taovote\s+(.+)$/, async (msg, match) => {
    const question = match[1].trim();

    if (!question) {
      sendMessage(msg, 'DEFAULT', TAO_VOTE.shortInstruction);
      return;
    }

    if (activeVote) {
      sendMessage(msg, 'DEFAULT', TAO_VOTE.voteExists);
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
        sendMessage(msg, 'DEFAULT', TAO_VOTE.error);
      });
  });

  bot.onText(/^\/clearvote$/, msg => {
    if (!activeVote) {
      sendMessage(msg, 'DEFAULT', TAO_VOTE.noVote);
      return;
    }

    activeVote = null;

    sendMessage(msg, 'DEFAULT', '🗑️ Đã xoá vote.');
  });

  bot.onText(/^\/demvote$/, msg => {
    if (!activeVote) {
      sendMessage(msg, 'DEFAULT', TAO_VOTE.noVote);
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

    sendMessage(msg, 'MAIN', resultText, {
      parse_mode: 'Markdown',
    });
  });
};

module.exports = voteCommand;
