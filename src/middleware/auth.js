const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Verifies the Bearer JWT on the Authorization header, loads the
 * corresponding user (without password) and attaches it to req.user.
 */
const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new Error("Not authorized: no token provided");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    const error = new Error("Not authorized: malformed token");
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const error = new Error(
      err.name === "TokenExpiredError" ? "Not authorized: token expired" : "Not authorized: invalid token"
    );
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    const error = new Error("Not authorized: user no longer exists");
    error.statusCode = 401;
    throw error;
  }

  req.user = user;
  next();
});

module.exports = protect;
