const mongoose = require('mongoose');
const logger   = require('../logger');

mongoose.connection.on('error', (err) => {
  logger.log('error',
    `Failed to connect to Mongo Database
    ${err}`);
});

module.exports = mongoose;
