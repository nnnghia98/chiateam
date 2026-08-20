function parsePositiveInteger(value) {
  const text = String(value ?? '').trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function findMemberIndex(entries, value) {
  const query = String(value ?? '')
    .trim()
    .toLowerCase();

  if (!query) {
    return -1;
  }

  return entries.findIndex(entry => entry.name.toLowerCase().includes(query));
}

function parseMemberSelection(value, entries) {
  const selection = String(value ?? '').trim();

  if (!selection || !Array.isArray(entries)) {
    return null;
  }

  if (selection.toLowerCase() === 'all') {
    return [...entries];
  }

  const indices = new Set();
  const parts = selection.split(',').map(part => part.trim());

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);

    if (range) {
      const start = parsePositiveInteger(range[1]);
      const end = parsePositiveInteger(range[2]);

      if (
        start != null &&
        end != null &&
        start <= end &&
        end <= entries.length
      ) {
        for (let number = start; number <= end; number += 1) {
          indices.add(number - 1);
        }
      }
      continue;
    }

    const number = parsePositiveInteger(part);

    if (number != null) {
      if (number <= entries.length) {
        indices.add(number - 1);
      }
      continue;
    }

    const name =
      part.startsWith('"') && part.endsWith('"')
        ? part.slice(1, -1).trim()
        : part;
    const index = findMemberIndex(entries, name);

    if (index >= 0) {
      indices.add(index);
    }
  }

  if (indices.size === 0) {
    return null;
  }

  return [...indices]
    .sort((left, right) => left - right)
    .map(index => entries[index]);
}

module.exports = {
  findMemberIndex,
  parseMemberSelection,
  parsePositiveInteger,
};
