const mongoose = require('mongoose');
const logger   = require('../logger');
const Blocks   = require('./blocks');
const Txs   = require('./transactions');

mongoose.connection.on('error', (err) => {
  logger.log('error',
    `Failed to connect to Mongo Database
    ${err}`);
});

process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

// Catastrophic Fails can still result in data loss
function gracefulExit() {
  logger.log('debug',
    'Graceful Shutdown Starting...');
  mongoose.connection.close(() => {
    logger.log('debug',
      'Mongoose connection with DB disconnected through app termination');
    process.exit(0);
  });
}

module.exports = {
  connect:    mongoose.connect,
  connection: mongoose.connection,
  blocks:     Blocks,
  txs:        Txs,
};
