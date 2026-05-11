import {
  LoggifyClass,
  LoggifyFunction,
  LoggifyObject,
  PerformanceTracker,
  SavePerformance,
  initLoggify
} from '@bitpay-labs/bitcore-logging';
import logger from '../logger';
import parseArgv from '../utils/parseArgv';

const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
initLoggify(logger, !!args.DEBUG);

export { LoggifyClass, LoggifyFunction, LoggifyObject, SavePerformance, PerformanceTracker };
