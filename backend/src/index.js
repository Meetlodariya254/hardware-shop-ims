'use strict';

require('dotenv').config();

const app = require('./server');
const { testConnection } = require('./config/database');
const { config } = require('./config/environment');
const logger = require('./utils/logger');

let _server = null;

async function startServer() {
  // Test database connection first
  const dbConnected = await testConnection();
  if (!dbConnected) {
    const msg = '❌ Failed to connect to SQLite database. Check AppData folder permissions.';
    logger.error(msg);
    throw new Error(msg);
  }

  // Run migrations automatically
  try {
    const runMigrations = require('../migrations/run');
    await runMigrations();
  } catch (err) {
    logger.error('❌ Migration error: ' + err);
    throw err;
  }

  // Start HTTP server — wrap in a Promise so errors are catchable
  await new Promise((resolve, reject) => {
    _server = app.listen(config.port, () => {
      logger.info(`Server started in ${config.node_env} mode on port ${config.port}`);
      resolve();
    });

    _server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${config.port} is already in use. Close the other instance and try again.`));
      } else {
        reject(err);
      }
    });
  });

  // Graceful shutdown (only register when NOT embedded in Electron to avoid duplicates)
  if (process.env.EMBEDDED_IN_ELECTRON !== '1') {
    const gracefulShutdown = (signal) => {
      logger.info(`\n${signal} received. Shutting down gracefully...`);
      if (_server) {
        _server.close(() => {
          logger.info('Server closed.');
          process.exit(0);
        });
      }
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  // Only log unhandled rejections — never exit (Electron manages the process lifecycle)
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection: %O', err);
  });
}

// Export so main.js can call and await it properly
module.exports = { startServer };

// Only auto-start when run directly (not when required by Electron)
if (require.main === module) {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err.message);
    process.exit(1);
  });
}
