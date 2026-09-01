const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createRichTextResult } = require('../../contracts/command-result');
const { COMMAND_MANIFEST } = require('../../commands/command-manifest');

function buildStartHelpSegments(
  manifest = COMMAND_MANIFEST,
  { includeQuickStart = true } = {}
) {
  const segments = [{ text: '👋 CHIATEAM BOT', bold: true }, { text: '\n\n' }];
  let currentCategory = null;

  if (includeQuickStart) {
    segments.push(
      { text: 'BẮT ĐẦU NHANH', bold: true },
      { text: '\n/addme — Tự thêm mình vào bench\n' },
      { text: '/bench — Xem bench hiện tại\n' },
      { text: '/chiateam — Chia team (admin)\n' },
      { text: '/team — Xem team hiện tại\n' }
    );
  }

  manifest.forEach(entry => {
    if (entry.name === 'start') {
      return;
    }

    if (entry.category !== currentCategory) {
      currentCategory = entry.category;
      segments.push({
        text: `\n${currentCategory.toUpperCase()}\n`,
        bold: true,
      });
    }

    const aliasText =
      entry.aliases.length > 0
        ? ` (alias: ${entry.aliases.map(alias => `/${alias}`).join(', ')})`
        : '';
    const adminText = entry.permission === 'admin' ? ' (admin)' : '';

    segments.push(
      { text: entry.usage, bold: true },
      { text: `${aliasText} — ${entry.description}${adminText}\n` }
    );
  });

  segments.push(
    { text: '\nDùng ' },
    { text: '/start', bold: true },
    { text: ' bất cứ lúc nào để xem lại hướng dẫn.' }
  );

  return segments;
}

function createStartCommand({
  manifest = COMMAND_MANIFEST,
  includeQuickStart = true,
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
    reply: async () => {
      const segments = buildStartHelpSegments(manifest, {
        includeQuickStart,
      });
      return createRichTextResult(segments, [], {
        channel: 'main',
      });
    },
  });
}

module.exports = {
  buildStartHelpSegments,
  createStartCommand,
};
