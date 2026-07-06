// =============================================================================
// EduDrive — Error Handling Middleware
// =============================================================================
// Centralized error handler for Express. Catches all unhandled errors and
// returns a consistent JSON response.
//
// PLUGIN DEVELOPERS: Throw errors with a `statusCode` property to control
// the HTTP response code. Example:
//   const error = new Error('Not found');
//   error.statusCode = 404;
//   throw error;
// =============================================================================

/**
 * Global error handling middleware.
 * Must be registered LAST in the Express middleware chain.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // Log the error for debugging (in development)
  if (process.env.NODE_ENV !== 'production') {
    console.error('🔴 Error:', err.message);
    console.error(err.stack);
  }

  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

/**
 * Handle 404 — Route not found.
 * Register this BEFORE the error handler but AFTER all routes.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
}
