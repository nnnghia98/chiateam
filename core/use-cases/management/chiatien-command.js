const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createCommandResult,
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const {
  buildDetailedSplitSegments,
  buildSimpleSplitMessage,
  formatMoney,
  normalizeFeeState,
} = require('./fee-view');
const { calculateTwoTeamFee } = require('./two-team-fee');
const {
  createTransferNote,
  createVietQrPng,
  getVietQrSettings,
} = require('./vietqr-payment');

const CHIATIEN_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /chiatien không kèm tham số.',
  noFee: '💸 Bạn chưa thêm tiền sân. Dùng /tiensan [số tiền] trước.',
  noMembers: '⚠️ Không có thành viên nào trong team để chia tiền.',
  threeTeamUnsupported:
    '⚠️ Chưa hỗ trợ chia tiền cho 3 team. Tính năng này sẽ được bổ sung sau.',
  loadError: '❌ Không thể tải dữ liệu chia tiền hiện tại từ API.',
});

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });
const createAnnouncementResult = text =>
  createTextResult(text, [], { channel: 'announcement' });
const createRichAnnouncementResult = segments =>
  createRichTextResult(segments, [], { channel: 'announcement' });

function createDetailedFeeRows(breakdown) {
  return [
    ...breakdown.winnerMembers.map(name => ({
      name,
      team: breakdown.winnerName,
      amount: breakdown.winnerTotal,
    })),
    ...breakdown.loserMembers.map(name => ({
      name,
      team: breakdown.loserName,
      amount: breakdown.loserTotal,
    })),
  ];
}

function createSimpleFeeRows(feeState, amount) {
  return [
    ...feeState.teamA.map(name => ({ name, team: 'HOME', amount })),
    ...feeState.teamB.map(name => ({ name, team: 'AWAY', amount })),
  ];
}

