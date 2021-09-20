import * as winston from 'winston';
import 'winston-daily-rotate-file';
export const transport = new winston.transports.DailyRotateFile({
  filename: 'bws-%DATE%.log',
  handleExceptions: true,
  maxSize: '40m',
  maxFiles: '14d',
  dirname: './logs',
  level: 'debug' // TODO
});

export const logger = winston.createLogger({
  transports: [transport],
  exceptionHandlers: [new winston.transports.File({ filename: 'exceptions.log', dirname: './logs' })],
  exitOnError: false
});

logger.on('error', function(err) {
  console.log(err);
});

const timezone = new Date()
  .toLocaleString('en-US', { timeZoneName: 'short' })
  .split(' ')
  .pop();

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
