function createPermissionPolicy({ isAllowed } = {}) {
  if (typeof isAllowed !== 'function') {
    throw new TypeError('permission policy requires an isAllowed function.');
  }

  return Object.freeze({
    async isAllowed(context, permission) {
      return Boolean(await isAllowed(context, permission));
    },
  });
}

function createAllowAllPermissionPolicy() {
  return createPermissionPolicy({ isAllowed: async () => true });
}

function assertPermissionPolicy(policy) {
  if (!policy || typeof policy.isAllowed !== 'function') {
    throw new TypeError('A valid permission policy is required.');
  }

  return policy;
}

module.exports = {
  assertPermissionPolicy,
  createAllowAllPermissionPolicy,
  createPermissionPolicy,
};
