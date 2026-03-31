function formatMoney(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Escape special Markdown characters for Telegram
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for Markdown
 */
function escapeMarkdown(text) {
  if (!text) return text;
  // Escape Telegram Markdown special characters
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

module.exports = { formatMoney, escapeMarkdown };
