const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGES = Object.freeze({
  usage:
    '⚠️ Dùng /zalosay [nội dung, tối đa 2000 ký tự]. Bot sẽ yêu cầu xác nhận trước khi gửi đến tất cả người đăng ký.',
  denied:
    '⛔ Chỉ admin Telegram mới có quyền gửi thông báo đến tất cả người đăng ký.',
  empty:
    'Chưa có người đăng ký nhận thông báo. Mỗi người cần nhắn /subscribe trong chat riêng với bot Zalo.',
  cancelled: 'Đã hủy thông báo. Không có tin nhắn nào được gửi.',
  UNAVAILABLE:
    'Thông báo không tồn tại, đã xác nhận, đã hủy hoặc hết hạn. Dùng /zalosay status [mã] để kiểm tra trước khi tạo lại.',
  MISSING_TOKEN:
    '❌ Thiếu ZALO_BOT_TOKEN trên dịch vụ bot Telegram. Cấu hình token đang dùng và triển khai lại dịch vụ.',
  UNAUTHORIZED:
    '❌ Zalo từ chối token của dịch vụ bot Telegram (401). Kiểm tra ZALO_BOT_TOKEN trên dịch vụ đó.',
  RATE_LIMITED:
    '⚠️ Zalo đang giới hạn lượt gửi. Đã dừng gửi; không tự động gửi lại.',
  NETWORK_ERROR:
    '⚠️ Không xác nhận được kết nối hoặc kết quả từ Zalo. Không tự động gửi lại để tránh trùng tin.',
  API_ERROR:
    '❌ Zalo từ chối yêu cầu. Kiểm tra quyền gửi tin của bot và trạng thái tài khoản Zalo.',
  storage:
    '❌ Không thể đọc hoặc lưu tiến độ gửi. Kiểm tra API và database; không gửi lại toàn bộ thông báo khi chưa kiểm tra trạng thái.',
});

function formatSummary(summary) {
  return (
    `Thông báo ${summary.id}\n` +
    `Trạng thái: ${{ draft: 'chờ xác nhận', sending: 'đang gửi hoặc đã gián đoạn', finished: 'đã kết thúc lượt gửi', cancelled: 'đã hủy' }[summary.status] || summary.status}\n` +
    `Tổng: ${summary.total}\nĐã gửi: ${summary.sent}\nThất bại: ${summary.failed}\n` +
    `Đang gửi / chưa rõ kết quả: ${summary.uncertain}\nChưa gửi: ${summary.pending}\nĐã bỏ qua do hủy đăng ký: ${summary.skipped}`
  );
}

function createZaloBroadcastCommand({ service } = {}) {
  for (const method of ['prepare', 'confirm', 'cancel', 'status']) {
    if (typeof service?.[method] !== 'function')
      throw new TypeError(`Broadcast service requires ${method}.`);
  }
  return createCommandDefinition({
    name: 'zalosay',
    aliases: ['say'],
    instruction: {
      usage: '/zalosay [MESSAGE]',
      description: 'Preview and confirm a Zalo subscriber broadcast',
      permission: 'admin',
    },
    stateKeys: [],
    condition: async context => {
      if (context.actor.platform !== 'telegram')
        return { ok: false, code: 'PERMISSION_DENIED' };
      const [operation, id] = context.args;
      if (['confirm', 'cancel', 'status'].includes(operation)) {
        return context.args.length === 2 && UUID.test(id || '')
          ? { ok: true, operation, id }
          : { ok: false, code: 'INVALID' };
      }
      const message = context.args.join(' ').trim();
      return message.length > 0 && message.length <= 2000
        ? { ok: true, operation: 'prepare', message }
        : { ok: false, code: 'INVALID' };
    },
    action: async (context, state, condition) => {
      try {
        const { operation, id, message } = condition;
        const result = await service[operation](
          operation === 'prepare' ? message : id,
          context
        );
        return { changed: false, code: 'RESULT', operation, result, message };
      } catch {
        return { changed: false, code: 'STORAGE_ERROR' };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED')
        return createTextResult(MESSAGES.denied);
      if (outcome.code === 'INVALID') return createTextResult(MESSAGES.usage);
      if (outcome.code !== 'RESULT') return createTextResult(MESSAGES.storage);
      const { operation, result } = outcome;
      if (operation === 'prepare') {
        if (!result || result.total === 0)
          return createTextResult(MESSAGES.empty);
        return createTextResult(
          `Sẽ gửi thông báo đến ${result.total} người đã đăng ký trên Zalo:\n\n${outcome.message}\n\n` +
            `Chưa gửi tin nhắn. Xác nhận trong 10 phút tại chat này:\n/zalosay confirm ${result.id}\n` +
            `Hủy: /zalosay cancel ${result.id}`
        );
      }
      if (operation === 'cancel')
        return createTextResult(
          result ? MESSAGES.cancelled : MESSAGES.UNAVAILABLE
        );
      if (operation === 'status')
        return createTextResult(
          result ? formatSummary(result) : MESSAGES.UNAVAILABLE
        );
      if (result.code === 'FINISHED' && result.summary) {
        return createTextResult(
          formatSummary(result.summary) +
            (result.stopReason ? `\n\n${MESSAGES[result.stopReason]}` : '')
        );
      }
      if (result.code === 'PROGRESS_UNAVAILABLE') {
        return createTextResult(
          `${MESSAGES.storage}\n/zalosay status ${result.id}`
        );
      }
      return createTextResult(MESSAGES[result.code] || MESSAGES.storage);
    },
  });
}

module.exports = {
  createZaloBroadcastCommand,
  formatSummary,
  ZALO_BROADCAST_MESSAGES: MESSAGES,
};
