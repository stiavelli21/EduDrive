// =============================================================================
// EduDrive — Server Entry Point
// =============================================================================
// Starts the Express server on the configured port.
// This is the file you run: node src/server.js
// =============================================================================

import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║                                              ║
  ║   🎓 EduDrive API Server                     ║
  ║                                              ║
  ║   Running on: http://localhost:${PORT}          ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}              ║
  ║   Health: http://localhost:${PORT}/api/health   ║
  ║                                              ║
  ╚══════════════════════════════════════════════╝
  `);
});
