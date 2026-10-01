const { logEvent } = require('./logger');

function registerMentionLogger(bot, identity) {
  const username = identity.username?.toLowerCase();

  bot.on('message', msg => {
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
    logEvent('telegram.mention', 'message tagged this bot', {
      user_id: msg.from?.id ?? msg.sender_chat?.id ?? null,
      chat_id: msg.chat?.id ?? null,
      message_id: msg.message_id,
      time: msg.date ? new Date(msg.date * 1000).toISOString() : undefined,
      text: JSON.stringify(text),
    });
  });
}

module.exports = { registerMentionLogger };
