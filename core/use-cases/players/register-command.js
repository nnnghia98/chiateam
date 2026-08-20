const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const { assertPlayerRepository } = require('../../ports/player-repository');
const { parsePositiveInteger } = require('./player-statistics');

const REGISTER_MESSAGES = Object.freeze({
  usage:
    '📋 Cách dùng /register:\n' +
    '• /register NUMBER — tự đăng ký số áo\n' +
    '• /register add NAME NUMBER — admin tạo slot\n' +
    '• /register delete NUMBER — admin xóa cầu thủ',
  permissionDenied: '⛔ Chỉ admin mới có quyền quản lý cầu thủ khác.',
  invalidNumber: '⚠️ Số áo phải là số nguyên dương.',
  invalidName: '⚠️ Tên cầu thủ không hợp lệ.',
  duplicateNumber: '⚠️ Số áo {number} đã được sử dụng bởi {name}.',
  duplicateActor: '⚠️ Bạn đã đăng ký với tên {name} và số áo {number}.',
  unsupportedPlatform:
    '⚠️ Nền tảng này chưa hỗ trợ liên kết tài khoản cầu thủ.',
  selfSuccess:
    '✅ Đăng ký thành công: {name} — số áo {number} — ID {externalId}.',
  guestSuccess:
    '✅ Đã tạo slot cầu thủ: {name} — số áo {number}. Cầu thủ có thể dùng /register {number} để nhận slot.',
  deleteSuccess: '✅ Đã xóa cầu thủ số áo {number}.',
  deleteNotFound: '⚠️ Không tìm thấy cầu thủ số áo {number}.',
  error: '❌ Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.',
});

function parseRegisterRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { kind: 'help' };
  }

  if (args.length === 1) {
    const number = parsePositiveInteger(args[0]);

    return number == null ? null : { kind: 'self', number };
  }

  const action = String(args[0]).trim().toLowerCase();

  if (action === 'delete' && args.length === 2) {
    const number = parsePositiveInteger(args[1]);

    return number == null ? null : { kind: 'delete', number };
  }

  if (action === 'add' && args.length >= 3) {
    const number = parsePositiveInteger(args.at(-1));
    const name = args.slice(1, -1).join(' ').trim();

    return number == null || !name ? null : { kind: 'add', name, number };
  }

  return null;
}

function getResultPlayer(result) {
  return result?.player || result?.data?.player || null;
}

function createRegisterCommand({ playerRepository } = {}) {
  const players = assertPlayerRepository(playerRepository);

  return createCommandDefinition({
    name: 'register',
    aliases: [],
    instruction: {
      usage: '/register NUMBER | add NAME NUMBER | delete NUMBER',
      description: 'Register or manage a football player',
      permission: 'player',
    },
    resolvePermission: context => {
      const action = String(context.args[0] ?? '').toLowerCase();

      return ['add', 'delete'].includes(action) ? 'admin' : 'player';
    },
    stateKeys: [],
    condition: async context => {
      const request = parseRegisterRequest(context.args);

      return request
        ? { ok: true, request }
        : { ok: false, code: 'INVALID_REQUEST' };
    },
    action: async (context, state, condition) => {
      const { request } = condition;

      if (request.kind === 'help') {
        return { changed: false, code: 'REGISTER_HELP' };
      }

      try {
        let result;

        if (request.kind === 'self') {
          result = await players.registerActor(context.actor, request.number);
        } else if (request.kind === 'add') {
          result = await players.registerGuest(request.name, request.number);
        } else {
          result = await players.deleteByNumber(request.number);
        }

        if (!result || typeof result !== 'object') {
          return { changed: false, code: 'REGISTER_FAILED' };
        }

        return {
          changed: false,
          code: result.ok
            ? request.kind === 'self'
              ? 'SELF_REGISTERED'
              : request.kind === 'add'
                ? 'GUEST_REGISTERED'
                : 'PLAYER_DELETED'
            : result.code || 'REGISTER_FAILED',
          request,
          player: getResultPlayer(result),
          actor: context.actor,
        };
      } catch (error) {
        return { changed: false, code: 'REGISTER_FAILED', error };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(REGISTER_MESSAGES.permissionDenied);
      }

      if (
        outcome.code === 'REGISTER_HELP' ||
        outcome.code === 'INVALID_REQUEST'
      ) {
        return createTextResult(REGISTER_MESSAGES.usage);
      }

      if (outcome.code === 'INVALID_NUMBER') {
        return createTextResult(REGISTER_MESSAGES.invalidNumber);
      }

      if (outcome.code === 'INVALID_NAME') {
        return createTextResult(REGISTER_MESSAGES.invalidName);
      }

      if (outcome.code === 'UNSUPPORTED_PLATFORM') {
        return createTextResult(REGISTER_MESSAGES.unsupportedPlatform);
      }

      if (outcome.code === 'NUMBER_IN_USE') {
        return createTextResult(
          REGISTER_MESSAGES.duplicateNumber
            .replace(
              '{number}',
              outcome.player?.number ?? outcome.request.number
            )
            .replace('{name}', outcome.player?.name ?? 'cầu thủ khác')
        );
      }

      if (outcome.code === 'ALREADY_REGISTERED') {
        return createTextResult(
          REGISTER_MESSAGES.duplicateActor
            .replace('{name}', outcome.player?.name ?? 'Không rõ')
            .replace('{number}', outcome.player?.number ?? '?')
        );
      }

      if (outcome.code === 'NOT_FOUND') {
        return createTextResult(
          REGISTER_MESSAGES.deleteNotFound.replace(
            '{number}',
            outcome.request.number
          )
        );
      }

      if (outcome.code === 'SELF_REGISTERED') {
        return createTextResult(
          REGISTER_MESSAGES.selfSuccess
            .replace(
              '{name}',
              outcome.player?.name ?? outcome.actor.displayName
            )
            .replace(
              '{number}',
              outcome.player?.number ?? outcome.request.number
            )
            .replace('{externalId}', outcome.actor.externalId)
        );
      }

      if (outcome.code === 'GUEST_REGISTERED') {
        return createTextResult(
          REGISTER_MESSAGES.guestSuccess
            .replace('{name}', outcome.player?.name ?? outcome.request.name)
            .replaceAll(
              '{number}',
              outcome.player?.number ?? outcome.request.number
            )
        );
      }

      if (outcome.code === 'PLAYER_DELETED') {
        return createTextResult(
          REGISTER_MESSAGES.deleteSuccess.replace(
            '{number}',
            outcome.request.number
          )
        );
      }

      return createTextResult(REGISTER_MESSAGES.error);
    },
  });
}

module.exports = {
  REGISTER_MESSAGES,
  createRegisterCommand,
  parseRegisterRequest,
};
