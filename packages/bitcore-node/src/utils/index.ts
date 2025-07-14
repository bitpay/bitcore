import * as auth from './auth';
import * as convert from './convert';
import * as jsonStream from './jsonStream';
import * as parseArgv from './parseArgv';
import * as stats from './stats';
import * as mergeWith from './mergeWith';

export { mergeWith, auth, convert, jsonStream, parseArgv, stats };

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
  return new Date(dateStr).toString() !== 'Invalid Date';
}

/**
 * Returns an array of numbers from [start, end)
 * @param start Start of the range OR (if end is omitted) the number of elements in the range starting from 0
 * @param end (optional) End of the range (exclusive)
 * @returns If end is omitted, returns [0, start). Otherwise, returns [start, end)
 */
export function range(start: number, end?: number): number[] {
  if (end == null) {
    end = start;
    start = 0;
  }
  
  if (start <= end) {
    // ascending range
    return Array.from({ length: end - start }, (_, i) => start + i);
  } else {
    // descending range
    return Array.from({ length: start - end }, (_, i) => start - i);
  }
}

export function castToBool(input: any): boolean {
  if (input?.toLowerCase() === 'true' || input == '1') {
    return true;
  }
  return false;
}

/**
 * Uses `iteratee` which on each element in `array` to generate the criterion by which
 * uniqueness is computed. The iteratee is invoked with one argument: (value).
 *
 * @category Array
 * @param array The array to inspect.
 * @param iteratee The iteratee invoked per element.
 * @returns Returns the new duplicate free array.
 * @example
 *
 * uniqBy([2.1, 1.2, 2.3], Math.floor);
 * // => [2.1, 1.2]
 *
 * // using the `_.property` iteratee shorthand
 * uniqBy([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
 * // => [{ 'x': 1 }, { 'x': 2 }]
 */
export function uniqBy(array: any, iteratee: any) {
  return [...array.reduce((map, item) => {
    const key = (item === null || item === undefined) ?
      item : (typeof iteratee === 'function') ? iteratee(item) : item[iteratee];
      
    map.has(key) || map.set(key, item);

    return map;
  }, new Map()).values()];
}

/**
 * Creates a duplicate-free version of an array, using
 * [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons, in which only the first occurrence of each element
 * is kept.
 *
 * @category Array
 * @param array The array to inspect.
 * @returns Returns the new duplicate free array.
 * @example
 *
 * uniq([2, 1, 2]);
 * // => [2, 1]
 */
export function uniq<T>(array: T[]): T[] {  
  return [...new Set(array)];
}