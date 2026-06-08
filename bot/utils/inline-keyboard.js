const INLINE_KEYBOARD_PAGE_SIZE = 10;

function normalizePage(page, totalEntries, pageSize = INLINE_KEYBOARD_PAGE_SIZE) {
  const maxPage = Math.max(0, Math.ceil(totalEntries / pageSize) - 1);
  return Math.min(Math.max(page, 0), maxPage);
}

function buildPaginatedKeyboard({
  entries,
  page = 0,
  itemToButton,
  pageCallbackPrefix,
  pageSize = INLINE_KEYBOARD_PAGE_SIZE,
}) {
  const currentPage = normalizePage(page, entries.length, pageSize);
  const startIndex = currentPage * pageSize;
  const pageEntries = entries.slice(startIndex, startIndex + pageSize);
  const keyboard = pageEntries.map((entry, offset) => [
    itemToButton(entry, startIndex + offset),
  ]);

  if (entries.length > pageSize) {
    const navRow = [];

    if (currentPage > 0) {
      navRow.push({
        text: '< Trước',
        callback_data: `${pageCallbackPrefix}${currentPage - 1}`,
      });
    }

    navRow.push({
      text: `${currentPage + 1}/${Math.ceil(entries.length / pageSize)}`,
      callback_data: `${pageCallbackPrefix}${currentPage}`,
    });

    if ((currentPage + 1) * pageSize < entries.length) {
      navRow.push({
        text: 'Tiếp >',
        callback_data: `${pageCallbackPrefix}${currentPage + 1}`,
      });
    }

    keyboard.push(navRow);
  }

  return keyboard;
}

module.exports = {
  INLINE_KEYBOARD_PAGE_SIZE,
  buildPaginatedKeyboard,
  normalizePage,
};
