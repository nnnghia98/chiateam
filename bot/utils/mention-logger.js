const { logEvent } = require('./logger');
const { isOnCooldown } = require('./cooldown');
const { safeError } = require('../../runtime/managed-process');

function registerMentionLogger(bot, identity, { replyToMentions = true } = {}) {
  const username = identity.username?.toLowerCase();

  bot.on('message', async msg => {
    if (msg.from?.is_bot) return;
    const text = msg.text ?? msg.caption ?? '';
    const entities = msg.text != null ? msg.entities : msg.caption_entities;
    const mentioned = (entities || []).some(entity => {
      if (entity.type === 'text_mention') {
        return entity.user?.id === identity.id;
      }
      const token = text.slice(entity.offset, entity.offset + entity.length);
      if (entity.type === 'mention') {
        return username && token.toLowerCase() === `@${username}`;
      }
      if (entity.type === 'bot_command') {
        return username && token.toLowerCase().endsWith(`@${username}`);
      }
      return false;
    });

    if (!mentioned) return;
    const userId = msg.from?.id ?? msg.sender_chat?.id ?? null;
    if (isOnCooldown(msg, `mention:${identity.id}:${userId}`, 5000)) return;

    logEvent('telegram.mention', 'message tagged this bot', {
      user_id: userId,
      chat_id: msg.chat?.id ?? null,
      message_id: msg.message_id,
      time: msg.date ? new Date(msg.date * 1000).toISOString() : undefined,
      text: JSON.stringify(text),
    });

    if (!replyToMentions) return;
    const name =
      [msg.from?.first_name, msg.from?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      msg.from?.username ||
      msg.sender_chat?.title ||
      'there';
    const options = {
      reply_parameters: {
        message_id: msg.message_id,
        allow_sending_without_reply: true,
      },
    };
    if (msg.message_thread_id != null) {
      options.message_thread_id = msg.message_thread_id;
    }
    try {
      await bot.sendMessage(msg.chat.id, `Hi ${name}`, options);
    } catch (error) {
      logEvent(
        'telegram.mention',
        'mention reply failed',
        {
          user_id: userId,
          chat_id: msg.chat?.id,
          error: safeError(error).message,
        },
        'error'
      );
    }
  });
}

module.exports = { registerMentionLogger };
