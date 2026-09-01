const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { getMemberIdentity } = require('../teams/team-assignment');
const { normalizeAttendanceVote } = require('./attendance-vote');

const SYNC_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /sync không kèm tham số.',
  permissionDenied: '⛔ Chỉ admin mới có quyền đồng bộ vote.',
  noVote: '📭 Không có vote nào đang hoạt động để đồng bộ.',
  loadError: '❌ Không thể tải vote và bench hiện tại từ API.',
  saveError: '❌ Không thể lưu bench đã đồng bộ. Vui lòng thử lại.',
});

function getVotePlatform(activeVote) {
  return (
    String(activeVote?.platform ?? 'telegram')
      .trim()
      .toLowerCase() || 'telegram'
  );
}

function createVoterEntry(voter, platform) {
  const externalId = String(voter.id);
  const identity = { platform, externalId };

  if (platform === 'telegram' && /^\d+$/.test(externalId)) {
    const userId = Number(externalId);

    if (Number.isSafeInteger(userId)) {
      return [userId, { name: voter.name, userId, identity }];
    }
  }

  return [`${platform}:${externalId}`, { name: voter.name, identity }];
}

function createVoteGuestEntry(voter, platform, index) {
  const memberId = `vote-guest:${platform}:${voter.id}:${index}`;

  return [memberId, { name: `${voter.name} ${index}`, memberId }];
}

function syncVoteToBench(activeVote, bench) {
  const vote = normalizeAttendanceVote(activeVote);

  if (!vote || !Array.isArray(bench)) {
    return null;
  }

  const validBench = bench.every(
    entry => Array.isArray(entry) && entry.length >= 2
  );

  if (!validBench) {
    return null;
  }

  const platform = getVotePlatform(activeVote);
  const nextBench = bench.map(([key, member]) => [key, member]);
  const usedKeys = new Set(nextBench.map(([key]) => String(key)));
  const usedIdentities = new Set(
    nextBench.map(([, member]) => getMemberIdentity(member))
  );
  const addedNames = [];
  const skippedNames = [];
  const comingVoters = vote.voters.filter(voter => voter.partySize > 0);

  comingVoters.forEach(voter => {
    const voterPlatform = voter.platform || platform;
    const voterEntry = createVoterEntry(voter, voterPlatform);
    const voterKey = String(voterEntry[0]);
    const voterIdentity = getMemberIdentity(voterEntry[1]);

    if (usedKeys.has(voterKey) || usedIdentities.has(voterIdentity)) {
      skippedNames.push(voter.name);
    } else {
      nextBench.push(voterEntry);
      usedKeys.add(voterKey);
      usedIdentities.add(voterIdentity);
      addedNames.push(voter.name);
    }

    for (let index = 1; index < voter.partySize; index += 1) {
      const guestEntry = createVoteGuestEntry(voter, voterPlatform, index);
      const guestKey = String(guestEntry[0]);

      if (usedKeys.has(guestKey)) {
        skippedNames.push(guestEntry[1].name);
      } else {
        nextBench.push(guestEntry);
        usedKeys.add(guestKey);
        usedIdentities.add(getMemberIdentity(guestEntry[1]));
        addedNames.push(guestEntry[1].name);
      }
    }
  });

  return Object.freeze({
    question: vote.question,
    totalVoters: comingVoters.length,
    bench: nextBench,
    addedNames: Object.freeze(addedNames),
    skippedNames: Object.freeze(skippedNames),
  });
}

function buildSyncSegments(result) {
  const segments = [
    { text: '🔄 ĐÃ ĐỒNG BỘ TỪ VOTE', bold: true },
    { text: `\n\n📊 Vote: "${result.question}"` },
    { text: `\n👥 Tổng số người vote: ${result.totalVoters}\n` },
  ];

  if (result.addedNames.length > 0) {
    segments.push(
      {
        text: `\n✅ Đã thêm vào bench (${result.addedNames.length}):\n`,
        bold: true,
      },
      {
        text: result.addedNames
          .map((name, index) => `${index + 1}. ${name}`)
          .join('\n'),
      },
      { text: '\n' }
    );
  }

  if (result.skippedNames.length > 0) {
    segments.push(
      {
        text: `\n⏭️ Đã có trong bench (${result.skippedNames.length}):\n`,
        bold: true,
      },
      {
        text: result.skippedNames
          .map((name, index) => `${index + 1}. ${name}`)
          .join('\n'),
      }
    );
  }

  if (result.addedNames.length === 0 && result.skippedNames.length === 0) {
    segments.push({ text: '\nKhông có người tham gia để đồng bộ.' });
  }

  return segments;
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });

function createSyncCommand() {
  return createCommandDefinition({
    name: 'sync',
    aliases: [],
    instruction: {
      usage: '/sync',
      description: 'Atomically sync attending voters to the bench',
      permission: 'admin',
    },
    stateKeys: ['activeVote', 'bench'],
    condition: async (context, state) => {
      if (context.args.length > 0) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      if (state.activeVote == null) {
        return { ok: false, code: 'NO_ACTIVE_VOTE' };
      }

      const result = syncVoteToBench(state.activeVote, state.bench);

      return result
        ? { ok: true, result }
        : { ok: false, code: 'INVALID_SYNC_STATE' };
    },
    action: async (context, state, condition) => ({
      changed: condition.result.addedNames.length > 0,
      code: 'VOTE_SYNCED',
      ...(condition.result.addedNames.length > 0
        ? { changes: { bench: condition.result.bench } }
        : {}),
      result: condition.result,
    }),
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(SYNC_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(SYNC_MESSAGES.usage);
      }

      if (outcome.code === 'NO_ACTIVE_VOTE') {
        return createDefaultResult(SYNC_MESSAGES.noVote);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_SYNC_STATE'
      ) {
        return createDefaultResult(SYNC_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(SYNC_MESSAGES.saveError);
      }

      return createRichTextResult(buildSyncSegments(outcome.result), [], {
        channel: 'announcement',
      });
    },
  });
}

module.exports = {
  SYNC_MESSAGES,
  buildSyncSegments,
  createSyncCommand,
  createVoteGuestEntry,
  createVoterEntry,
  syncVoteToBench,
};
