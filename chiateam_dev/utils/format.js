function formatMoney(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

module.exports = { formatMoney };
