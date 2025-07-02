// Checks if a name contains only alphabet characters and optionally a number at the end
function isValidName(name) {
  // Accepts: Nghia, Nghia1, Nghia123, NGHIA, NghiaNguyen, Nghia Nguyen, Nguyen Van A, Nghia 1, Nghĩa, Nguyễn, etc.
  // Rejects: Nghia!, Nghia_1, etc.
  return /^[\p{L}\s]+\d*$/u.test(name);
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
