import * as auth from './auth';
import * as convert from './convert';
import * as jsonStream from './jsonStream';
import * as parseArgv from './parseArgv';
import * as stats from './stats';

export { auth, convert, jsonStream, parseArgv, stats };

export function overlaps(a?: Array<any>, b?: Array<any>): boolean {
  return !!a?.some((item) => b?.includes(item));
}

export async function wait(time: number) {
  return new Promise(resolve => setTimeout(resolve, time).unref());
}

export function tryParse(str: string): any {
  if (typeof str !== 'string') {
    return str;
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

/**
 * Wrapper for JSON.stringify that also converts BigInts to strings
 * @param obj 
 * @returns 
 */
export function jsonStringify(obj: any): string {
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

export function partition<T>(array: T[], n: number): T[][] {
  n = n > 0 ? Math.ceil(n) : 1;
  return array.length ? [array.slice(0, n)].concat(partition(array.slice(n), n)) : [];
}

export function isUndefined<T>(value: T) {
  return value === undefined;
}

export function valueOrDefault<T>(value: T | undefined, defaultVal: T): T {
  return value != undefined ? value : defaultVal;
}

export function isDateValid(dateStr: string): boolean {
  if (!dateStr) return false;
  return !isNaN(new Date(dateStr).getTime());
}