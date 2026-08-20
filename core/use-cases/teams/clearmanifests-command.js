const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');

const CLEARMANIFESTS_MESSAGES = Object.freeze({
  usage:
    '⚠️ Dùng /clearmanifests, /clearmanifests confirm hoặc ' +
    '/clearmanifests cancel.',
  confirmation:
    '⚠️ Xóa tất cả manifest?\n' + 'Dùng /clearmanifests confirm để xác nhận.',
  cancelled: '✅ Đã hủy xóa manifest.',
  empty: 'Chưa có manifest nào.',
  success: '✅ Đã xóa tất cả manifest.',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  loadError: '❌ Không thể tải manifest hiện tại từ API.',
  saveError: '❌ Không thể lưu thay đổi manifest. Vui lòng thử lại.',
});

function parseClearmanifestsRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { kind: 'confirm' };
  }

  if (args.length !== 1) {
    return null;
  }

  const action = String(args[0]).toLowerCase();

  if (action === 'confirm') {
    return { kind: 'clear' };
  }

  if (action === 'cancel') {
    return { kind: 'cancel' };
  }

  return null;
}

function hasManifests(value) {
  if (value == null) {
    return false;
  }

  return !Array.isArray(value) || value.length > 0;
}

function createConfirmationActions() {
  return [
    {
      id: 'clearmanifests_confirm',
      label: '✅ Xác nhận',
      command: '/clearmanifests confirm',
    },
    {
      id: 'clearmanifests_cancel',
      label: 'Hủy',
      command: '/clearmanifests cancel',
    },
  ];
}

function createClearmanifestsCommand() {
  return createCommandDefinition({
    name: 'clearmanifests',
    aliases: [],
    instruction: {
      usage: '/clearmanifests [confirm|cancel]',
      description: 'Clear every team constraint after confirmation',
      permission: 'admin',
    },
    stateKeys: ['manifest'],
    condition: async (context, state) => {
      const request = parseClearmanifestsRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      if (request.kind === 'cancel') {
        return { ok: true, request };
      }

      if (!hasManifests(state.manifest)) {
        return { ok: false, code: 'EMPTY_MANIFESTS' };
      }

      return { ok: true, request };
    },
    action: async (context, state, condition) => {
      if (condition.request.kind === 'cancel') {
        return { changed: false, code: 'CLEAR_CANCELLED' };
      }

      if (condition.request.kind === 'confirm') {
        return { changed: false, code: 'CONFIRMATION_REQUIRED' };
      }

      return {
        changed: true,
        code: 'MANIFESTS_CLEARED',
        changes: { manifest: null },
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(CLEARMANIFESTS_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_REQUEST') {
        return createTextResult(CLEARMANIFESTS_MESSAGES.usage);
      }

      if (outcome.code === 'STATE_LOAD_FAILED') {
        return createTextResult(CLEARMANIFESTS_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(CLEARMANIFESTS_MESSAGES.saveError);
      }

      if (outcome.code === 'EMPTY_MANIFESTS') {
        return createTextResult(CLEARMANIFESTS_MESSAGES.empty);
      }

      if (outcome.code === 'CLEAR_CANCELLED') {
        return createTextResult(CLEARMANIFESTS_MESSAGES.cancelled);
      }

      if (outcome.code === 'CONFIRMATION_REQUIRED') {
        return createTextResult(
          CLEARMANIFESTS_MESSAGES.confirmation,
          createConfirmationActions()
        );
      }

      return createTextResult(CLEARMANIFESTS_MESSAGES.success);
    },
  });
}

module.exports = {
  CLEARMANIFESTS_MESSAGES,
  createClearmanifestsCommand,
  createConfirmationActions,
  hasManifests,
  parseClearmanifestsRequest,
};
