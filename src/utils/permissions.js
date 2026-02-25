const { isAdmin } = require('./validate');
const { VALIDATION } = require('./messages');
const { sendMessage } = require('./chat');

function requireAdmin(msg) {
  if (!isAdmin(msg.from.id)) {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: VALIDATION.onlyAdmin,
    });
    return false;
  }

  return true;
}

module.exports = { requireAdmin };

