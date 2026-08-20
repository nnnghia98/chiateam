const { generateMatchSummary } = require('../../api/services/ai-service');
const {
  createMatchSummaryGenerator,
} = require('../../core/ports/match-summary-generator');

function createApiMatchSummaryGenerator({
  generate = generateMatchSummary,
} = {}) {
  return createMatchSummaryGenerator({ generate });
}

module.exports = {
  createApiMatchSummaryGenerator,
};
