import logger from '../logger';
import util from 'util';

let LoggifiedClasses: { [key: string]: boolean } = {};

/**
 * Wraps each method on a class with a function that logs out the
 *  class name, method name, and arguments passed to the method
 * @export
 * @param {T} aClass 
 * @returns a new class where each method is wrapped

 * ## Example
 *  ```
 *   @LoggifyClass
 *   export class P2pService extends EventEmitter {
 * ```
 */
export function LoggifyClass<T extends { new(...args: any[]): {} }>(
  aClass: T
) {
  return class extends aClass {
    constructor(...args: any[]) {
      super(...args);
      var self = this;
      if (!LoggifiedClasses[aClass.name]) {
        LoggifiedClasses[aClass.name] = true;
        logger.debug(
          `Loggifying ${aClass.name} with args:: ${JSON.stringify(args)}`
        );
        LoggifyObject(aClass, aClass.name, self);
      }
    }
  };
}
/**
 * Wraps a method on a class with a function that logs out the
 *  method name, and arguments passed to the method
 * 
 * @export
 * @param {string} className 
 * @returns 
 */
export function LoggifyMethod(className: string) {
  return function (
    descriptor: TypedPropertyDescriptor<Function>
  ) {
    if (descriptor.value != undefined) {
      descriptor.value = LoggifyFunction(descriptor.value, className);
    }
  };
}
/**
 * Wraps a function and logs out a message and the function params
 * 
 * @export
 * @param {Function} fn the function to wrap
 * @param {string} [logPrefix] a message to be prefixed to the log
 * @param {*} [bind] what the function's 'this' should bound to
 * @returns a new wrapped function
 */
export function LoggifyFunction(fn: Function, logPrefix?: string, bind?: any) {
  let copy = fn;
  if (bind) {
    copy = copy.bind(bind);
  }
  return function (...methodargs: any[]) {
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
          return data;
        });
    } else {
      logger.debug(`${logPrefix}::returned::${util.inspect(returnVal)}`);
    }
    return returnVal;
  };
}
/**
 Wraps each method on an object with a function that logs out the
 *  method name, and arguments passed to the method
 * 
 * @export
 * @param {*} obj The object to wrap
 * @param {string} [logPrefix=''] a message to be prefixed to the logs
 * @param {*} [bind] what the function's 'this' should bound to
 * @returns an object where each method is wrapped
 */
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
