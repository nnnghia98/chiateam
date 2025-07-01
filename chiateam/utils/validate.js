// Checks if a name contains only alphabet characters and optionally a number at the end
function isValidName(name) {
  // Accepts: Nghĩa, Nghĩa1, Nghĩa123, NGHĨA, NghĩaNguyễn, etc.
  // Rejects: Nghĩa 1, Nghĩa!, Nghĩa_1, etc.
  return /^[\p{L}]+\d*$/u.test(name);
}

// Checks if a name already exists in a list of names (case-insensitive)
function isDuplicateName(name, nameList) {
  return nameList.some(
    n => n.trim().toLowerCase() === name.trim().toLowerCase()
  );
}

function isAdmin(userId) {
  const ownerId = process.env.BOT_OWNER_ID;
  const adminIds = process.env.BOT_ADMIN_IDS;

  // Check if user is the main owner
  if (ownerId && String(userId) === String(ownerId)) {
    return true;
  }

  // Check if user is in the admin list
  if (adminIds) {
    const adminList = adminIds.split(',').map(id => id.trim());
    return adminList.includes(String(userId));
  }

  return false;
}

module.exports = {
  isValidName,
  isDuplicateName,
  isAdmin,
};
