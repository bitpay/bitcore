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

function gracefulExit() {
  mongoose.connection.close(() => {
    console.log('Mongoose connection with DB disconnected through app termination');
    process.exit(0);
  });
}

module.exports = {
  connect:    mongoose.connect,
  connection: mongoose.connection,
  blocks:     Blocks,
  txs:        Txs,
};
