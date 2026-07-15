// =============================================================================
// EduDrive — Server Entry Point
// =============================================================================
// Starts the Express server on the configured port.
// This is the file you run: node src/server.js
// =============================================================================

import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  const env = process.env.NODE_ENV || 'development';
  const lines = [
    '',
    'EduDrive API Server',
    '',
    `Running on:  http://localhost:${PORT}`,
    `Environment: ${env}`,
    `Health:      http://localhost:${PORT}/api/health`,
    ''
  ];
  const width = 50;
  const formattedLines = lines.map(line => `  ║   ${line.padEnd(width - 3)}║`);
  console.log(`
  ╔${'═'.repeat(width)}╗
${formattedLines.join('\n')}
  ╚${'═'.repeat(width)}╝
`);
});

