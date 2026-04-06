import { createLogger, formatTimestamp, timestamp } from '@bitpay-labs/bitcore-logging';
import parseArgv from './utils/parseArgv';

const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
export const logger = createLogger({ prefix: 'BCN', debug: args.DEBUG });
export const transports = logger.transports;
export { formatTimestamp, timestamp };
export default logger;
