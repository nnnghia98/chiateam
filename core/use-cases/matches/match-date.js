function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDisplayDate(value) {
  const match = String(value ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return toIsoDate(date);
}

function getThursdayDate(value = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('A valid match clock value is required.');
  }

  const day = date.getDay();
  const difference = day >= 4 ? 4 - day : -(day + 3);
  date.setDate(date.getDate() + difference);

  return toIsoDate(date);
}

function formatDisplayDate(isoDate) {
  const match = String(isoDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(isoDate ?? '');
}

module.exports = {
  formatDisplayDate,
  getThursdayDate,
  parseDisplayDate,
  toIsoDate,
};
