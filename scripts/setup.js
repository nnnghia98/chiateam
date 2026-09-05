const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function ensureEnvFile({
  cwd = process.cwd(),
  fsModule = fs,
  pathModule = path,
  log = console.log,
} = {}) {
  const source = pathModule.resolve(cwd, '.env.example');
  const target = pathModule.resolve(cwd, '.env');
  const copyFlag = fsModule.constants.COPYFILE_EXCL;

  try {
    // COPYFILE_EXCL keeps this safe if another process creates .env at the
    // same time. An existing .env is never replaced.
    fsModule.copyFileSync(source, target, copyFlag);
    log(`Created ${target} from ${source}.`);
    return { created: true, source, target };
  } catch (error) {
    if (error.code === 'EEXIST') {
      log(`Keeping existing ${target}.`);
      return { created: false, source, target };
    }
    throw error;
  }
}

function installDependencies({
  cwd = process.cwd(),
  spawnSyncImpl = spawnSync,
} = {}) {
  const result = spawnSyncImpl('yarn', ['install', '--frozen-lockfile'], {
    cwd,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(
      `yarn install --frozen-lockfile exited with status ${result.status}`
    );
    error.status = result.status;
    throw error;
  }

  return result;
}

function runSetup(options = {}) {
  const env = ensureEnvFile(options);
  installDependencies(options);
  return env;
}

if (require.main === module) {
  try {
    runSetup();
  } catch (error) {
    console.error(`Setup failed: ${error.message}`);
    process.exitCode = error.status || 1;
  }
}

module.exports = { ensureEnvFile, installDependencies, runSetup };
