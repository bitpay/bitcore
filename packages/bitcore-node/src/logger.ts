import path from 'path';
import * as winston from 'winston';
import parseArgv from './utils/parseArgv';

const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
const logLevel = args.DEBUG ? 'debug' : (process.env.BCN_LOG_LEVEL || 'info');


export const transports: winston.transport[] = [
  new winston.transports.Console({
    level: logLevel,
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.prettyPrint(),
      winston.format.splat(),
      winston.format.simple(),
      winston.format.printf(function(info) {
        // fallback in case the above formatters  don't work.
        // eg: logger.log({ some: 'object' })
        if (typeof info.message === 'object') {
          info.message = JSON.stringify(info.message, null, 4);
        }
        return `${info.level} :: ${new Date().toISOString()} :: ${info.message}`;
      })
    )
  })
];

if (process.env.BCN_LOG_HTTP_HOST) {
  transports.push(new winston.transports.Http({
    level: process.env.BCN_LOG_HTTP_LEVEL || logLevel,
    host: process.env.BCN_LOG_HTTP_HOST,
    port: parseInt(process.env.BCN_LOG_HTTP_PORT as string) || undefined,
    path: process.env.BCN_LOG_HTTP_PATH || ('bcn.' + path.parse(process.argv[1]).name),
    headers: {
      'Content-Type': 'application/json'
    },
    format: winston.format.printf(info => JSON.stringify({
      tag: process.env.BCN_LOG_HTTP_TAG || ('bcn.' + path.parse(process.argv[1]).name),
      ...info
    })),
  }));
}

export const logger = winston.createLogger({ transports });

const timezone = new Date()
  .toLocaleString('en-US', { timeZoneName: 'short' })
  .split(' ')
  .pop();

export const formatTimestamp = (date: Date) =>
  `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
    .getDate()
    .toString()
    .padStart(2, '0')} ${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date
    .getSeconds()
    .toString()
    .padStart(2, '0')}.${date
    .getMilliseconds()
    .toString()
    .padEnd(3, '0')} ${timezone}`;

export const timestamp = () => formatTimestamp(new Date());

export default logger;
