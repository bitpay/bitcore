import { createLogger, formatTimestamp, timestamp } from '@bitpay-labs/bitcore-logging';

type BwsLogger = ReturnType<typeof createLogger>;

export const logger: BwsLogger = createLogger({ prefix: 'BWS', defaultLevel: 'debug' });
export const transports: BwsLogger['transports'] = logger.transports;
export { formatTimestamp, timestamp };
export default logger;
