function formatMoney(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseMoneyAmount(value) {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  let digits = text;

  if (!/^\d+$/.test(text)) {
    const grouped = text.match(/^\d{1,3}([., ])\d{3}(?:\1\d{3})*$/);

    if (!grouped) {
      return null;
    }

    digits = text.split(grouped[1]).join('');
  }

  const amount = Number(digits);

  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function normalizeStoredMoney(value) {
  if (value == null || value === '') {
    return 0;
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  const amount = Number(value);

  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

module.exports = {
  formatMoney,
  normalizeStoredMoney,
  parseMoneyAmount,
};
