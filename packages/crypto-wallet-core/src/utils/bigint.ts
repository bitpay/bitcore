import type { BigIntLike } from '../types/utils';


function isValidDenominator(val: BigIntLike): boolean {
  return isBigIntLike(val) && BigInt(val) !== 0n;
};

/**
 * Checks if a value is a BigInt-like type (bigint, number, or numeric string)
 * @param value 
 * @returns {boolean}
 */
export function isBigIntLike(value?: any): boolean {
  return value != null &&
    value !== '' &&
    (
      typeof value === 'bigint' ||
      (typeof value === 'number' && !isNaN(value)) ||
      !isNaN(Number(value))
    );
};

/**
 * This is a special wrapper for BigInt() that assumes a string _without_ a prefix is hex.
 * @example sToBigInt('0x12') => 18n
 * @example sToBigInt('12') => 18n // assumes hex
 * @example sToBigInt(12) => 12n
 * @example sToBigInt('0o12') => 10n // octal
 * @returns {bigint}
 */
export function sToBigInt(value: number | string): bigint {
  const isNonPrefixedString = typeof value === 'string' &&
      !value?.startsWith('0x') &&
      !value?.startsWith('0o');
  return BigInt(isNonPrefixedString ? ('0x' + value) : value);
};

/**
 * Math.max() for a mixed array of BigInts, Numbers, and Strings
 * @param {Array<BigIntLike>} arr Array of BigInts, Numbers, and/or Strings
 * @returns {BigIntLike} Returns the max entry
 */
export function max(arr: Array<BigIntLike>): BigIntLike {
  if (!Array.isArray(arr)) throw new Error('Input must be an array');
  if (!arr.every(isBigIntLike)) throw new Error('Array must contain only BigInt-like values');
  return arr.reduce((max, cur) => cur > max ? cur : max, arr[0]);
};


/**
 * Math.min() for a mixed array of BigInts, Numbers, and Strings
 * @param {Array<BigIntLike>} arr Array of BigInts, Numbers, and/or Strings
 * @returns {BigIntLike} Returns the min entry
 */
export function min(arr: Array<BigIntLike>): BigIntLike {
  if (!Array.isArray(arr)) throw new Error('Input must be an array');
  if (!arr.every(isBigIntLike)) throw new Error('Array must contain only BigInt-like values');
  return arr.reduce((min, cur) => cur < min ? cur : min, arr[0]);
};


/**
 * Divide BigInts with precision. This works for Numbers and strings as well since it converts the inputs to BigInts
 * @param {BigIntLike} numerator
 * @param {BigIntLike} denominator
 * @param {BigIntLike} precision (optional) Default: 18
 * @returns {number}
 */
export function divToFloat(numerator: BigIntLike, denominator: BigIntLike, precision?: number) {
  if (!isBigIntLike(numerator)) throw new Error('Invalid numerator');
  if (!isBigIntLike(denominator)) throw new Error('Invalid denominator');
  if (!isValidDenominator(denominator)) throw new Error('Division by zero');
  const [nLeft, nRightInitial = ''] = numerator.toString().split('.');
  let nRight = nRightInitial;
  const [, dRight = ''] = denominator.toString().split('.');
  if (precision == null) {
    precision = Math.max(nRight.length, dRight.length, 18);
  }
  nRight = nRight.padEnd(precision, '0');
  const scaledNumerator = BigInt(nLeft + nRight);
  const quotient = scaledNumerator / BigInt(denominator);
  return Number(quotient) / (10 ** precision);
};


/**
 * Divide BigInts with precision. This works for Numbers and strings as well since it converts the inputs to BigInts
 * @param {BigIntLike} numerator
 * @param {BigIntLike} denominator
 * @returns {bigint} Rounded BigInt
 */
