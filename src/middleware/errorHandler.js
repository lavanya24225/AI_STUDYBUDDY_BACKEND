/**
 * Centralized error handler. Every thrown/forwarded error is normalized
 * into { success: false, message } with an appropriate HTTP status code.
 * Stack traces and internal details are never exposed outside development.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong";

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    statusCode = 422;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    message = `Duplicate value for ${field}. It must be unique.`;
  }

  // Mongoose invalid ObjectId cast
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // Multer file size / upload errors
  if (err.name === "MulterError") {
    statusCode = 422;
    message = `File upload error: ${err.message}`;
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  const response = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV !== "production" && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
