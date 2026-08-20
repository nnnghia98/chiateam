function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isValidMemberName(name) {
  return /^[\p{L}\s]+\d*$/u.test(name);
}

function getMemberName(member) {
  if (typeof member === 'string') {
    return member;
  }

  return typeof member?.name === 'string' ? member.name : '';
}

function getBaseMemberName(member) {
  return normalizeName(getMemberName(member).split(' (@')[0]);
}

function normalizeBenchEntries(bench) {
  if (!Array.isArray(bench)) {
    return null;
  }

  const entries = bench.map((entry, index) => {
    if (!Array.isArray(entry) || entry.length < 2) {
      return null;
    }

    const name = normalizeName(getMemberName(entry[1]));

    if (!name) {
      return null;
    }

    return {
      index,
      key: entry[0],
      member: entry[1],
      name,
    };
  });

  return entries.some(entry => entry == null) ? null : entries;
}

function hasDuplicateName(bench, name) {
  const normalizedName = normalizeName(name).toLowerCase();

  return bench.some(entry => {
    if (!Array.isArray(entry) || entry.length < 2) {
      return false;
    }

    return getBaseMemberName(entry[1]).toLowerCase() === normalizedName;
  });
}

module.exports = {
  getBaseMemberName,
  getMemberName,
  hasDuplicateName,
  isValidMemberName,
  normalizeBenchEntries,
  normalizeName,
};
