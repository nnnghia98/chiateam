const { isAdmin } = require('./validate');
const { VALIDATION } = require('./messages');
const { sendMessage } = require('./chat');

function requireAdmin(msg, options = {}) {
  if (!isAdmin(msg.from.id)) {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: VALIDATION.onlyAdmin,
      options,
    });
    return false;
  }

  return true;
}

module.exports = { requireAdmin };
