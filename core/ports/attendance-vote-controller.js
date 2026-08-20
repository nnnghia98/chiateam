function createAttendanceVoteController({ close } = {}) {
  if (typeof close !== 'function') {
    throw new TypeError('attendance vote controller close must be a function.');
  }

  return Object.freeze({
    async close(reference, context) {
      const result = await close(reference, context);

      return Object.freeze({
        closed: result === true || result?.closed === true,
      });
    },
  });
}

function assertAttendanceVoteController(controller) {
  if (!controller || typeof controller.close !== 'function') {
    throw new TypeError('A valid attendance vote controller is required.');
  }

  return controller;
}

module.exports = {
  assertAttendanceVoteController,
  createAttendanceVoteController,
};