function normalizePlayerName(name) {
  return String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPlayerFeeRow(row, index) {
  return `${index + 1}. ${normalizePlayerName(row.name)} (${row.team}): ${formatMoney(row.amount)} VND`;
}

function isTelegramAdmin(context, env) {
  if (context?.actor?.platform !== 'telegram') {
    return false;
  }

  const actorId = String(context.actor.externalId ?? '').trim();
  const adminIds = [
    env.BOT_OWNER_ID,
    ...String(env.BOT_ADMIN_IDS ?? '').split(','),
  ]
    .map(id => String(id ?? '').trim())
    .filter(Boolean);

  return actorId !== '' && adminIds.includes(actorId);
}

async function createAdminPaymentMessages(rows, settings) {
  if (!settings.ok) {
    const codes = rows
      .map(
        (row, index) =>
          `${index + 1}. ${normalizePlayerName(row.name)}: ${row.transferNote}`
      )
      .join('\n');

    return [
      {
        text: `🔐 Mã chuyển khoản từng người:\n${codes}`,
        channel: 'private',
      },
    ];
  }

  return Promise.all(
    rows.map(async row => {
      const photoBuffer = await createVietQrPng({
        settings,
        amount: row.amount,
        transferNote: row.transferNote,
      });
      const lines = [
        `💳 ${normalizePlayerName(row.name)} (${row.team})`,
        `Số tiền: ${formatMoney(row.amount)} VND`,
        `Ngân hàng: ${settings.bankName || settings.bankBin}`,
        `Số tài khoản: ${settings.accountNumber}`,
        ...(settings.accountName
          ? [`Chủ tài khoản: ${settings.accountName}`]
          : []),
        `Nội dung: ${row.transferNote}`,
      ];

      return {
        text: lines.join('\n'),
        photoBuffer,
        channel: 'private',
      };
    })
  );
}

async function addPlayerFeeMessages(summaryResult, feeRows, env, context) {
  const settings = getVietQrSettings(env);
  const admin = isTelegramAdmin(context, env);
  const generatedAt = new Date();
  const rows = feeRows.map((row, index) => ({
    ...row,
    transferNote: admin
      ? createTransferNote(row.name, index, generatedAt)
      : null,
  }));
  const feeList = rows
    .map((row, index) => formatPlayerFeeRow(row, index))
    .join('\n');
  const messages = [...summaryResult.messages];

  if (!settings.ok) {
    const notice =
      settings.reason === 'missing'
        ? '⚠️ Chưa tạo QR. Admin cần cấu hình tài khoản nhận tiền.'
        : '⚠️ Chưa tạo QR. Admin cần kiểm tra PAYMENT_BANK_BIN và PAYMENT_ACCOUNT_NUMBER.';
    messages.push({ text: notice, channel: 'announcement' });
  }

  messages.push({
    text: `💳 Phí từng người:\n${feeList}`,
    channel: 'announcement',
  });

  if (admin) {
    messages.push(...(await createAdminPaymentMessages(rows, settings)));
  }

  return createCommandResult({ messages });
}

function createChiatienCommand({ env = process.env } = {}) {
  return createCommandDefinition({
    name: 'chiatien',
    aliases: [],
    instruction: {
      usage: '/chiatien',
      description:
        'Calculate each player’s fee; send transfer codes and QR details privately to admins',
      permission: 'player',
    },
    stateKeys: [
      'tiensan',
      'tiennuoc',
      'teamThua',
      'teamA',
      'teamB',
      'team3A',
      'team3B',
      'team3C',
    ],
    condition: async (context, state) => {
      if (context.args.length > 0) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      const feeState = normalizeFeeState(state);

      return feeState
        ? { ok: true, feeState }
        : { ok: false, code: 'INVALID_FEE_STATE' };
    },
    action: async (context, state, condition) => {
      const feeState = condition.feeState;

      if (feeState.tiensan === 0) {
        return { changed: false, code: 'MISSING_VENUE_FEE' };
      }

      const totalMembers = feeState.teamA.length + feeState.teamB.length;

      if (totalMembers === 0) {
        const hasThreeTeams =
          feeState.team3A.length +
            feeState.team3B.length +
            feeState.team3C.length >
          0;

        return {
          changed: false,
          code: hasThreeTeams ? 'THREE_TEAM_UNSUPPORTED' : 'NO_MEMBERS',
        };
      }

      const breakdown = calculateTwoTeamFee({
        tiensan: feeState.tiensan,
        tiennuoc: feeState.tiennuoc,
        teamThua: feeState.teamThua,
        teamA: feeState.teamA,
        teamB: feeState.teamB,
      });

      if (breakdown) {
        return {
          changed: false,
          code: 'DETAILED_SPLIT',
          tiensan: feeState.tiensan,
          tiennuoc: feeState.tiennuoc,
          breakdown,
          feeRows: createDetailedFeeRows(breakdown),
        };
      }

      return {
        changed: false,
        code: 'SIMPLE_SPLIT',
        tiensan: feeState.tiensan,
        totalMembers,
        perMember: Math.ceil(feeState.tiensan / totalMembers),
        feeRows: createSimpleFeeRows(
          feeState,
          Math.ceil(feeState.tiensan / totalMembers)
        ),
      };
    },
    reply: async (outcome, context) => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(CHIATIEN_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_FEE_STATE'
      ) {
        return createDefaultResult(CHIATIEN_MESSAGES.loadError);
      }

      if (outcome.code === 'MISSING_VENUE_FEE') {
        return createDefaultResult(CHIATIEN_MESSAGES.noFee);
      }

      if (outcome.code === 'THREE_TEAM_UNSUPPORTED') {
        return createDefaultResult(CHIATIEN_MESSAGES.threeTeamUnsupported);
      }

      if (outcome.code === 'NO_MEMBERS') {
        return createDefaultResult(CHIATIEN_MESSAGES.noMembers);
      }

      if (outcome.code === 'DETAILED_SPLIT') {
        return addPlayerFeeMessages(
          createRichAnnouncementResult(buildDetailedSplitSegments(outcome)),
          outcome.feeRows,
          env,
          context
        );
      }

      if (outcome.code === 'SIMPLE_SPLIT') {
        return addPlayerFeeMessages(
          createAnnouncementResult(buildSimpleSplitMessage(outcome)),
          outcome.feeRows,
          env,
          context
        );
      }

      return createAnnouncementResult(buildSimpleSplitMessage(outcome));
    },
  });
}

module.exports = {
  CHIATIEN_MESSAGES,
  buildDetailedSplitSegments,
  buildSimpleSplitMessage,
  createDetailedFeeRows,
  createSimpleFeeRows,
  createChiatienCommand,
  formatMoney,
  normalizeFeeState,
};
