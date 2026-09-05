const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { DEV_SCRIPTS, runDevAll } = require('./dev-all');

function fakeProcess() {
  return new EventEmitter();
}

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.kills = [];
  child.kill = signal => child.kills.push(signal);
  return child;
}

test('dev:all runs only the API and Telegram development scripts', () => {
  assert.deepEqual(DEV_SCRIPTS, ['dev:api', 'dev:bot']);
  assert.equal(DEV_SCRIPTS.includes('dev:zalo'), false);
});

test('dev:all starts both scripts and exits successfully when both stop cleanly', async () => {
  const processModule = fakeProcess();
  const children = [fakeChild(), fakeChild()];
  const calls = [];
  const promise = runDevAll({
    cwd: '/project',
    env: { TEST: '1' },
    processModule,
    spawnImpl: (command, args, options) => {
      calls.push([command, args, options]);
      return children[calls.length - 1];
    },
  });

  children[0].emit('exit', 0, null);
  children[1].emit('exit', 0, null);

  assert.equal(await promise, 0);
  assert.deepEqual(
    calls.map(call => call[1]),
    [['dev:api'], ['dev:bot']]
  );
  assert.equal(calls[0][2].stdio, 'inherit');
});

test('dev:all stops the sibling and exits nonzero when a child fails', async () => {
  const processModule = fakeProcess();
  const children = [fakeChild(), fakeChild()];
  const promise = runDevAll({
    processModule,
    spawnImpl: (_command, args) => children[args[0] === 'dev:api' ? 0 : 1],
  });

  children[0].emit('exit', 1, null);
  assert.deepEqual(children[1].kills, ['SIGTERM']);
  children[1].emit('exit', null, 'SIGTERM');

  assert.equal(await promise, 1);
});

test('dev:all forwards termination signals to both children', async () => {
  const processModule = fakeProcess();
  const children = [fakeChild(), fakeChild()];
  const promise = runDevAll({
    processModule,
    spawnImpl: (_command, args) => children[args[0] === 'dev:api' ? 0 : 1],
  });

  processModule.emit('SIGTERM');
  assert.deepEqual(
    children.map(child => child.kills),
    [['SIGTERM'], ['SIGTERM']]
  );
  children[0].emit('exit', null, 'SIGTERM');
  children[1].emit('exit', null, 'SIGTERM');

  assert.equal(await promise, 130);
});
