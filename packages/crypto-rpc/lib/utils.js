export const toNum = function(val) {
  return typeof val === 'bigint' ? Number(val) : val;
};

export const toBI = function(val) {
  return (typeof val === 'bigint' || isNaN(val)) ? val : BigInt(val);
};

export const objBItoNums = (obj) => {
  if (typeof obj === 'object') {
    return JSON.parse(JSON.stringify(obj, (key, value) => this.toNum(value)));
  }
  return this.toNum(obj);
};



export const BI = {}; // BigInt utilities namespace

function isValidDenominator(val) {
  return BI.isBigIntLike(val) && BigInt(val) !== 0n;
}

/**
 * Checks if a value is a BigInt-like type (bigint, number, or numeric string)
 * @param value 
 * @returns {boolean}
 */
BI.isBigIntLike = function(value) {
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
BI.sToBigInt = function(value) {
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
BI.max = function(arr) {
  if (!Array.isArray(arr)) throw new Error('Input must be an array');
  if (!arr.every(BI.isBigIntLike)) throw new Error('Array must contain only BigInt-like values');
  return arr.reduce((max, cur) => cur > max ? cur : max, arr[0]);
};


/**
 * Math.min() for a mixed array of BigInts, Numbers, and Strings
 * @param {Array<BigIntLike>} arr Array of BigInts, Numbers, and/or Strings
 * @returns {BigIntLike} Returns the min entry
 */
BI.min = function(arr) {
  if (!Array.isArray(arr)) throw new Error('Input must be an array');
  if (!arr.every(BI.isBigIntLike)) throw new Error('Array must contain only BigInt-like values');
  return arr.reduce((min, cur) => cur < min ? cur : min, arr[0]);
};


/**
 * Divide BigInts with precision. This works for Numbers and strings as well since it converts the inputs to BigInts
 * @param {BigIntLike} numerator
 * @param {BigIntLike} denominator
 * @param {BigIntLike} precision (optional) Default: 18
 * @returns {number}
 */
BI.divToFloat = function(numerator, denominator, precision) {
  if (!BI.isBigIntLike(numerator)) throw new Error('Invalid numerator');
  if (!BI.isBigIntLike(denominator)) throw new Error('Invalid denominator');
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
BI.div = function(numerator, denominator, opts) {
  if (!BI.isBigIntLike(numerator)) throw new Error('Invalid numerator');
  if (!BI.isBigIntLike(denominator)) throw new Error('Invalid denominator');
  if (!isValidDenominator(denominator)) throw new Error('Division by zero');
  opts = opts || {};
  const [nLeft, nRightInitial = ''] = numerator.toString().split('.');
  let nRight = nRightInitial;
  const [, dRight = ''] = denominator.toString().split('.');
  const precision = Math.max(nRight.length, dRight.length, 18);
  nRight = nRight.padEnd(precision, '0');

  const scaledNumerator = BigInt(nLeft + nRight);
  const quotient = (scaledNumerator / BigInt(denominator)).toString();
  let roundOne = BigInt(Math.round(Number('.' + quotient.slice(-precision))));
  if (opts.round === 'ceil' && roundOne > 0n) {
    roundOne = 1n;
  } else if (opts.round === 'floor') {
    roundOne = 0n;
  }
  return BigInt(quotient.slice(0, -precision)) + roundOne;
};


/**
 * Multiply mixed numbers. If decimals are given, this maintains precision of any given decimals until the very end to get the most precise result.
 * @example mul(2n, 1.4) => 2.8 => 3n
 * @example mul(1n, 1.1) => 1.1 => 1n
 *
 * @param  {...BigIntLike} nums
 * @returns {bigint} Returns a rounded bigint
 */
BI.mul = function(...nums) {
  if (!nums.length || !nums.every(BI.isBigIntLike)) throw new Error('Input must contain only BigInt-like values');
  const precision = nums.reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) { // all numbers are integers
    return nums.reduce((acc, cur) => acc * BigInt(cur), 1n);
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
BI.mulFloor = function(...nums) {
  if (!nums.length || !nums.every(BI.isBigIntLike)) throw new Error('Input must contain only BigInt-like values');
  const precision = nums.reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) {
    return nums.reduce((acc, cur) => acc * BigInt(cur), 1n);
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
BI.mulCeil = function(...nums) {
  if (!nums.length || !nums.every(BI.isBigIntLike)) throw new Error('Input must contain only BigInt-like values');
  const precision = nums.reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) { // All nums are integers, so can just convert all to bigints
    return nums.reduce((acc, cur) => acc * BigInt(cur), 1n);
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

BI.avgCeil = function(arr) {
  if (!Array.isArray(arr)) {
    throw new Error('Input must be an array');
  }
  if (arr.length === 0) {
    return 0n; // avoids division by zero
  }
  const sum = arr.reduce((sum, i) => sum + BigInt(i), 0n);
  return BI.div(sum, BigInt(arr.length), { round: 'ceil' });
};

BI.abs = function(val) {
  if (!BI.isBigIntLike(val)) {
    throw new Error('Input must be a BigInt-like value');
  }
  return val < 0n ? -val : val;
};

BI.sortAsc = function(arr) {
  return arr.sort((a, b) => Number(a - b));
};

BI.sortDesc = function(arr) {
  return arr.sort((a, b) => Number(b - a));
};