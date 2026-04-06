import util from 'util';
import * as winston from 'winston';

export const PerformanceTracker: Record<string, { time: number; count: number; avg: number; max: number }> = {};

let _debugEnabled = false;
let _logger: winston.Logger | null = null;

/**
 * Initialize the Loggify decorators with a logger and debug flag.
 * Must be called before using LoggifyClass/LoggifyFunction/LoggifyObject.
 */
export function initLoggify(logger: winston.Logger, debug: boolean): void {
  if (_logger) {
    _logger.warn('initLoggify called more than once — overwriting existing logger');
  }
  _logger = logger;
  _debugEnabled = debug;
}

export function SavePerformance(logPrefix: string, startTime: Date, endTime: Date): void {
  const totalTime = endTime.getTime() - startTime.getTime();
  if (!PerformanceTracker[logPrefix]) {
    PerformanceTracker[logPrefix] = {
      time: totalTime,
      count: 1,
      avg: totalTime,
      max: totalTime
    };
  } else {
    PerformanceTracker[logPrefix].time += totalTime;
    PerformanceTracker[logPrefix].count++;
    PerformanceTracker[logPrefix].avg = PerformanceTracker[logPrefix].time / PerformanceTracker[logPrefix].count;
    PerformanceTracker[logPrefix].max = Math.max(totalTime, PerformanceTracker[logPrefix].max);
  }
}

export function LoggifyClass<T extends new (...args: any[]) => object>(aClass: T) {
  if (!_debugEnabled || !_logger) {
    return aClass;
  }
  const logger = _logger;
  return class extends aClass {
    constructor(...args: any[]) {
      super(...args);
      logger.debug(`Loggifying ${aClass.name} with args:: ${util.inspect(args)}`);
      for (const prop of Object.getOwnPropertyNames(aClass.prototype)) {
        if (typeof this[prop] === 'function') {
          logger.debug(`Loggifying  ${aClass.name}::${prop}`);
          this[prop] = LoggifyFunction(this[prop], `${aClass.name}::${prop}`, this);
        }
      }
    }
  };
}

export function LoggifyFunction(fn: (...args: any[]) => any, logPrefix: string = '', bind?: any) {
  if (!_debugEnabled || !_logger) {
    return fn as (...methodargs: any[]) => any;
  }
  const logger = _logger;
  let copy = fn;
  if (bind) {
    copy = copy.bind(bind);
  }
  return function(...methodargs: any[]) {
    const startTime = new Date();
    logger.debug(`${logPrefix}::called::`);
    const returnVal = copy(...methodargs);
    if (returnVal && returnVal.then) {
      returnVal
        .catch((err: any) => {
          logger.error(`${logPrefix}::catch::${err}`);
        })
        .then((data: any) => {
          logger.debug(`${logPrefix}::resolved::`);
          SavePerformance(logPrefix, startTime, new Date());
          return data;
        });
    } else {
      SavePerformance(logPrefix, startTime, new Date());
      logger.debug(`${logPrefix}::returned::`);
    }
    return returnVal;
  };
}

export function LoggifyObject(obj: any, logPrefix: string = '', bind?: any) {
  if (!_debugEnabled || !_logger) {
    return obj;
  }
  const logger = _logger;
  for (const prop of Object.getOwnPropertyNames(obj)) {
    if (typeof obj[prop] === 'function') {
      logger.debug(`Loggifying  ${logPrefix}::${prop}`);
      obj[prop] = LoggifyFunction(obj[prop], `${logPrefix}::${prop}`, bind);
    }
  }
  return obj;
}
