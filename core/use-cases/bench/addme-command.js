const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  assertBenchIdentityPolicy,
  createDefaultBenchIdentityPolicy,
} = require('../../ports/bench-identity-policy');
const {
  hasDuplicateName,
  isValidMemberName,
  normalizeName,
} = require('./bench-member');

const ADDME_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /addme không kèm tham số.',
  invalidName: '⚠️ Tên không hợp lệ.',
  duplicate: '⚠️ Đã có tên {name} trong bench.',
  success: '✅ {name} lên bench!',
  loadError: '❌ Không thể tải bench hiện tại từ API.',
  saveError: '❌ Không thể thêm bạn vào bench. Vui lòng thử lại.',
});

function formatMemberName(actor, name) {
  const username = String(actor.username ?? '')
    .trim()
    .replace(/^@/, '');

  return username ? `${name} (@${username})` : name;
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });
const createSuccessResult = text =>
  createTextResult(text, [], { channel: 'main' });

function createAddmeCommand({ identityPolicy } = {}) {
  const activeIdentityPolicy = assertBenchIdentityPolicy(
    identityPolicy || createDefaultBenchIdentityPolicy()
  );

  return createCommandDefinition({
    name: 'addme',
    aliases: [],
    instruction: {
      usage: '/addme',
      description: 'Add the current actor to the bench',
      permission: 'player',
    },
    stateKeys: ['bench'],
    condition: async (context, state) => {
      if (context.args.length > 0) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      if (!Array.isArray(state.bench)) {
        return { ok: false, code: 'INVALID_BENCH_STATE' };
      }

      const name = normalizeName(context.actor.displayName);

      if (!isValidMemberName(name)) {
        return { ok: false, code: 'INVALID_NAME' };
      }

      const duplicateIdentity = state.bench.some(entry =>
        activeIdentityPolicy.matchesEntry(entry, context.actor)
      );

      if (duplicateIdentity || hasDuplicateName(state.bench, name)) {
        return { ok: false, code: 'DUPLICATE_MEMBER', name };
      }

      return {
        ok: true,
        name,
        memberName: formatMemberName(context.actor, name),
      };
    },
    action: async (context, state, condition) => {
      const entry = activeIdentityPolicy.createEntry(
        context.actor,
        condition.memberName
      );

      return {
        changed: true,
        code: 'MEMBER_ADDED',
        changes: { bench: [...state.bench, entry] },
        memberName: condition.memberName,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(ADDME_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_BENCH_STATE'
      ) {
        return createDefaultResult(ADDME_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(ADDME_MESSAGES.saveError);
      }

      if (outcome.code === 'INVALID_NAME') {
        return createDefaultResult(ADDME_MESSAGES.invalidName);
      }

      if (outcome.code === 'DUPLICATE_MEMBER') {
        return createDefaultResult(
          ADDME_MESSAGES.duplicate.replace('{name}', outcome.name)
        );
      }

      return createSuccessResult(
        ADDME_MESSAGES.success.replace('{name}', outcome.memberName)
      );
    },
  });
}

module.exports = {
  ADDME_MESSAGES,
  createAddmeCommand,
  formatMemberName,
};
