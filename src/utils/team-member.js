/**
 * Helpers for in-memory member/team entries.
 *
 * Identifier stability (for linking to registered players):
 * - user_id (Telegram ID): Most stable. Assigned by Telegram, does not change
 *   when the user changes display name or username. Use when available (/addme).
 * - number (shirt number): Less stable. Can change if a player changes number.
 * - name: Least stable. User can change first_name in Telegram anytime.
 *
 * We carry userId through the flow so match save can resolve by user_id first.
 */

/**
 * @typedef {{ name: string, userId?: number }} MemberEntry
 */

/**
 * Create an entry for members/team Maps. Supports optional Telegram user_id.
 * @param {string} name - Display name
 * @param {number} [userId] - Telegram user id (from msg.from.id), only set when from /addme
 * @returns {MemberEntry}
 */
function toEntry(name, userId) {
  return userId != null ? { name, userId } : { name };
}

/**
 * Get display string from a member/team value (supports legacy string values).
 * @param {string|MemberEntry} value
 * @returns {string}
 */
function getDisplayName(value) {
  return typeof value === 'string' ? value : value.name;
}

/**
 * Get Telegram user id if present (only set for entries added via /addme).
 * @param {string|MemberEntry} value
 * @returns {number|undefined}
 */
function getUserId(value) {
  return typeof value === 'string' ? undefined : value.userId;
}

module.exports = {
  toEntry,
  getDisplayName,
  getUserId,
};
