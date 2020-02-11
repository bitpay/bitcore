import util from 'util';
import logger from '../logger';
import parseArgv from '../utils/parseArgv';
export const PerformanceTracker = {};
let args = parseArgv([], ['DEBUG']);

export function SavePerformance(logPrefix, startTime, endTime) {
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

export function LoggifyClass<T extends new (...args: any[]) => {}>(aClass: T) {
  if (!args.DEBUG) {
    return aClass;
  }
  return class extends aClass {
    constructor(...args: any[]) {
      super(...args);
      logger.debug(`Loggifying ${aClass.name} with args:: ${util.inspect(args)}`);
      for (let prop of Object.getOwnPropertyNames(aClass.prototype)) {
        if (typeof this[prop] === 'function') {
          logger.debug(`Loggifying  ${aClass.name}::${prop}`);
          this[prop] = LoggifyFunction(this[prop], `${aClass.name}::${prop}`, this);
        }
      }
    }
  };
}

export function LoggifyFunction(fn: (...args: any[]) => any, logPrefix: string = '', bind?: any) {
  if (!args.DEBUG) {
    return fn as (...methodargs: any[]) => any;
  }
  let copy = fn;
  if (bind) {
    copy = copy.bind(bind);
  }
  return function(...methodargs: any[]) {
    const startTime = new Date();
    logger.debug(`${logPrefix}::called::`);
    let returnVal = copy(...methodargs);
    if (returnVal && (returnVal.then as Promise<any>)) {
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
  if (!args.DEBUG) {
    return obj;
  }
  for (let prop of Object.getOwnPropertyNames(obj)) {
    if (typeof obj[prop] === 'function') {
      let copy = obj[prop];
      if (bind) {
        copy = copy.bind(bind);
      }
      logger.debug(`Loggifying  ${logPrefix}::${prop}`);
      obj[prop] = LoggifyFunction(obj[prop], `${logPrefix}::${prop}`, bind);
    }
  }
  return obj;
}
