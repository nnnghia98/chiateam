const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createCommandResult,
  createTextResult,
} = require('../../contracts/command-result');
const { normalizeFeeState } = require('./fee-view');
const { calculateTwoTeamFee, roundUpFee } = require('./two-team-fee');
const { formatMoney } = require('./money');

const STATE_KEYS = [
  'tiensan',
  'tiennuoc',
  'teamThua',
  'teamA',
  'teamB',
  'team3A',
  'team3B',
  'team3C',
];

function buildRecipients(state, feeState) {
  const breakdown = calculateTwoTeamFee(feeState);
  const perMember = roundUpFee(
    feeState.tiensan / (feeState.teamA.length + feeState.teamB.length)
  );
  const missing = [];
  const seen = new Set();
  const recipients = [];

  for (const [key, team] of [
    ['teamA', 'HOME'],
    ['teamB', 'AWAY'],
  ]) {
    for (const entry of state[key]) {
      const member = entry?.[1];
      const name = typeof member === 'string' ? member : member?.name;
      const id = Number(member?.userId ?? entry?.[0]);
      if (!name || !Number.isSafeInteger(id) || id <= 0 || seen.has(id)) {
        missing.push(String(name || 'Không rõ tên'));
        continue;
      }
      seen.add(id);
      recipients.push({
        userId: id,
        name,
        team,
        amount: breakdown
          ? team === breakdown.loserName
            ? breakdown.loserTotal
            : breakdown.winnerTotal
          : perMember,
      });
    }
  }
  return { recipients, missing };
}

function createChunkedResult(lines) {
  const messages = [];
  let chunk = '';
  for (const line of lines) {
    if (chunk && chunk.length + line.length + 1 > 3500) {
      messages.push({ text: chunk });
      chunk = '';
    }
    chunk += `${chunk ? '\n' : ''}${line}`;
  }
  if (chunk) messages.push({ text: chunk });
  return createCommandResult({ messages });
}

function formatAccounts(accounts) {
  if (accounts.length === 0) {
    return createTextResult(
      '⚠️ Chưa có tài khoản ngân hàng của host đang hoạt động. Thêm host và tài khoản qua admin panel backend trước.'
    );
  }
  return createChunkedResult([
    '🏦 Tài khoản nhận tiền. Dùng /guichiatien ID sau khi xem /chiatien:',
    ...accounts.map(
      account =>
        `${account.id}. ${account.hostName} — ${account.bankName || account.bankBin} ${account.accountNumber}${account.isDefault ? ' (mặc định)' : ''}`
    ),
  ]);
}

function formatReport(outcome) {
  const { report } = outcome;
  const lines = [
    `📨 Đợt phí #${outcome.batchId} (${outcome.billDate})`,
    `Đã gửi: ${report.sent.length}`,
    `Đã gửi trước đó: ${report.alreadySent.length}`,
    `Gửi lỗi: ${report.failed.length}`,
    `Cần kiểm tra thủ công: ${report.uncertain.length}`,
  ];
  if (report.failed.length) {
    lines.push('Gửi lỗi:');
    lines.push(...report.failed.map(name => `• ${name}`));
  }
  if (report.uncertain.length) {
    lines.push('Chưa rõ trạng thái:');
    lines.push(...report.uncertain.map(name => `• ${name}`));
  }
  return createChunkedResult(lines);
}

function formatStatus(batch) {
  const lines = [`📨 Đợt phí #${batch.id} (${batch.billDate})`];
  lines.push(
    ...batch.requests.map(
      row =>
        `${row.name}: ${formatMoney(row.amount)} VND — ${row.transferNote} — ${row.status}`
    )
  );
  return createChunkedResult(lines);
}

