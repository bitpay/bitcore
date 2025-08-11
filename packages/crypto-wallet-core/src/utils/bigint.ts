
/**
 * This is a special wrapper for BigInt() that assumes a string _without_ a prefix is hex.
 * @example toBigInt('0x12') => 18n
 * @example toBigInt('12') => 18n // assumes hex
 * @example toBigInt(12) => 12n
 * @example toBigInt('0o12') => 10n // octal
 */
export function sToBigInt(value: number | string) {
  return BigInt(typeof value !== 'string' || value?.startsWith('0x') ? value : ('0x' + value));
};

/**
 * Math.max() for a mixed array of BigInts, Numbers, and Strings
 * @param {Array<BigInt|Number|String>} arr Array of BigInts, Numbers, and/or Strings
 * @returns {BigInt|Number|String} Returns the max entry
 */
export function max(arr) {
  if (!Array.isArray(arr)) {
    throw new Error('Input must be an array');
  }
  return arr.reduce((max, cur) => cur > max ? cur : max, arr[0]);
};


/**
 * Math.min() for a mixed array of BigInts, Numbers, and Strings
 * @param {Array<BigInt|Number|String>} arr Array of BigInts, Numbers, and/or Strings
 * @returns {BigInt|Number|String} Returns the min entry
 */
export function min(arr) {
  if (!Array.isArray(arr)) {
    throw new Error('Input must be an array');
  }
  return arr.reduce((min, cur) => cur < min ? cur : min, arr[0]);
};


/**
 * Divide BigInts with precision. This works for Numbers and strings as well since it converts the inputs to BigInts
 * @param {BigInt|Number|String} numerator
 * @param {BigInt|Number|String} denominator
 * @param {BigInt|Number|String} precision (optional) Defaults to the max number of decimals in the inputs
 * @returns {Number}
 */
export function divToFloat(numerator, denominator, precision) {
  if (precision == null) {
    precision = Math.max(numerator.toString().split('.')[1]?.length || 0, denominator.toString().split('.')[1]?.length || 0);
  }
  const scaleFactor = 10n ** BigInt(precision);
  const scaledNumerator = BigInt(numerator) * scaleFactor;
  const quotient = scaledNumerator / BigInt(denominator);
  return Number(quotient) / (10 ** precision);
};


/**
 * Divide BigInts with precision. This works for Numbers and strings as well since it converts the inputs to BigInts
 * @param {BigInt|Number|String} numerator
 * @param {BigInt|Number|String} denominator
 * @returns {BigInt} Rounded BigInt
 */
export function div(numerator, denominator) {
  const precision = [numerator, denominator].reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  const scaleFactor = 10n ** BigInt(precision);
  const scaledNumerator = BigInt(numerator) * scaleFactor;
  const quotient = scaledNumerator / BigInt(denominator);
  return Number(quotient) / (10 ** precision);
};


/**
 * Multiply mixed numbers. If decimals are given, this maintains precision of any given decimals until the very end to get the most precise result.
 * @example mul(2n, 1.4) => 2.8 => 3n
 * @example mul(1n, 1.1) => 1.1 => 1n
 *
 * @param  {...BigInt|Number|String} nums
 * @returns {BigInt} Returns a rounded BigInt
 */
export function mul(...nums) {
  const precision = nums.reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) {
    return nums.reduce((acc, cur) => acc * BigInt(cur), 1n);
  }

  const scaleFactor = 10 ** precision;
  const retValScaled: string = nums.reduce((acc, cur) => {
    const curScaled = typeof cur === 'bigint' ? (cur * BigInt(scaleFactor)) : BigInt(cur * scaleFactor);
    return acc * curScaled;
  }, 1n).toString();
  return BigInt(retValScaled.slice(0, -precision)) + BigInt(Math.round(Number('.' + retValScaled.slice(-precision))));
};


/**
 * Same as mul() but returns the floor of the result
 * @example mul(2n, 1.4) => 2.8 => 2n
 * @example mul(1n, 1.1) => 1.1 => 1n
 *
 * @param  {...BigInt|Number|String} nums
 * @returns {BigInt} Returns a floor-rounded BigInt
 */
export function mulFloor(...nums) {
  const precision = nums.reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) {
    return nums.reduce((acc, cur) => acc * BigInt(cur), 1n);
  }

  const scaleFactor = 10 ** precision;
  const retValScaled = nums.reduce((acc, cur) => {
    const curScaled = typeof cur === 'bigint' ? (cur * BigInt(scaleFactor)) : BigInt(cur * scaleFactor);
    return acc * curScaled;
  }, 1n).toString();
  return BigInt(retValScaled.slice(0, -precision));
};


/**
 * Same as mul() but returns the ceiling of the result
 * @example mul(2n, 1.4) => 2.8 => 3n
 * @example mul(1n, 1.1) => 1.1 => 2n
 *
 * @param  {...BigInt|Number|String} nums
 * @returns {BigInt} Returns a ceiling-rounded BigInt
 */
export function mulCeil(...nums: (bigint | number | string)[]): bigint {
  const precision = nums.reduce<number>((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) { // All nums are integers, so can just convert all to bigints
    return nums.reduce<bigint>((acc, cur) => acc * BigInt(cur), 1n);
  }

  const scaleFactor = 10 ** precision;
  const retValScaled: string = nums.reduce<bigint>((acc, cur) => {
    const curScaled = typeof cur === 'bigint' ? (cur * BigInt(scaleFactor)) : BigInt(Number(cur) * scaleFactor);
    return acc * curScaled;
  }, 1n).toString();
  return BigInt(retValScaled.slice(0, -precision)) + (Number(retValScaled.slice(-precision)) > 0 ? 1n : 0n);
};
