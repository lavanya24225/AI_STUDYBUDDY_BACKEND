/**
 * Wraps an async route handler and forwards any thrown/rejected error
 * to Express's error-handling middleware via next(error).
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
