const { createLogger, format, transports } = require('winston');
const { combine, timestamp, prettyPrint } = format;
import parseArgv from './utils/parseArgv';
let args = parseArgv([], ['DEBUG']);
const logLevel = args.DEBUG ? 'debug' : 'info';
const logger = createLogger({
    format: combine(
      timestamp(),
      prettyPrint()
    ),
    transports: [new transports.Console({
        level: logLevel
    })]
  })

export default logger;
