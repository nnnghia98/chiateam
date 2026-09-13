const path = require('path');
const dotenv = require('dotenv');

function loadEnv() {
  if (process.env.MANAGEMENT_CHILD === 'true') return '.env';
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  return '.env';
}

module.exports = {
  loadEnv,
};
