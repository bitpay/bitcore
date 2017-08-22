const winston = require('winston');
const config  = require('../../config');

const logfile = new Date().toISOString().split('T')[0];

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      timestamp: true,
    }),
    new (winston.transports.File)({
      filename: `logs/${logfile}.log`,
    }),
  ],
});

logger.level = process.env.LOG || config.logging;

module.exports = logger;
