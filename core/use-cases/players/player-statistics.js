function parsePositiveInteger(value) {
  const text = String(value ?? '').trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);

  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function parseNonNegativeInteger(value) {
  const text = String(value ?? '').trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);

  return Number.isSafeInteger(number) ? number : null;
}

function normalizeCount(value) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeStatistics(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return null;
  }

  const matches = normalizeCount(row.total_match);
  const wins = normalizeCount(row.total_win);
  const losses = normalizeCount(row.total_lose);
  const draws = normalizeCount(row.total_draw);
  const goals = normalizeCount(row.goal);
  const assists = normalizeCount(row.assist);
  const winrateValue = Number(row.winrate);
  const winrate = Number.isFinite(winrateValue)
    ? winrateValue
    : matches > 0
      ? wins / matches
      : 0;

  return Object.freeze({
    matches,
    wins,
    losses,
    draws,
    goals,
    assists,
    winrate,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  });
}

function compareRankedPlayers(left, right) {
  const leftStats = left.stats;
  const rightStats = right.stats;

  return (
    rightStats.winrate - leftStats.winrate ||
    rightStats.matches - leftStats.matches ||
    rightStats.wins - leftStats.wins ||
    rightStats.goals - leftStats.goals ||
    String(left.player.name ?? '').localeCompare(
      String(right.player.name ?? ''),
      'vi'
    )
  );
}

function rankPlayers(players, statisticsRows) {
  const rowsByNumber = new Map(
    (statisticsRows || []).map(row => [Number(row.player_number), row])
  );

  return (players || [])
    .filter(player => parsePositiveInteger(player?.number) != null)
    .map(player => ({
      player,
      stats:
        normalizeStatistics(rowsByNumber.get(Number(player.number))) ||
        normalizeStatistics({}),
    }))
    .sort(compareRankedPlayers);
}

function formatVietnamDate(value) {
  const date = value == null ? null : new Date(value);

  if (!date || Number.isNaN(date.getTime())) {
    return 'Chưa có';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function getPerformance(stats) {
  if (stats.matches <= 0) {
    return null;
  }

  const percentage = (stats.wins / stats.matches) * 100;

  if (percentage >= 80) return '🔥 Xuất sắc - Cầu thủ rất mạnh!';
  if (percentage >= 60) return '⭐ Tốt - Cầu thủ có kỹ năng tốt';
  if (percentage >= 40) return '📉 Trung bình - Cần cải thiện thêm';
  return '📉 Cần cải thiện - Nên luyện tập thêm';
}

module.exports = {
  compareRankedPlayers,
  formatVietnamDate,
  getPerformance,
  normalizeStatistics,
  parseNonNegativeInteger,
  parsePositiveInteger,
  rankPlayers,
};
