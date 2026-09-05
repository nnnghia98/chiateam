const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureEnvFile, runSetup } = require('./setup');

function makeFs({ copyError } = {}) {
  const calls = [];
  return {
    calls,
    constants: { COPYFILE_EXCL: 'exclusive' },
    copyFileSync(...args) {
      calls.push(args);
      if (copyError) throw copyError;
    },
  };
}

test('setup creates .env exclusively when it is absent', () => {
  const fsModule = makeFs();
  const logs = [];

  const result = ensureEnvFile({
    cwd: '/project',
    fsModule,
    log: message => logs.push(message),
  });

  assert.equal(result.created, true);
  assert.deepEqual(fsModule.calls, [
    ['/project/.env.example', '/project/.env', 'exclusive'],
  ]);
  assert.match(logs[0], /Created/);
});

test('setup keeps an existing .env and does not overwrite it', () => {
  const fsModule = makeFs({
    copyError: Object.assign(new Error('exists'), { code: 'EEXIST' }),
  });
  const logs = [];

  const result = ensureEnvFile({
    cwd: '/project',
    fsModule,
    log: message => logs.push(message),
  });

  assert.equal(result.created, false);
  assert.equal(fsModule.calls.length, 1);
  assert.match(logs[0], /Keeping existing/);
});

test('setup installs with the frozen lockfile after env setup', () => {
  const steps = [];
  const fsModule = makeFs();

  runSetup({
    cwd: '/project',
    fsModule,
    log: () => steps.push('env'),
    spawnSyncImpl: (command, args, options) => {
      steps.push([command, args, options]);
      return { status: 0 };
    },
  });

  assert.deepEqual(steps, [
    'env',
    [
      'yarn',
      ['install', '--frozen-lockfile'],
      { cwd: '/project', stdio: 'inherit' },
    ],
  ]);
});
