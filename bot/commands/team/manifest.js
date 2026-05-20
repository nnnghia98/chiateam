const { getDisplayName } = require('../../utils/team-member');
const { MANIFEST } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { escapeMarkdown } = require('../../utils/format');

const bot = require('../../telegram-client');

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

function buildBenchList(entries) {
  return entries
    .map(
      ([, member], index) =>
        `${index + 1}. ${escapeMarkdown(getDisplayName(member))}`
    )
    .join('\n');
}

function isSameTeamSymbol(symbol) {
  return symbol === '<3' || symbol === '❤️' || symbol === '❤';
}

const manifestCommand = ({ members, getManifest, setManifest }) => {
  bot.onText(/^\/manifest$/, msg => {
    const entries = Array.from(members.entries());
    const currentManifest =
      typeof getManifest === 'function' ? getManifest() : null;
    const currentLine = currentManifest
      ? MANIFEST.current
          .replace('{first}', escapeMarkdown(currentManifest.players[0].name))
          .replace(
            '{symbol}',
            currentManifest.relation === 'same' ? '<3' : '</3'
          )
          .replace('{second}', escapeMarkdown(currentManifest.players[1].name))
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
      message: MANIFEST.instruction
        .replace('{current}', currentLine)
        .replace('{numberedList}', buildBenchList(entries)),
      options: { parse_mode: 'Markdown' },
    });
  });

  bot.onText(/^\/manifest\s+(\d+)\s+(<3|❤️|❤|<\/3)\s+(\d+)$/, (msg, match) => {
    const firstIndex = parseInt(match[1], 10);
    const symbol = match[2];
    const secondIndex = parseInt(match[3], 10);
    const entries = Array.from(members.entries());

    if (entries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MANIFEST.emptyBench,
      });
      return;
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
      return;
    }

    const first = buildManifestPlayer(entries[firstIndex - 1], members);
    const second = buildManifestPlayer(entries[secondIndex - 1], members);
    const relation = isSameTeamSymbol(symbol) ? 'same' : 'different';

    setManifest({
      relation,
      players: [first, second],
    });

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.success
        .replace('{first}', escapeMarkdown(first.name))
        .replace('{symbol}', symbol)
        .replace('{second}', escapeMarkdown(second.name)),
      options: { parse_mode: 'Markdown' },
    });
  });

  bot.onText(/^\/manifest\s+(?!\d+\s+(?:<3|❤️|❤|<\/3)\s+\d+$).+$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.invalidSelection,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = manifestCommand;
