// Checks if a name contains only alphabet characters and optionally a number at the end
function isValidName(name) {
  // Accepts: Nghia, Nghia1, Nghia123, NGHIA, NghiaNguyen, etc.
  // Rejects: Nghia 1, Nghia!, Nghia_1, etc.
  return /^[A-Za-z]+\d*$/.test(name);
}

// Checks if a name already exists in a list of names (case-insensitive)
function isDuplicateName(name, nameList) {
  return nameList.some(
    n => n.trim().toLowerCase() === name.trim().toLowerCase()
  );
}

module.exports = {
  isValidName,
  isDuplicateName,
};
