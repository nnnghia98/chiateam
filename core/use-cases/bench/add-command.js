const { randomUUID } = require('node:crypto');

const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  getBaseMemberName,
  isValidMemberName,
  normalizeName,
} = require('./bench-member');

const ADD_MESSAGES = Object.freeze({
  usage:
    '📋 Cách sử dụng /add:\n' +
    '• /add TÊN 1, TÊN 2, ...\n\n' +
    'Ví dụ: /add Nghia, Minh 1',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  invalidNames: '⚠️ Không thêm member nào. Tên không hợp lệ: {names}',
  noNewMembers:
    '⚠️ Không có member mới được thêm. Đã có trong /bench:\n{names}',
  success: '✅ Đã thêm {count} member(s) vào /bench:\n{names}',
  skipped: '⏭️ Đã bỏ qua {count} tên đã có:\n{names}',
  loadError: '❌ Không thể tải bench hiện tại từ API.',
  saveError: '❌ Không thể lưu member mới. Vui lòng thử lại.',
});

function parseGuestNames(args) {
  return args.join(' ').split(',').map(normalizeName).filter(Boolean);
}

function selectGuestNames(bench, requestedNames) {
  const knownNames = new Set(
    bench
      .filter(entry => Array.isArray(entry) && entry.length >= 2)
      .map(([, member]) => getBaseMemberName(member).toLowerCase())
      .filter(Boolean)
  );
  const namesToAdd = [];
  const skippedNames = [];

  requestedNames.forEach(name => {
    const normalizedName = name.toLowerCase();

    if (knownNames.has(normalizedName)) {
      skippedNames.push(name);
      return;
    }

    knownNames.add(normalizedName);
    namesToAdd.push(name);
  });

  return { namesToAdd, skippedNames };
}

function createGuestEntry(name, createGuestId, usedKeys) {
  const memberId = String(createGuestId(name)).trim();

  if (!memberId || usedKeys.has(memberId)) {
    throw new Error('Guest identity generator returned a duplicate ID.');
  }

  usedKeys.add(memberId);
  return [memberId, { name, memberId }];
}

function buildSuccessMessage(addedNames, skippedNames) {
  const sections = [
    ADD_MESSAGES.success
      .replace('{count}', addedNames.length)
      .replace('{names}', addedNames.join('\n')),
  ];

  if (skippedNames.length > 0) {
    sections.push(
      ADD_MESSAGES.skipped
        .replace('{count}', skippedNames.length)
        .replace('{names}', skippedNames.join('\n'))
    );
  }

  return sections.join('\n\n');
}

const createAddResult = text =>
  createTextResult(text, [], { channel: 'default' });

function createAddCommand({
  createGuestId = () => `guest:${randomUUID()}`,
} = {}) {
  if (typeof createGuestId !== 'function') {
    throw new TypeError('createGuestId must be a function.');
  }

  return createCommandDefinition({
    name: 'add',
    aliases: [],
    instruction: {
      usage: '/add NAME[, NAME...]',
      description: 'Add named guests to the bench',
      permission: 'admin',
    },
    stateKeys: ['bench'],
    condition: async (context, state) => {
      if (!Array.isArray(state.bench)) {
        return { ok: false, code: 'INVALID_BENCH_STATE' };
      }

      const requestedNames = parseGuestNames(context.args);

      if (requestedNames.length === 0) {
        return { ok: false, code: 'MISSING_NAMES' };
      }

      const invalidNames = requestedNames.filter(
        name => !isValidMemberName(name)
      );

      if (invalidNames.length > 0) {
        return { ok: false, code: 'INVALID_NAMES', invalidNames };
      }

      return {
        ok: true,
        ...selectGuestNames(state.bench, requestedNames),
      };
    },
    action: async (context, state, condition) => {
      if (condition.namesToAdd.length === 0) {
        return {
          changed: false,
          code: 'NO_NEW_MEMBERS',
          skippedNames: condition.skippedNames,
        };
      }

      const usedKeys = new Set(
        state.bench
          .filter(entry => Array.isArray(entry) && entry.length >= 1)
          .map(([key]) => String(key))
      );
      const addedEntries = condition.namesToAdd.map(name =>
        createGuestEntry(name, createGuestId, usedKeys)
      );

      return {
        changed: true,
        code: 'MEMBERS_ADDED',
        changes: { bench: [...state.bench, ...addedEntries] },
        addedNames: condition.namesToAdd,
        skippedNames: condition.skippedNames,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createAddResult(ADD_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'MISSING_NAMES') {
        return createAddResult(ADD_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_BENCH_STATE'
      ) {
        return createAddResult(ADD_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createAddResult(ADD_MESSAGES.saveError);
      }

      if (outcome.code === 'INVALID_NAMES') {
        return createAddResult(
          ADD_MESSAGES.invalidNames.replace(
            '{names}',
            outcome.invalidNames.join(', ')
          )
        );
      }

      if (outcome.code === 'NO_NEW_MEMBERS') {
        return createAddResult(
          ADD_MESSAGES.noNewMembers.replace(
            '{names}',
            outcome.skippedNames.join('\n')
          )
        );
      }

      return createAddResult(
        buildSuccessMessage(outcome.addedNames, outcome.skippedNames)
      );
    },
  });
}

module.exports = {
  ADD_MESSAGES,
  buildSuccessMessage,
  createAddCommand,
  createGuestEntry,
  parseGuestNames,
  selectGuestNames,
};
