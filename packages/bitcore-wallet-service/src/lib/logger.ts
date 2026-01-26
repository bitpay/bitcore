import path from 'path';
import * as winston from 'winston';

// const logLevel = args.DEBUG ? 'debug' : 'info';
const logLevel = process.env.BWS_LOG_LEVEL || 'debug';

export const transports: winston.transport[] = [
  new winston.transports.Console({
    level: logLevel,
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.prettyPrint(),
      winston.format.splat(),
      winston.format.simple(),
      winston.format.printf(function(info) {
        // fallback in case the above formatters don't work.
        // eg: logger.log({ some: 'object' })
        if (typeof info.message === 'object') {
          info.message = JSON.stringify(info.message, null, 4);
        }
        return `${info.level} :: ${new Date().toISOString()} :: ${info.message}`;
      })
    ),
  })
];

if (process.env.BWS_LOG_HTTP_HOST) {
  transports.push(new winston.transports.Http({
    level: process.env.BWS_LOG_HTTP_LEVEL || logLevel,
    host: process.env.BWS_LOG_HTTP_HOST,
    port: parseInt(process.env.BWS_LOG_HTTP_PORT) || undefined,
    path: process.env.BWS_LOG_HTTP_PATH || ('bws.' + path.parse(process.argv[1]).name),
    headers: {
      'Content-Type': 'application/json'
    },
    format: winston.format.printf(info => JSON.stringify({
      tag: process.env.BWS_LOG_HTTP_TAG || ('bws.' + path.parse(process.argv[1]).name),
      ...info
    })),
  }));
}

export const logger = winston.createLogger({ transports });

export const formatTimestamp = (date: Date): string =>
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
    // .padEnd(3, '0')} ${timezone}`;
    .padEnd(3, '0')}`;

export const timestamp = () => formatTimestamp(new Date());

export default logger;
