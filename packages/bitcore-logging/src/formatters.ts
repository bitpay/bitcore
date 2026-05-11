import * as winston from 'winston';

/**
 * Shared console format: colorize + prettyPrint + splat + simple + custom printf.
 * Matches the existing BCN/BWS console output format.
 */
export function consoleFormat(): winston.Logform.Format {
  return winston.format.combine(
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
  );
}

/**
 * Shared HTTP transport format with a tag field for log aggregation.
 */
export function httpFormat(tag: string): winston.Logform.Format {
  return winston.format.combine(
    winston.format.splat(),
    winston.format.simple(),
    winston.format.printf(info => {
      // fallback in case the above formatters don't work.
      // eg: logger.log({ some: 'object' })
      if (typeof info.message === 'object') {
        info.message = JSON.stringify(info.message, null, 4);
      }
      return JSON.stringify({ tag, ...info });
    })
  );
}
