import path from 'path';
import * as winston from 'winston';
import { consoleFormat, httpFormat } from './formatters';
import { LoggerConfig } from './types';

/**
 * Build the transport array for a given config.
 * Reads environment variables using the config prefix:
 *   {PREFIX}_LOG_LEVEL, {PREFIX}_LOG_HTTP_HOST, etc.
 */
export function getTransports(config: LoggerConfig): winston.transport[] {
  const prefix = config.prefix;
  const defaultLevel = config.defaultLevel || 'info';
  const logLevel = config.debug ? 'debug' : (process.env[`${prefix}_LOG_LEVEL`] || defaultLevel);
  const lowerPrefix = prefix.toLowerCase();

  const result: winston.transport[] = [
    new winston.transports.Console({
      level: logLevel,
      format: consoleFormat()
    })
  ];

  const httpHost = process.env[`${prefix}_LOG_HTTP_HOST`];
  if (httpHost) {
    const scriptName = process.argv[1] ? path.parse(process.argv[1]).name : 'unknown';
    const defaultPath = `${lowerPrefix}.${scriptName}`;
    const tag = process.env[`${prefix}_LOG_HTTP_TAG`] || defaultPath;

    result.push(new winston.transports.Http({
      level: process.env[`${prefix}_LOG_HTTP_LEVEL`] || logLevel,
      host: httpHost,
      port: parseInt(process.env[`${prefix}_LOG_HTTP_PORT`] as string) || undefined,
      path: process.env[`${prefix}_LOG_HTTP_PATH`] || defaultPath,
      headers: {
        'Content-Type': 'application/json'
      },
      format: httpFormat(tag)
    }));
  }

  return result;
}

/**
 * Create a Winston logger configured via environment variables.
 *
 * Usage:
 *   const logger = createLogger({ prefix: 'BCN' });
 *   // reads BCN_LOG_LEVEL, BCN_LOG_HTTP_HOST, etc.
 */
export function createLogger(config: LoggerConfig): winston.Logger {
  const transports = getTransports(config);
  return winston.createLogger({ transports });
}
