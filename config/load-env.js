const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function getDefaultEnvFile() {
  return process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
}

function loadEnv() {
  const preferredFile = process.env.ENV_FILE || getDefaultEnvFile();
  const preferredPath = path.resolve(process.cwd(), preferredFile);

  if (fs.existsSync(preferredPath)) {
    dotenv.config({ path: preferredPath });
    return preferredFile;
  }

  dotenv.config();
  return '.env';
}

module.exports = {
  loadEnv,
};
