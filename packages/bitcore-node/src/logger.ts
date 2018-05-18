import * as winston from 'winston';
import parseArgv from './utils/parseArgv';
let args = parseArgv([], ['DEBUG']);
const logLevel = args.DEBUG ? 'debug' : 'info';
const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      colorize: true,
      level: logLevel
    })
  ]
});

export default logger;
