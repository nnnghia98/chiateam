const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { COMMAND_MANIFEST } = require('../../commands/command-manifest');
const {
  createManagedCommandRules,
} = require('../../commands/managed-command-rules');

const QUICK_START_COMMANDS = ['addme', 'bench', 'chiateam', 'team'];
const CATEGORY_ICONS = {
  Bench: '🪑',
  Team: '⚽',
  'Sân và chi phí': '🏟️',
  Vote: '🗳️',
  'Cầu thủ': '👤',
  'Trận đấu': '🏆',
  Admin: '🔐',
  'Thông báo': '📣',
};

function categoryIcon(category) {
  return Object.prototype.hasOwnProperty.call(CATEGORY_ICONS, category)
    ? CATEGORY_ICONS[category]
    : '📋';
}

function renderHelpRow(segments, entry, rule = {}) {
  const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
  const aliasText =
    aliases.length > 0
      ? ` (hoặc ${aliases.map(alias => `/${alias}`).join(', ')})`
      : '';
  const permission = entry.permission || entry.instruction?.permission;
  const adminText =
    permission === 'admin' || rule.permission === 'admin' ? ' (admin)' : '';

  segments.push(
    { text: entry.usage, bold: true },
    { text: `${aliasText} — ${entry.description}${adminText}\n` }
  );
}

function visibleEntries(manifest, context, commandRules) {
  return manifest
    .filter(entry => entry.name !== 'start')
    .map(entry => ({ entry, rule: commandRules(context, entry) || {} }))
    .filter(({ rule }) => rule.enabled !== false);
}

function buildStartHelpSegments(
  manifest = COMMAND_MANIFEST,
  {
    includeQuickStart = true,
    greeting = '👋 CHIATEAM BOT',
    entryRules = new Map(),
  } = {}
) {
  const safeGreeting = String(greeting ?? '').trim() || '👋 CHIATEAM BOT';
  const segments = [{ text: safeGreeting, bold: true }, { text: '\n\n' }];
  const entries = manifest.filter(entry => entry.name !== 'start');

  if (includeQuickStart) {
    const quickEntries = QUICK_START_COMMANDS.map(name =>
      entries.find(entry => entry.name === name)
    ).filter(Boolean);
    if (quickEntries.length > 0) {
      segments.push({ text: '🚀 BẮT ĐẦU NHANH', bold: true }, { text: '\n' });
      quickEntries.forEach(entry =>
        renderHelpRow(segments, entry, entryRules.get(entry.name))
      );
    }
  }

  const quickNames = new Set(QUICK_START_COMMANDS);
  const categories = new Map();
  entries
    .filter(entry => !includeQuickStart || !quickNames.has(entry.name))
    .forEach(entry => {
      if (!categories.has(entry.category)) categories.set(entry.category, []);
      categories.get(entry.category).push(entry);
    });

  if (includeQuickStart && categories.size > 0) {
    segments.push(
      { text: '\n' },
      { text: '📚 DANH SÁCH LỆNH', bold: true },
      { text: '\n' }
    );
  }
  categories.forEach((categoryEntries, category) => {
    segments.push(
      { text: '\n' },
      {
        text: `${categoryIcon(category)} ${category.toUpperCase()}`,
        bold: true,
      },
      { text: '\n' }
    );
    categoryEntries.forEach(entry =>
      renderHelpRow(segments, entry, entryRules.get(entry.name))
    );
  });

  if (entries.length === 0) {
    segments.push({ text: 'Hiện chưa có lệnh nào khả dụng.\n' });
  }

  segments.push(
    { text: '\nDùng ' },
    { text: '/start', bold: true },
    { text: ' bất cứ lúc nào để xem lại hướng dẫn. 💡' }
  );

  return segments;
}

function buildTelegramMenuHelpSegments(greeting = '👋 CHIATEAM BOT') {
  const safeGreeting = String(greeting ?? '').trim() || '👋 CHIATEAM BOT';

  return [
    { text: safeGreeting, bold: true },
    {
      text:
        '\n\nBot giúp đội quản lý bình chọn, bench và team ngay trên Telegram.' +
        '\n\nChọn một nút trong menu bên dưới để bắt đầu.' +
        '\nBạn vẫn có thể nhập các lệnh được hỗ trợ trực tiếp.' +
        '\n\nDùng /start để hiện lại menu.',
    },
  ];
}

function createStartCommand({
  manifest = COMMAND_MANIFEST,
  includeQuickStart = true,
  getGreeting,
  commandRules = createManagedCommandRules(),
  menuOnly = false,
} = {}) {
  return createCommandDefinition({
    name: 'start',
    aliases: [],
    instruction: {
      usage: '/start',
      description: 'Show help generated from the supported command manifest',
      permission: 'player',
    },
    stateKeys: [],
    condition: async () => ({ ok: true }),
    action: async () => ({ changed: false, code: 'START_HELP' }),
    reply: async (outcome, context) => {
      if (outcome?.code === 'PERMISSION_DENIED') {
        return createTextResult('Bạn không có quyền thực hiện lệnh này.', [], {
          channel: 'source',
        });
      }

      if (menuOnly) {
        return createRichTextResult(
          buildTelegramMenuHelpSegments(getGreeting?.(context.actor)),
          [],
          { channel: 'source' }
        );
      }

      const selected = visibleEntries(manifest, context, commandRules);
      const selectedManifest = selected.map(({ entry }) => entry);
      const entryRules = new Map(
        selected.map(({ entry, rule }) => [entry.name, rule])
      );
      const segments = buildStartHelpSegments(selectedManifest, {
        includeQuickStart,
        greeting: getGreeting?.(context.actor),
        entryRules,
      });
      return createRichTextResult(segments, [], {
        channel: 'source',
      });
    },
  });
}

module.exports = {
  buildStartHelpSegments,
  buildTelegramMenuHelpSegments,
  createStartCommand,
};
