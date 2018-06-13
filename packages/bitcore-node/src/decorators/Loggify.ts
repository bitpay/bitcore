import logger from '../logger';
import util from 'util';
export const PerformanceTracker = {};

let LoggifiedClasses: { [key: string]: boolean } = {};

export function SavePerformance(logPrefix, startTime, endTime) {
  const totalTime = endTime.getTime() - startTime.getTime();
  if(!PerformanceTracker[logPrefix]) {
    PerformanceTracker[logPrefix] = {
      time: totalTime,
      count: 1,
      avg: totalTime
    };
  } else {
    PerformanceTracker[logPrefix].time += totalTime;
    PerformanceTracker[logPrefix].count++;
    PerformanceTracker[logPrefix].avg = PerformanceTracker[logPrefix].time / PerformanceTracker[logPrefix].count ;
  }
}


export function LoggifyClass<T extends { new (...args: any[]): {} }>(
  aClass: T
) {
  return class extends aClass {
    constructor(...args: any[]) {
      super(...args);
      var self = this;
      if (!LoggifiedClasses[aClass.name]) {
        LoggifiedClasses[aClass.name] = true;
        logger.debug(
          `Loggifying ${aClass.name} with args:: ${util.inspect(args)}`
        );
        LoggifyObject(aClass, aClass.name, self);
      }
    }
  };
}

export function LoggifyMethod(className: string) {
  return function(
    descriptor: TypedPropertyDescriptor<Function>
  ) {
    if (descriptor.value != undefined) {
      descriptor.value = LoggifyFunction(descriptor.value, className);
    }
  };
}

export function LoggifyFunction(fn: Function, logPrefix: string = '', bind?: any) {
  let copy = fn;
  if (bind) {
    copy = copy.bind(bind);
  }
  return function(...methodargs: any[]) {
    const startTime = new Date();
    logger.debug(`${logPrefix}::args::${util.inspect(methodargs)}`);
    let returnVal = copy(...methodargs);
    if (returnVal && <Promise<any>>returnVal.then) {
      returnVal
        .catch((err: any) => {
          logger.error(`${logPrefix}::catch::${err}`);
          throw err;
        })
        .then((data: any) => {
          logger.debug(`${logPrefix}::resolved::${util.inspect(data)}`);
          SavePerformance(logPrefix, startTime, new Date());
          return data;
        });
    } else {
      SavePerformance(logPrefix, startTime, new Date());
      logger.debug(`${logPrefix}::returned::${util.inspect(returnVal)}`);
    }
    return returnVal;
  };
}

export function LoggifyObject(obj: any, logPrefix: string = '', bind?: any) {
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
