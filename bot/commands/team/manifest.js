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
      message: MANIFEST.instruction
        .replace('{current}', currentLine)
        .replace('{numberedList}', buildBenchList(entries)),
      options: { parse_mode: 'Markdown' },
    });
  });

  bot.onText(/^\/manifest\s+(\d+)\s+(<3|❤️|❤|<\/3|💔)\s+(\d+)$/, (msg, match) => {
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
      return;
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
  });

  bot.onText(/^\/removemanifest(?:\s+(?!\d+$).+)?$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.removeInstruction,
      options: { parse_mode: 'Markdown' },
    });
  });

  bot.onText(/^\/manifest\s+(?!\d+\s+(?:<3|❤️|❤|<\/3|💔)\s+\d+$).+$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: MANIFEST.invalidSelection,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = manifestCommand;