function createGuichiatienCommand({ dispatcher } = {}) {
  return createCommandDefinition({
    name: 'guichiatien',
    instruction: {
      usage: '/guichiatien [ACCOUNT_ID|accounts|status]',
      description:
        'Send each player their own fee and bank QR by private message',
      permission: 'admin',
    },
    stateKeys: STATE_KEYS,
    resolveStateKeys: context =>
      ['accounts', 'status'].includes(context.args[0]) ? [] : STATE_KEYS,
    condition: async (context, state) => {
      if (
        context.actor.platform !== 'telegram' ||
        context.conversation.type !== 'private'
      ) {
        return { ok: false, code: 'PRIVATE_ONLY' };
      }
      if (
        context.args.length > 1 ||
        (context.args.length === 1 &&
          !['accounts', 'status'].includes(context.args[0]) &&
          !/^[1-9]\d*$/.test(context.args[0]))
      ) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }
      if (context.args[0] === 'accounts') return { ok: true, listOnly: true };
      if (context.args[0] === 'status') return { ok: true, statusOnly: true };
      const feeState = normalizeFeeState(state);
      if (!feeState) return { ok: false, code: 'INVALID_FEE_STATE' };
      if (feeState.tiensan <= 0)
        return { ok: false, code: 'MISSING_VENUE_FEE' };
      if (feeState.teamA.length + feeState.teamB.length === 0) {
        return { ok: false, code: 'NO_MEMBERS' };
      }
      const members = buildRecipients(state, feeState);
      if (
        members.missing.length ||
        members.recipients.length !==
          feeState.teamA.length + feeState.teamB.length
      ) {
        return {
          ok: false,
          code: 'MISSING_TELEGRAM_IDS',
          names: members.missing,
        };
      }
      return { ok: true, recipients: members.recipients };
    },
    action: async (context, state, condition) => {
      if (!dispatcher) return { changed: false, code: 'DISPATCH_UNAVAILABLE' };
      if (condition.statusOnly) {
        try {
          return {
            changed: false,
            code: 'STATUS',
            batch: await dispatcher.getStatus(),
          };
        } catch (_) {
          return { changed: false, code: 'SEND_FAILED' };
        }
      }
      let accounts;
      try {
        accounts = await dispatcher.listAccounts();
      } catch (_) {
        return { changed: false, code: 'ACCOUNT_LOAD_FAILED' };
      }
      if (condition.listOnly)
        return { changed: false, code: 'ACCOUNTS', accounts };
      if (!accounts.length) return { changed: false, code: 'NO_ACCOUNTS' };
      const requestedId = context.args[0] ? Number(context.args[0]) : null;
      const defaults = accounts.filter(account => account.isDefault);
      const account = requestedId
        ? accounts.find(item => item.id === requestedId)
        : defaults.length === 1
          ? defaults[0]
          : accounts.length === 1
            ? accounts[0]
            : null;
      if (!account) return { changed: false, code: 'SELECT_ACCOUNT', accounts };
      try {
        const result = await dispatcher.send({
          accountId: account.id,
          recipients: condition.recipients,
          adminId: context.actor.externalId,
        });
        return { changed: false, code: 'SENT', result };
      } catch (error) {
        return {
          changed: false,
          code:
            error.responseBody?.error === 'BATCH_ALREADY_EXISTS_DIFFERENT_SPLIT'
              ? 'SPLIT_CHANGED'
              : 'SEND_FAILED',
        };
      }
    },
    reply: async outcome => {
      const messages = {
        PERMISSION_DENIED: '⛔ Chỉ admin mới có quyền gửi phí.',
        PRIVATE_ONLY: '⚠️ Hãy nhắn riêng cho bot để dùng /guichiatien.',
        INVALID_ARGUMENTS:
          '⚠️ Dùng /guichiatien, /guichiatien accounts, /guichiatien status hoặc /guichiatien ID.',
        INVALID_FEE_STATE: '❌ Không đọc được dữ liệu chia tiền.',
        STATE_LOAD_FAILED: '❌ Không tải được dữ liệu chia tiền.',
        MISSING_VENUE_FEE: '⚠️ Chưa có tiền sân. Dùng /tiensan trước.',
        NO_MEMBERS: '⚠️ Chưa có thành viên trong hai team.',
        DISPATCH_UNAVAILABLE: '❌ Chức năng gửi phí chưa được cấu hình.',
        ACCOUNT_LOAD_FAILED: '❌ Không tải được tài khoản ngân hàng.',
        NO_ACCOUNTS:
          '⚠️ Chưa có tài khoản host đang hoạt động trong admin panel backend.',
        SPLIT_CHANGED:
          '⚠️ Đã có đợt gửi phí hôm nay với số tiền hoặc tài khoản khác. Hãy kiểm tra trước khi gửi lại.',
        SEND_FAILED:
          '❌ Không thể hoàn tất gửi phí. Hãy kiểm tra báo cáo gửi trước khi thử lại.',
      };
      if (outcome.code === 'MISSING_TELEGRAM_IDS') {
        return createTextResult(
          `⚠️ Thiếu Telegram ID hoặc trùng người: ${outcome.names.join(', ')}. Chưa gửi ai.`,
          [],
          { channel: 'source' }
        );
      }
      if (outcome.code === 'ACCOUNTS' || outcome.code === 'SELECT_ACCOUNT') {
        return formatAccounts(outcome.accounts);
      }
      if (outcome.code === 'SENT') return formatReport(outcome.result);
      if (outcome.code === 'STATUS') {
        return outcome.batch
          ? formatStatus(outcome.batch)
          : createTextResult('Chưa có đợt gửi phí hôm nay.');
      }
      return createTextResult(
        messages[outcome.code] || '❌ Không thể gửi phí.'
      );
    },
  });
}

module.exports = { createGuichiatienCommand };
