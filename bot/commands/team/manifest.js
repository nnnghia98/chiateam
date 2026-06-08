const { getDisplayName } = require('../../utils/team-member');
const { MANIFEST, VALIDATION } = require('../../utils/messages');
const { sendMessage: sendBaseMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { isAdmin } = require('../../utils/validate');
const { escapeMarkdown } = require('../../utils/format');
const { buildPaginatedKeyboard } = require('../../utils/inline-keyboard');
const { registerCallbackQueryHandler } = require('../common/callback-query');

const bot = require('../../telegram-client');

const MANIFEST_FIRST_PREFIX = 'manifest:first:';
const MANIFEST_FIRST_PAGE_PREFIX = 'manifest:firstpage:';
const MANIFEST_RELATION_PREFIX = 'manifest:relation:';
const MANIFEST_SECOND_PREFIX = 'manifest:second:';
const MANIFEST_SECOND_PAGE_PREFIX = 'manifest:secondpage:';
const REMOVE_MANIFEST_PREFIX = 'manifestremove:remove:';
const REMOVE_MANIFEST_PAGE_PREFIX = 'manifestremove:page:';
const sendMessage = payload =>
  sendBaseMessage({
    ...payload,
    options: { ...(payload.options || {}), useSourceChat: true },
  });

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

function getMemberIdentity(member) {
  if (member && typeof member === 'object') {
    if (member.userId != null) return `tele:${member.userId}`;
    if (member.memberId) return `member:${member.memberId}`;
    if (member.name) return `name:${normalizeName(member.name)}`;
  }

  return `name:${normalizeName(getDisplayName(member))}`;
}

function ensureManifestMember(entry, members) {
  const [key, member] = entry;

  if (typeof member === 'string') {
    const normalizedMember = {
      name: member,
      memberId: `bench:${String(key)}`,
    };
    members.set(key, normalizedMember);
    return normalizedMember;
  }

  if (member && typeof member === 'object') {
    if (member.userId == null && !member.memberId) {
      member.memberId = `bench:${String(key)}`;
      members.set(key, member);
    }

    return member;
  }

  const normalizedMember = {
    name: '',
    memberId: `bench:${String(key)}`,
  };
  members.set(key, normalizedMember);
  return normalizedMember;
}

function buildManifestPlayer(entry, members) {
  const member = ensureManifestMember(entry, members);

  return {
    identity: getMemberIdentity(member),
    name: getDisplayName(member),
  };
}

function isSameTeamSymbol(symbol) {
  return symbol === '<3' || symbol === '❤️' || symbol === '❤';
}

function buildManifestLine(currentManifest, index = null) {
  const prefix = index == null ? '' : `${index + 1}. `;
  const symbol = currentManifest.relation === 'same' ? '<3' : '</3';

  return (
    `${prefix}\`${escapeMarkdown(currentManifest.players[0].name)} ` +
    `${symbol} ${escapeMarkdown(currentManifest.players[1].name)}\``
  );
}

function getManifestList(manifest) {
  if (!manifest) {
    return [];
  }

  return Array.isArray(manifest) ? manifest : [manifest];
}

function buildManifestLines(manifests) {
  return manifests.map(buildManifestLine).join('\n');
}

function buildManifestListMessage(currentManifest) {
  const manifests = getManifestList(currentManifest);

  if (manifests.length === 0) {
    return MANIFEST.noCurrent;
  }

  return MANIFEST.list.replace('{manifestList}', buildManifestLines(manifests));
}

function buildMemberKeyboard({ entries, callbackPrefix, pageCallbackPrefix, page = 0 }) {
  return buildPaginatedKeyboard({
    entries,
    page,
    pageCallbackPrefix,
    itemToButton: (([, member], index) => ({
      text: `${index + 1}. ${getDisplayName(member)}`,
      callback_data: `${callbackPrefix}${index}`,
    })),
  });
}

function buildRemoveManifestKeyboard(manifests, page = 0) {
  return buildPaginatedKeyboard({
    entries: manifests,
    page,
    pageCallbackPrefix: REMOVE_MANIFEST_PAGE_PREFIX,
    itemToButton: ((manifest, index) => ({
      text: buildManifestLine(manifest, index).replaceAll('`', ''),
      callback_data: `${REMOVE_MANIFEST_PREFIX}${index}`,
    })),
  });
}

function getManifestPairKey(manifest) {
  return manifest.players
    .map(player => player.identity)
    .sort()
    .join('|');
}

function isValidManifestList(manifests) {
  const colors = new Map();
  const graph = new Map();

  manifests.forEach(manifest => {
    const [first, second] = manifest.players.map(player => player.identity);
    const relationValue = manifest.relation === 'same' ? 0 : 1;

    if (!graph.has(first)) graph.set(first, []);
    if (!graph.has(second)) graph.set(second, []);

    graph.get(first).push([second, relationValue]);
    graph.get(second).push([first, relationValue]);
  });

  for (const start of graph.keys()) {
    if (colors.has(start)) continue;

    colors.set(start, 0);
    const queue = [start];

    while (queue.length > 0) {
      const current = queue.shift();
      const currentColor = colors.get(current);

      for (const [next, relationValue] of graph.get(current)) {
        const nextColor = currentColor ^ relationValue;

        if (!colors.has(next)) {
          colors.set(next, nextColor);
          queue.push(next);
        } else if (colors.get(next) !== nextColor) {
          return false;
        }
      }
    }
  }

  return true;
}

function upsertManifest(currentManifest, nextManifest) {
  const manifests = getManifestList(currentManifest);
  const nextPairKey = getManifestPairKey(nextManifest);
  const existingIndex = manifests.findIndex(
    manifest => getManifestPairKey(manifest) === nextPairKey
  );
  const nextManifests =
    existingIndex === -1
      ? [...manifests, nextManifest]
      : manifests.map((manifest, index) =>
          index === existingIndex ? nextManifest : manifest
        );

  return {
    isReplacement: existingIndex !== -1,
    isValid: isValidManifestList(nextManifests),
    manifests: nextManifests,
  };
}

const manifestCommand = ({ members, getManifest, setManifest }) => {
  const saveManifestPair = ({ firstIndex, secondIndex, relation, symbol, msg }) => {
    const entries = Array.from(members.entries());

    if (entries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MANIFEST.emptyBench,
      });
      return false;
    }

    if (
      firstIndex === secondIndex ||
      firstIndex < 1 ||
      secondIndex < 1 ||
      firstIndex > entries.length ||
      secondIndex > entries.length
    ) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MANIFEST.invalidSelection,
        options: { parse_mode: 'Markdown' },
      });
      return false;
    }

    const first = buildManifestPlayer(entries[firstIndex - 1], members);
    const second = buildManifestPlayer(entries[secondIndex - 1], members);
    const nextManifest = {
      relation,
      players: [first, second],
    };
    const currentManifest =
      typeof getManifest === 'function' ? getManifest() : null;
    const result = upsertManifest(currentManifest, nextManifest);

    if (!result.isValid) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MANIFEST.conflict,
        options: { parse_mode: 'Markdown' },
      });
      return false;
    }

    setManifest(result.manifests);

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: (result.isReplacement ? MANIFEST.replaceSuccess : MANIFEST.success)
        .replace('{first}', escapeMarkdown(first.name))
        .replace('{symbol}', symbol)
        .replace('{second}', escapeMarkdown(second.name)),
      options: { parse_mode: 'Markdown' },
    });
    return true;
  };

  registerCallbackQueryHandler(async query => {
    const data = query.data || '';
    const entries = Array.from(members.entries());

    const isManifestCallback =
      data.startsWith(MANIFEST_FIRST_PREFIX) ||
      data.startsWith(MANIFEST_FIRST_PAGE_PREFIX) ||
      data.startsWith(MANIFEST_RELATION_PREFIX) ||
      data.startsWith(MANIFEST_SECOND_PREFIX) ||
      data.startsWith(MANIFEST_SECOND_PAGE_PREFIX) ||
      data.startsWith(REMOVE_MANIFEST_PREFIX) ||
      data.startsWith(REMOVE_MANIFEST_PAGE_PREFIX);

    if (!isManifestCallback) {
      return false;
    }

    if (!isAdmin(query.from?.id)) {
      await bot.answerCallbackQuery(query.id, {
        text: VALIDATION.onlyAdmin,
        show_alert: false,
      });
      return true;
    }

    if (data.startsWith(MANIFEST_FIRST_PAGE_PREFIX)) {
      const page = parseInt(data.slice(MANIFEST_FIRST_PAGE_PREFIX.length), 10);
      await bot.editMessageReplyMarkup(
        {
          inline_keyboard: buildMemberKeyboard({
            entries,
            callbackPrefix: MANIFEST_FIRST_PREFIX,
            pageCallbackPrefix: MANIFEST_FIRST_PAGE_PREFIX,
            page: Number.isInteger(page) ? page : 0,
          }),
        },
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        }
      );
      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      return true;
    }

    if (data.startsWith(MANIFEST_FIRST_PREFIX)) {
      const firstIndex = parseInt(data.slice(MANIFEST_FIRST_PREFIX.length), 10);
      const selectedEntry = Number.isInteger(firstIndex)
        ? entries[firstIndex]
        : null;

      if (!selectedEntry) {
        await bot.answerCallbackQuery(query.id, {
          text: MANIFEST.invalidSelection,
          show_alert: false,
        });
        return true;
      }

      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      sendMessage({
        msg: query.message,
        type: 'DEFAULT',
        message: MANIFEST.relationPrompt.replace(
          '{first}',
          escapeMarkdown(getDisplayName(selectedEntry[1]))
        ),
        options: {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Cùng team <3',
                  callback_data: `${MANIFEST_RELATION_PREFIX}${firstIndex}:same`,
                },
                {
                  text: 'Khác team </3',
                  callback_data: `${MANIFEST_RELATION_PREFIX}${firstIndex}:different`,
                },
              ],
            ],
          },
        },
      });
      return true;
    }

    if (data.startsWith(MANIFEST_RELATION_PREFIX)) {
      const [, firstRaw, relation] = data.match(
        /^manifest:relation:(\d+):(same|different)$/
      ) || [null, null, null];
      const firstIndex = parseInt(firstRaw, 10);
      const selectedEntry = Number.isInteger(firstIndex)
        ? entries[firstIndex]
        : null;

      if (!selectedEntry) {
        await bot.answerCallbackQuery(query.id, {
          text: MANIFEST.invalidSelection,
          show_alert: false,
        });
        return true;
      }

      const symbol = relation === 'same' ? '<3' : '</3';
      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      sendMessage({
        msg: query.message,
        type: 'DEFAULT',
        message: MANIFEST.secondPlayerPrompt
          .replace('{first}', escapeMarkdown(getDisplayName(selectedEntry[1])))
          .replace('{symbol}', symbol),
        options: {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buildMemberKeyboard({
              entries,
              callbackPrefix: `${MANIFEST_SECOND_PREFIX}${firstIndex}:${relation}:`,
              pageCallbackPrefix: `${MANIFEST_SECOND_PAGE_PREFIX}${firstIndex}:${relation}:`,
            }),
          },
        },
      });
      return true;
    }

    if (data.startsWith(MANIFEST_SECOND_PAGE_PREFIX)) {
      const [, firstRaw, relation, pageRaw] = data.match(
        /^manifest:secondpage:(\d+):(same|different):(\d+)$/
      ) || [null, null, null, null];
      const firstIndex = parseInt(firstRaw, 10);
      const page = parseInt(pageRaw, 10);

      await bot.editMessageReplyMarkup(
        {
          inline_keyboard: buildMemberKeyboard({
            entries,
            callbackPrefix: `${MANIFEST_SECOND_PREFIX}${firstIndex}:${relation}:`,
            pageCallbackPrefix: `${MANIFEST_SECOND_PAGE_PREFIX}${firstIndex}:${relation}:`,
            page: Number.isInteger(page) ? page : 0,
          }),
        },
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        }
      );
      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      return true;
    }

    if (data.startsWith(MANIFEST_SECOND_PREFIX)) {
      const [, firstRaw, relation, secondRaw] = data.match(
        /^manifest:second:(\d+):(same|different):(\d+)$/
      ) || [null, null, null, null];
      const relationValue = relation === 'same' ? 'same' : 'different';
      const symbol = relationValue === 'same' ? '<3' : '</3';

      saveManifestPair({
        firstIndex: parseInt(firstRaw, 10) + 1,
        secondIndex: parseInt(secondRaw, 10) + 1,
        relation: relationValue,
        symbol,
        msg: query.message,
      });
      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      return true;
    }

    if (data.startsWith(REMOVE_MANIFEST_PAGE_PREFIX)) {
      const currentManifest =
        typeof getManifest === 'function' ? getManifest() : null;
      const manifests = getManifestList(currentManifest);
      const page = parseInt(data.slice(REMOVE_MANIFEST_PAGE_PREFIX.length), 10);

      await bot.editMessageReplyMarkup(
        {
          inline_keyboard: buildRemoveManifestKeyboard(
            manifests,
            Number.isInteger(page) ? page : 0
          ),
        },
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        }
      );
      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      return true;
    }

    if (data.startsWith(REMOVE_MANIFEST_PREFIX)) {
      const manifestIndex = parseInt(data.slice(REMOVE_MANIFEST_PREFIX.length), 10);
      const currentManifest =
        typeof getManifest === 'function' ? getManifest() : null;
      const manifests = getManifestList(currentManifest);
      const removedManifest = Number.isInteger(manifestIndex)
        ? manifests[manifestIndex]
        : null;

      if (!removedManifest) {
        await bot.answerCallbackQuery(query.id, {
          text: MANIFEST.invalidRemoveSelection,
          show_alert: false,
        });
        return true;
      }

      const nextManifests = manifests.filter(
        (_, index) => index !== manifestIndex
      );

      if (typeof setManifest === 'function') {
        await setManifest(nextManifests.length > 0 ? nextManifests : null);
      }

      sendMessage({
        msg: query.message,
        type: 'DEFAULT',
        message: MANIFEST.removeSuccess.replace(
          '{manifest}',
          buildManifestLine(removedManifest)
        ),
        options: { parse_mode: 'Markdown' },
      });
      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      return true;
    }

    return false;
  });

  const sendManifestList = msg => {
    const currentManifest =
      typeof getManifest === 'function' ? getManifest() : null;

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: buildManifestListMessage(currentManifest),
      options: { parse_mode: 'Markdown' },
    });
  };

  bot.onText(/^\/(?:mf|manifests)$/, msg => {
    sendManifestList(msg);
  });

  bot.onText(/^\/clearmanifests$/, async msg => {
    if (!requireAdmin(msg, { useSourceChat: true })) {
      return;
    }

    const currentManifest =
      typeof getManifest === 'function' ? getManifest() : null;

    if (getManifestList(currentManifest).length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MANIFEST.noCurrent,
      });
      return;
    }

    if (typeof setManifest === 'function') {
      await setManifest(null);
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.clearSuccess,
    });
  });

  bot.onText(/^\/removemanifest\s+(\d+)$/, async (msg, match) => {
    if (!requireAdmin(msg, { useSourceChat: true })) {
      return;
    }

    const manifestIndex = parseInt(match[1], 10);
    const currentManifest =
      typeof getManifest === 'function' ? getManifest() : null;
    const manifests = getManifestList(currentManifest);

    if (manifests.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MANIFEST.noCurrent,
      });
      return;
    }

    if (
      manifestIndex < 1 ||
      manifestIndex > manifests.length ||
      Number.isNaN(manifestIndex)
    ) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MANIFEST.invalidRemoveSelection,
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    const removedManifest = manifests[manifestIndex - 1];
    const nextManifests = manifests.filter(
      (_, index) => index !== manifestIndex - 1
    );

    if (typeof setManifest === 'function') {
      await setManifest(nextManifests.length > 0 ? nextManifests : null);
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.removeSuccess.replace(
        '{manifest}',
        buildManifestLine(removedManifest)
      ),
      options: { parse_mode: 'Markdown' },
    });
  });

  bot.onText(/^\/manifest$/, msg => {
    if (!requireAdmin(msg, { useSourceChat: true })) {
      return;
    }

    const entries = Array.from(members.entries());
    const currentManifest =
      typeof getManifest === 'function' ? getManifest() : null;
    const currentManifests = getManifestList(currentManifest);
    const currentLine =
      currentManifests.length > 0
        ? MANIFEST.current.replace(
            '{manifestList}',
            buildManifestLines(currentManifests)
          )
        : MANIFEST.noCurrent;

    if (entries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: `${MANIFEST.emptyBench}\n\n${currentLine}`,
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.instruction.replace('{current}', currentLine),
      options: {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buildMemberKeyboard({
            entries,
            callbackPrefix: MANIFEST_FIRST_PREFIX,
            pageCallbackPrefix: MANIFEST_FIRST_PAGE_PREFIX,
          }),
        },
      },
    });
  });

  bot.onText(/^\/manifest\s+(\d+)\s+(<3|❤️|❤|<\/3|💔)\s+(\d+)$/, (msg, match) => {
    if (!requireAdmin(msg, { useSourceChat: true })) {
      return;
    }

    const firstIndex = parseInt(match[1], 10);
    const symbol = match[2];
    const secondIndex = parseInt(match[3], 10);
    saveManifestPair({
      firstIndex,
      secondIndex,
      relation: isSameTeamSymbol(symbol) ? 'same' : 'different',
      symbol,
      msg,
    });
  });

  bot.onText(/^\/removemanifest(?:\s+(?!\d+$).+)?$/, msg => {
    if (!requireAdmin(msg, { useSourceChat: true })) {
      return;
    }

    const currentManifest =
      typeof getManifest === 'function' ? getManifest() : null;
    const manifests = getManifestList(currentManifest);

    if (manifests.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MANIFEST.noCurrent,
      });
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.removeInstruction,
      options: {
        reply_markup: {
          inline_keyboard: buildRemoveManifestKeyboard(manifests),
        },
      },
    });
  });

  bot.onText(/^\/manifest\s+(?!\d+\s+(?:<3|❤️|❤|<\/3|💔)\s+\d+$).+$/, msg => {
    if (!requireAdmin(msg, { useSourceChat: true })) {
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.invalidSelection,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = manifestCommand;
