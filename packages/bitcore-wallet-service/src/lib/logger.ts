import * as winston from 'winston';
// const logLevel = args.DEBUG ? 'debug' : 'info';
//
export const transport = new winston.transports.Console({
  level: process.env.BWS_LOG_LEVEL || 'debug'
});

export const logger = winston.createLogger({
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
  ),
  transports: [transport]
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
