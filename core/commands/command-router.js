const { createCommandContext } = require('../contracts/command-context');
const { createCommandResult } = require('../contracts/command-result');
const {
  assertPermissionPolicy,
  createAllowAllPermissionPolicy,
} = require('../ports/permission-policy');
const { assertStateRepository } = require('../ports/state-repository');

function requireConditionResult(value) {
  if (!value || typeof value !== 'object' || typeof value.ok !== 'boolean') {
    throw new TypeError('command condition must return an object with ok.');
  }

  return value;
}

function requireActionResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('command action must return an object.');
  }

  if (value.changed === true) {
    if (
      !value.changes ||
      typeof value.changes !== 'object' ||
      Array.isArray(value.changes)
    ) {
      throw new TypeError(
        'a changed command action must return a changes object.'
      );
    }
  }

  return value;
}

function createCommandRouter({
  registry,
  stateRepository,
  permissionPolicy,
} = {}) {
  if (!registry || typeof registry.find !== 'function') {
    throw new TypeError('A valid command registry is required.');
  }

  const repository = assertStateRepository(stateRepository);
  const activePermissionPolicy = assertPermissionPolicy(
    permissionPolicy || createAllowAllPermissionPolicy()
  );

  return Object.freeze({
    async run(inputContext) {
      const context = createCommandContext(inputContext);
      const definition = registry.find(context.command);

      if (!definition) {
        return Object.freeze({
          handled: false,
          command: context.command,
          result: null,
        });
      }

      const requiredPermission = await definition.resolvePermission(context);
      const hasPermission = await activePermissionPolicy.isAllowed(
        context,
        requiredPermission
      );

      if (!hasPermission) {
        const outcome = {
          ok: false,
          changed: false,
          phase: 'permission',
          code: 'PERMISSION_DENIED',
          requiredPermission,
        };
        const result = createCommandResult(
          await definition.reply(outcome, context, {})
        );

        return Object.freeze({
          handled: true,
          command: definition.name,
          result,
        });
      }

      let state = {};

      try {
        const stateKeys = await definition.resolveStateKeys(context);
        state = stateKeys.length > 0 ? await repository.load(stateKeys) : {};
      } catch (error) {
        const outcome = {
          ok: false,
          changed: false,
          phase: 'state',
          code: 'STATE_LOAD_FAILED',
          error,
        };
        const result = createCommandResult(
          await definition.reply(outcome, context, state)
        );

        return Object.freeze({
          handled: true,
          command: definition.name,
          result,
        });
      }

      const condition = requireConditionResult(
        await definition.condition(context, state)
      );
      let outcome;

      if (!condition.ok) {
        outcome = {
          ...condition,
          ok: false,
          changed: false,
          phase: 'condition',
        };
      } else {
        const action = requireActionResult(
          await definition.action(context, state, condition)
        );

        if (action.changed === true) {
          try {
            await repository.save(action.changes);
          } catch (error) {
            const result = createCommandResult(
              await definition.reply(
                {
                  ...action,
                  ok: false,
                  changed: false,
                  phase: 'state',
                  code: 'STATE_SAVE_FAILED',
                  condition,
                  error,
                },
                context,
                state
              )
            );

            return Object.freeze({
              handled: true,
              command: definition.name,
              result,
            });
          }
        }

        outcome = {
          ok: action.ok !== false,
          ...action,
          changed: action.changed === true,
          phase: 'action',
          condition,
        };
      }

      const result = createCommandResult(
        await definition.reply(outcome, context, state)
      );

      return Object.freeze({
        handled: true,
        command: definition.name,
        result,
      });
    },
  });
}

module.exports = {
  createCommandRouter,
};
