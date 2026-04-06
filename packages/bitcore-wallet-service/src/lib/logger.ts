import { createLogger, formatTimestamp, timestamp } from '@bitpay-labs/bitcore-logging';

export const logger = createLogger({ prefix: 'BWS', defaultLevel: 'debug' });
export const transports = logger.transports;
export { formatTimestamp, timestamp };
export default logger;
