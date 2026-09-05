const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMMAND_MANIFEST,
  listSupportedCommandNames,
} = require('../core/commands/command-manifest');
const {
  createAttendanceVoteController,
} = require('../core/ports/attendance-vote-controller');
const {
  createAttendanceVotePublisher,
} = require('../core/ports/attendance-vote-publisher');
const {
  createAnnouncementPublisher,
} = require('../core/ports/announcement-publisher');
const { createMatchRepository } = require('../core/ports/match-repository');
const {
  createMatchSummaryGenerator,
} = require('../core/ports/match-summary-generator');
const { createPlayerRepository } = require('../core/ports/player-repository');
const {
  createStatisticsRepository,
} = require('../core/ports/statistics-repository');
const { createCommandDefinitions } = require('./create-command-definitions');

function createDependencies() {
  return {
    announcementPublisher: createAnnouncementPublisher({
      async publish() {},
    }),
    votePublisher: createAttendanceVotePublisher({
      async publish() {
        return { id: 'poll-1', platform: 'telegram' };
      },
    }),
    voteController: createAttendanceVoteController({
      async close() {
        return { closed: true };
      },
    }),
    playerRepository: createPlayerRepository({
      async registerActor() {},
      async registerGuest() {},
      async deleteByNumber() {},
      async findByActor() {},
      async findByNumber() {},
      async list() {},
    }),
    statisticsRepository: createStatisticsRepository({
      async findByNumber() {},
      async findMany() {},
      async replaceTotals() {},
      async incrementGoals() {},
      async incrementAssists() {},
    }),
    matchRepository: createMatchRepository({
      async findByDate() {},
      async findWithPlayers() {},
      async save() {},
      async updateScore() {},
      async applyResult() {},
      async syncPlayerLinks() {},
      async deleteByDate() {},
      async list() {},
      async containsPlayer() {},
      async addPlayerStat() {},
      async setMvp() {},
    }),
    matchSummaryGenerator: createMatchSummaryGenerator({
      async generate() {
        return null;
      },
    }),
  };
}

test('shared runtime definitions match the approved command manifest', () => {
  const definitions = createCommandDefinitions(createDependencies());
  const canonicalNames = definitions.map(definition => definition.name);
  const supportedNames = definitions.flatMap(definition => [
    `/${definition.name}`,
    ...definition.aliases.map(alias => `/${alias}`),
  ]);

  assert.deepEqual(
    canonicalNames,
    COMMAND_MANIFEST.map(entry => entry.name)
  );
  assert.deepEqual(supportedNames.sort(), listSupportedCommandNames().sort());
  assert.equal(definitions.length, 34);
});
