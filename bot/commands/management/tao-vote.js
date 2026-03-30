const { CHAT_ID, THREAD_TYPES, sendMessage } = require('../../utils/chat');
const { TAO_VOTE } = require('../../utils/messages');
const { requireAdmin } = require('../../utils/permissions');
const { toEntry } = require('../../utils/team-member');

const bot = require('../../bot');

const voteCommand = ({ members, getActiveVote, setActiveVote }) => {
  bot.on('poll_answer', pollAnswer => {
    console.log('📊 [taovote] Poll answer received:', {
      pollId: pollAnswer.poll_id,
      userId: pollAnswer.user.id,
      userName: pollAnswer.user.first_name || pollAnswer.user.username,
      options: pollAnswer.option_ids,
    });

    const activeVote = getActiveVote();
    if (!activeVote) {
      console.log('⚠️ [taovote] No active vote, ignoring poll answer');
      return;
    }

    if (pollAnswer.poll_id !== activeVote.id) {
      console.log('⚠️ [taovote] Poll ID mismatch, ignoring poll answer');
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

    // Save updated vote back to storage
    setActiveVote(activeVote);

    console.log(
      `✅ [taovote] Vote recorded for ${userName}, total voters: ${activeVote.totalVoters}`
    );
  });

  bot.onText(/^\/taovote$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: TAO_VOTE.instruction,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });

  bot.onText(/^\/taovote\s+(.+)$/, async (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }
    const question = match[1].trim();

    if (!question) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TAO_VOTE.shortInstruction,
      });
      return;
    }

    if (getActiveVote()) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TAO_VOTE.voteExists,
      });
      return;
    }

    // Fixed options with values: 0, +1, +2, +3, +4
    const options = ['0', '+1', '+2', '+3', '+4'];

    console.log(`📊 [taovote] Creating poll: "${question}"`);

    bot
      .sendPoll(CHAT_ID, question, options, {
        message_thread_id: THREAD_TYPES.ANNOUNCEMENT,
        is_anonymous: false,
        allows_multiple_answers: false,
        explanation: `${TAO_VOTE.explanation} ${msg.from.first_name || msg.from.username || 'Unknown'}`,
      })
      .then(pollMessage => {
        const voteId = pollMessage.poll.id;
        setActiveVote({
          id: voteId,
          question,
          options,
          chatId: msg.chat.id,
          messageId: pollMessage.message_id,
          createdBy: msg.from.first_name || msg.from.username || 'Unknown',
          createdAt: new Date().toISOString(),
          totalVoters: 0,
          votes: {},
        });
        console.log(`✅ [taovote] Poll created successfully, ID: ${voteId}`);
      })
      .catch(error => {
        console.error('❌ [taovote] Error creating vote:', error.message);
        console.error('Error details:', error);
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: TAO_VOTE.error,
        });
      });
  });

  bot.onText(/^\/clearvote$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }
    const activeVote = getActiveVote();
    if (!activeVote) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TAO_VOTE.noVote,
      });
      return;
    }

    console.log(`🗑️ [taovote] Clearing vote: "${activeVote.question}"`);
    setActiveVote(null);

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: '🗑️ Đã xoá vote.',
    });
  });

  bot.onText(/^\/demvote$/, msg => {
    const activeVote = getActiveVote();
    if (!activeVote) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TAO_VOTE.noVote,
      });
      return;
    }

    console.log(`📊 [taovote] Counting votes for: "${activeVote.question}"`);
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

    sendMessage({
      msg,
      type: 'MAIN',
      message: resultText,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });

  bot.onText(/^\/sync$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    const activeVote = getActiveVote();
    if (!activeVote) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TAO_VOTE.noVote,
      });
      return;
    }

    console.log(`🔄 [sync] Syncing voters from poll: "${activeVote.question}"`);

    const voters = Object.values(activeVote.votes);
    let addedCount = 0;
    let skippedCount = 0;
    const addedNames = [];
    const skippedNames = [];

    voters.forEach(voter => {
      const userId = voter.id;
      const userName = voter.name;
      const voteOption = voter.options[0]; // Get the first (and only) option they selected

      // Option 0 means not coming, skip this voter
      if (voteOption === 0) {
        console.log(`⏭️ [sync] Skipped ${userName} (voted 0 - not coming)`);
        return;
      }

      // Add the main voter
      if (members.has(userId)) {
        skippedCount++;
        skippedNames.push(userName);
        console.log(`⏭️ [sync] Skipped ${userName} (already in bench)`);
      } else {
        members.set(userId, toEntry(userName, userId));
        addedCount++;
        addedNames.push(userName);
        console.log(`✅ [sync] Added ${userName} to bench`);
      }

      // If they voted for +2, +3, or +4, add their friends
      // +2 = 2 total people (voter + 1 friend)
      // +3 = 3 total people (voter + 2 friends)
      // +4 = 4 total people (voter + 3 friends)
      if (voteOption >= 2) {
        const friendsCount = voteOption - 1; // Subtract 1 because the voter is already counted
        console.log(
          `👥 [sync] ${userName} voted +${voteOption}, adding ${friendsCount} friend(s)`
        );

        for (let i = 1; i <= friendsCount; i++) {
          const friendName = `${userName} ${i}`;
          const friendId = `${userId}_friend_${i}`; // Create a unique ID for each friend

          if (members.has(friendId)) {
            skippedCount++;
            skippedNames.push(friendName);
            console.log(`⏭️ [sync] Skipped ${friendName} (already in bench)`);
          } else {
            members.set(friendId, toEntry(friendName));
            addedCount++;
            addedNames.push(friendName);
            console.log(`✅ [sync] Added friend ${friendName} to bench`);
          }
        }
      }
    });

    let message = '🔄 *ĐÃ ĐỒNG BỘ TỪ VOTE*\n\n';
    message += `📊 Vote: "${activeVote.question}"\n`;
    message += `👥 Tổng số người vote: ${voters.length}\n\n`;

    if (addedCount > 0) {
      message += `✅ *Đã thêm vào bench (${addedCount}):*\n`;
      message += addedNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
      message += '\n\n';
    }

    if (skippedCount > 0) {
      message += `⏭️ *Đã có trong bench (${skippedCount}):*\n`;
      message += skippedNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
    }

    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message,
      options: {
        parse_mode: 'Markdown',
      },
    });

    console.log(
      `✅ [sync] Sync complete: ${addedCount} added, ${skippedCount} skipped`
    );
  });
};

module.exports = voteCommand;