export function div(numerator: BigIntLike, denominator: BigIntLike): bigint {
  if (!isBigIntLike(numerator)) throw new Error('Invalid numerator');
  if (!isBigIntLike(denominator)) throw new Error('Invalid denominator');
  if (!isValidDenominator(denominator)) throw new Error('Division by zero');
  const [nLeft, nRightInitial = ''] = numerator.toString().split('.');
  let nRight = nRightInitial;
  const [, dRight = ''] = denominator.toString().split('.');
  const precision = Math.max(nRight.length, dRight.length, 18);
  nRight = nRight.padEnd(precision, '0');

  const scaledNumerator = BigInt(nLeft + nRight);
  const quotient = (scaledNumerator / BigInt(denominator)).toString();
  return BigInt(quotient.slice(0, -precision)) + BigInt(Math.round(Number('.' + quotient.slice(-precision))));
};


/**
 * Multiply mixed numbers. If decimals are given, this maintains precision of any given decimals until the very end to get the most precise result.
 * @example mul(2n, 1.4) => 2.8 => 3n
 * @example mul(1n, 1.1) => 1.1 => 1n
 *
 * @param  {...BigIntLike} nums
 * @returns {bigint} Returns a rounded bigint
 */
export function mul(...nums: Array<BigIntLike>): bigint {
  if (!nums.length || !nums.every(isBigIntLike)) throw new Error('Input must contain only BigInt-like values');
  const precision = nums.reduce<number>((p: number, num: BigIntLike) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) { // all numbers are integers
    return nums.reduce<bigint>((acc: bigint, cur: BigIntLike) => acc * BigInt(cur), 1n);
  }
  
  let productScaled = 1n;
  for (const cur of nums) {
    const [left, rightInitial = ''] = cur.toString().split('.');
    const right = rightInitial.padEnd(precision, '0');
    productScaled *= BigInt(left + right);
  }
  const whole = productScaled.toString().slice(0, -(precision * nums.length));
  const decimal = productScaled.toString().slice(-(precision * nums.length));
  return BigInt(whole) + BigInt(Math.round(Number('.' + decimal)));
};


/**
 * Same as mul() but returns the floor of the result
 * @example mul(2n, 1.4) => 2.8 => 2n
 * @example mul(1n, 1.1) => 1.1 => 1n
 *
 * @param  {...BigIntLike} nums
 * @returns {bigint} Returns a floor-rounded BigInt
 */
export function mulFloor(...nums: Array<BigIntLike>): bigint {
  if (!nums.length || !nums.every(isBigIntLike)) throw new Error('Input must contain only BigInt-like values');
  const precision = nums.reduce<number>((p: number, num: BigIntLike) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) {
    return nums.reduce<bigint>((acc: bigint, cur: BigIntLike) => acc * BigInt(cur), 1n);
  }

  let productScaled = 1n;
  for (const cur of nums) {
    const [left, rightInitial = ''] = cur.toString().split('.');
    const right = rightInitial.padEnd(precision, '0');
    productScaled *= BigInt(left + right);
  }
  const whole = productScaled.toString().slice(0, -(precision * nums.length));
  // disregard the decimal since this is a floor
  return BigInt(whole);
};


/**
 * Same as mul() but returns the ceiling of the result
 * @example mul(2n, 1.4) => 2.8 => 3n
 * @example mul(1n, 1.1) => 1.1 => 2n
 *
 * @param  {...BigIntLike} nums
 * @returns {bigint} Returns a ceiling-rounded BigInt
 */
export function mulCeil(...nums: Array<BigIntLike>): bigint {
  if (!nums.length || !nums.every(isBigIntLike)) throw new Error('Input must contain only BigInt-like values');
  const precision = nums.reduce<number>((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) { // All nums are integers, so can just convert all to bigints
    return nums.reduce<bigint>((acc, cur) => acc * BigInt(cur), 1n);
  }

  let productScaled = 1n;
  for (const cur of nums) {
    const [left, rightInitial = ''] = cur.toString().split('.');
    const right = rightInitial.padEnd(precision, '0');
    productScaled *= BigInt(left + right);
  }
  const whole = productScaled.toString().slice(0, -(precision * nums.length));
  const decimal = productScaled.toString().slice(-(precision * nums.length));
  return BigInt(whole) + (BigInt(decimal) > 0n ? 1n : 0n);
};
