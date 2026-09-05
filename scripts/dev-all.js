const { spawn } = require('child_process');

const DEV_SCRIPTS = ['dev:api', 'dev:bot'];

function runDevAll({
  cwd = process.cwd(),
  env = process.env,
  processModule = process,
  spawnImpl = spawn,
} = {}) {
  return new Promise((resolve, reject) => {
    const children = [];
    let exited = 0;
    let failed = false;
    let interrupted = false;
    let settled = false;
    let stopping = false;
    const finishedChildren = new Set();
    const handledChildren = new Set();

    const onSignal = signal => {
      interrupted = true;
      stopChildren(signal);
    };
    const onSigint = () => onSignal('SIGINT');
    const onSigterm = () => onSignal('SIGTERM');

    const removeSignalHandlers = () => {
      processModule.removeListener('SIGINT', onSigint);
      processModule.removeListener('SIGTERM', onSigterm);
    };

    const finish = code => {
      if (settled) return;
      settled = true;
      removeSignalHandlers();
      resolve(code);
    };

    const stopChildren = signal => {
      if (stopping) return;
      stopping = true;
      for (const child of children) {
        if (!child || finishedChildren.has(child)) continue;
        try {
          child.kill(signal);
        } catch {
          // The child may have exited between the check and kill call.
        }
      }
    };

    processModule.on('SIGINT', onSigint);
    processModule.on('SIGTERM', onSigterm);

    try {
      const handleChildExit = (child, code, signal) => {
        if (handledChildren.has(child)) return;
        handledChildren.add(child);
        finishedChildren.add(child);
        exited += 1;
        if (code !== 0 || signal) failed = true;
        if (failed && exited < children.length) stopChildren('SIGTERM');
        if (exited === children.length) {
          finish(interrupted ? 130 : failed ? 1 : 0);
        }
      };

      for (const script of DEV_SCRIPTS) {
        const child = spawnImpl('yarn', [script], {
          cwd,
          env,
          stdio: 'inherit',
        });
        children.push(child);
        child.on('error', () => handleChildExit(child, 1, null));
        child.on('exit', (code, signal) =>
          handleChildExit(child, code, signal)
        );
        child.on('close', (code, signal) =>
          handleChildExit(child, code, signal)
        );
      }
    } catch (error) {
      failed = true;
      stopChildren('SIGTERM');
      removeSignalHandlers();
      reject(error);
    }
  });
}

if (require.main === module) {
  runDevAll()
    .then(code => {
      process.exitCode = code;
    })
    .catch(error => {
      console.error(`Could not start development services: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { DEV_SCRIPTS, runDevAll };
