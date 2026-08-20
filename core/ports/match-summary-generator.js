function createMatchSummaryGenerator({ generate } = {}) {
  if (typeof generate !== 'function') {
    throw new TypeError('match summary generator requires generate.');
  }

  return Object.freeze({
    async generate(match) {
      const summary = await generate(match);

      return summary == null ? null : String(summary).trim() || null;
    },
  });
}

function assertMatchSummaryGenerator(generator) {
  if (!generator || typeof generator.generate !== 'function') {
    throw new TypeError('A valid match summary generator is required.');
  }

  return generator;
}

module.exports = {
  assertMatchSummaryGenerator,
  createMatchSummaryGenerator,
};
