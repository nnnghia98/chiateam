const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createManagedProcessSupervisor } = require('./managed-process');

function fakeFork({ ready = true } = {}) {
  const children = [];
  const fork = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.send = message => {
      if (message.type === 'stop')
        queueMicrotask(() => child.emit('exit', 0, null));
    };
    child.kill = () => queueMicrotask(() => child.emit('exit', 0, null));
    children.push(child);
    if (ready)
      queueMicrotask(() =>
        child.emit('message', { type: 'ready', service: 'telegram' })
      );
    return child;
  };
  return { fork, children };
}

test('managed supervisor resolves env before child and acknowledges ready', async () => {
  const fake = fakeFork();
  let resolved = false;
  const supervisor = createManagedProcessSupervisor({
    service: 'telegram',
    entrypoint: '/tmp/index.js',
    forkImpl: fake.fork,
    resolveEnv: async version => {
      resolved = version === 4;
      return { TOKEN: 'secret' };
    },
    readyTimeoutMs: 100,
  });
  const result = await supervisor.apply(4);
  assert.equal(resolved, true);
  assert.equal(result.state, 'applied');
  assert.equal(result.version, 4);
  assert.equal(fake.children[0].env, undefined);
  assert.equal(supervisor.getState().running, true);
});

test('replacement stops old child first and restores previous version after failure', async () => {
  let count = 0;
  const children = [];
  const fork = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.send = message => {
      if (message.type === 'stop') queueMicrotask(() => child.emit('exit', 0));
    };
    child.kill = () => {
      if (count !== 2) queueMicrotask(() => child.emit('exit', 0));
    };
    children.push(child);
    count += 1;
    if (count !== 2)
      queueMicrotask(() =>
        child.emit('message', { type: 'ready', service: 'telegram' })
      );
    return child;
  };
  const supervisor = createManagedProcessSupervisor({
    service: 'telegram',
    entrypoint: '/tmp/index.js',
    forkImpl: fork,
    readyTimeoutMs: 20,
    stopTimeoutMs: 20,
  });
  await supervisor.apply(1);
  await assert.rejects(
    () => supervisor.apply(2),
    error => error.errorCode === 'READY_TIMEOUT'
  );
  assert.equal(supervisor.getState().appliedVersion, 1);
  assert.equal(children.length, 3);
});

test('failed transition does not poison the restart queue and rollback keeps resolved env', async () => {
  const children = [];
  let attempt = 0;
  const fork = (_entrypoint, _args, options) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.options = options;
    child.send = message => {
      if (message.type === 'stop') queueMicrotask(() => child.emit('exit', 0));
    };
    child.kill = () => queueMicrotask(() => child.emit('exit', 0));
    children.push(child);
    attempt += 1;
    if (attempt !== 2)
      queueMicrotask(() =>
        child.emit('message', { type: 'ready', service: 'telegram' })
      );
    return child;
  };
  const supervisor = createManagedProcessSupervisor({
    service: 'telegram',
    entrypoint: '/tmp/index.js',
    forkImpl: fork,
    resolveEnv: async version => ({ CONFIG_VERSION: String(version) }),
    readyTimeoutMs: 15,
    stopTimeoutMs: 15,
  });
  await supervisor.apply(1);
  await assert.rejects(supervisor.apply(2), { errorCode: 'READY_TIMEOUT' });
  await supervisor.apply(3);
  assert.equal(children[2].options.env.CONFIG_VERSION, '1');
  assert.equal(children[3].options.env.CONFIG_VERSION, '3');
  assert.equal(supervisor.getState().appliedVersion, 3);
});

test('unproven child exit blocks replacement even after SIGKILL', async () => {
  let forks = 0;
  const child = new EventEmitter();
  child.send = () => {};
  child.kill = () => {};
  const supervisor = createManagedProcessSupervisor({
    service: 'telegram',
    entrypoint: __filename,
    stopTimeoutMs: 5,
    readyTimeoutMs: 20,
    forkImpl: () => {
      forks++;
      queueMicrotask(() =>
        child.emit('message', { type: 'ready', service: 'telegram' })
      );
      return child;
    },
  });
  await supervisor.apply(1);
  await assert.rejects(supervisor.apply(2), { code: 'STOP_TIMEOUT' });
  assert.equal(forks, 1);
  child.emit('exit', 0);
  await supervisor.stop();
});
