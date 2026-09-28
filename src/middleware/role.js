/**
 * Restricts access to users whose role is included in allowedRoles.
 * Must run after the `protect` auth middleware, since it relies on req.user.
 * Usage: requireRole("admin") or requireRole("admin", "student")
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error("Not authorized: authentication required");
      error.statusCode = 401;
      return next(error);
    }

    if (!allowedRoles.includes(req.user.role)) {
      const error = new Error(`Forbidden: requires role(s): ${allowedRoles.join(", ")}`);
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};

module.exports = requireRole;
