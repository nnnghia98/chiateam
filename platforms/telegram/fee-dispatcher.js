const { requestJson } = require('../../bot/utils/api-client');
const { formatMoney } = require('../../core/use-cases/management/money');
const {
  createVietQrPng,
} = require('../../core/use-cases/management/vietqr-payment');

function createTelegramFeeDispatcher({ bot, request = requestJson } = {}) {
  if (!bot || typeof bot.sendPhoto !== 'function') {
    throw new TypeError('Fee dispatcher requires a Telegram bot client.');
  }

  async function listAccounts() {
    return request('/api/fee-accounts');
  }

  async function getStatus() {
    return request('/api/fee-batches/today');
  }

  async function send({ accountId, recipients, adminId }) {
    const batch = await request('/api/fee-batches', {
      method: 'POST',
      body: { accountId, recipients, createdBy: String(adminId) },
    });
    const report = { sent: [], failed: [], alreadySent: [], uncertain: [] };

    for (const row of batch.requests) {
      if (row.status === 'sent') {
        report.alreadySent.push(row.name);
        continue;
      }
      if (row.status === 'sending') {
        report.uncertain.push(row.name);
        continue;
      }
      let claim;
      try {
        claim = await request(`/api/fee-requests/${row.id}/claim`, {
          method: 'POST',
        });
      } catch (_) {
        report.uncertain.push(row.name);
        continue;
      }
      if (!claim.claimed) {
        report.uncertain.push(row.name);
        continue;
      }
      let message;
      try {
        const caption = [
          `💳 Phí của ${row.name} (${row.team})`,
          `Số tiền: ${formatMoney(row.amount)} VND`,
          `Người nhận: ${batch.account.hostName}`,
          `Ngân hàng: ${batch.account.bankName || batch.account.bankBin}`,
          `Số tài khoản: ${batch.account.accountNumber}`,
          `Chủ tài khoản: ${batch.account.accountName}`,
          `Nội dung: ${row.transferNote}`,
        ].join('\n');
        const image = await createVietQrPng({
          settings: batch.account,
          amount: row.amount,
          transferNote: row.transferNote,
        });
        message = await bot.sendPhoto(
          row.userId,
          image,
          { caption },
          {
            filename: 'payment-qr.png',
            contentType: 'image/png',
          }
        );
      } catch (error) {
        try {
          await request(`/api/fee-requests/${row.id}/finish`, {
            method: 'POST',
            body: {
              status: 'failed',
              errorCode: error.code || 'TELEGRAM_SEND_FAILED',
            },
          });
          report.failed.push(row.name);
        } catch (_) {
          report.uncertain.push(row.name);
        }
        continue;
      }
      try {
        await request(`/api/fee-requests/${row.id}/finish`, {
          method: 'POST',
          body: { status: 'sent', messageId: message.message_id },
        });
        report.sent.push(row.name);
      } catch (_) {
        // Telegram sent the message, but the API did not confirm the status.
        report.uncertain.push(row.name);
      }
    }

    return { batchId: batch.id, billDate: batch.billDate, report };
  }

  return { listAccounts, getStatus, send };
}

module.exports = { createTelegramFeeDispatcher };
