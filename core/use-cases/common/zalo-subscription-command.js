const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');

function createZaloSubscriptionCommand({ repository, subscribed }) {
  const name = subscribed ? 'subscribe' : 'unsubscribe';
  return createCommandDefinition({
    name,
    aliases: [],
    instruction: {
      usage: `/${name}`,
      description: subscribed
        ? 'Receive team announcements'
        : 'Stop team announcements',
      permission: 'player',
    },
    stateKeys: [],
    condition: async context => ({
      ok:
        context.actor.platform === 'zalo' &&
        context.conversation.type === 'private' &&
        context.args.length === 0,
      code: 'PRIVATE_CHAT_REQUIRED',
    }),
    action: async context => {
      try {
        await repository[name]({
          userId: context.actor.externalId,
          chatId: context.conversation.externalId,
          chatType: context.conversation.type,
        });
        return { changed: false, code: 'SAVED' };
      } catch {
        return { changed: false, code: 'SAVE_FAILED' };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'PRIVATE_CHAT_REQUIRED')
        return createTextResult(
          `Dùng /${name} trong chat riêng với bot Zalo, không kèm nội dung.`
        );
      if (outcome.code !== 'SAVED')
        return createTextResult(
          `❌ Chưa lưu được lựa chọn nhận thông báo. Vui lòng thử lại /${name}.`
        );
      return createTextResult(
        subscribed
          ? '✅ Đã đăng ký nhận thông báo của đội trong chat này. Dùng /unsubscribe để ngừng nhận.'
          : 'Đã ngừng nhận thông báo của đội. Dùng /subscribe để đăng ký lại.'
      );
    },
  });
}

module.exports = { createZaloSubscriptionCommand };
