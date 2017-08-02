const winston = require('winston');
const logfile = new Date().toISOString();

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

logger.level = process.env.LOG || 'debug';

module.exports = logger;
