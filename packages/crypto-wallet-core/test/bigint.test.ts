import { expect } from 'chai';
import { BI } from '../src/utils';

describe('BigInt', function() {
  describe('isBigIntLike', function() {
    it('should return true for a number', function() {
      expect(BI.isBigIntLike(123)).to.equal(true);
    });

    it('should return true for a bigint', function() {
      expect(BI.isBigIntLike(123n)).to.equal(true);
    });

    it('should return true for a numeric string', function() {
      expect(BI.isBigIntLike('123')).to.equal(true);
    });
    
    it('should return true for a numeric hex string', function() {
      expect(BI.isBigIntLike('0x123')).to.equal(true);
    });

    it('should return false for a non-numeric string', function() {
      // Notice that `abc` are valid hex characters and sToBigInt('abc') => 2748n.
      // However, `abc` is not a valid number if it's desired to be treated as hex,
      //  you should call sToBigInt('abc') first OR append a '0x' hex prefix.
      expect(BI.isBigIntLike('abc')).to.equal(false);
    });

    it('should return false for an empty string', function() {
      expect(BI.isBigIntLike('')).to.equal(false);
    });

    it('should return false for a null value', function() {
      expect(BI.isBigIntLike(null)).to.equal(false);
    });

    it('should return false for a NaN value', function() {
      expect(BI.isBigIntLike(NaN)).to.equal(false);
    });
    
    it('should return false for undefined value', function() {
      expect(BI.isBigIntLike(undefined)).to.equal(false);
    });
    
    it('should return false for a totally off the wall value', function() {
      expect(BI.isBigIntLike({})).to.equal(false);
    });
  });

  describe('sToBigInt', function() {
    it('should convert a number to bigint', function() {
      expect(BI.sToBigInt(123)).to.equal(123n);
    });

    it('should convert a 0x-prefix hex string to bigint', function() {
      expect(BI.sToBigInt('0x12')).to.equal(18n);
    });

    it('should convert a 0o-prefix octal string to bigint', function() {
      expect(BI.sToBigInt('0o32')).to.equal(26n);
    });

    it('should treat a non-prefix string as hex', function() {
      expect(BI.sToBigInt('12')).to.equal(18n);
    });

    it('should throw on an invalid hex string', function() {
      expect(() => BI.sToBigInt('invalid')).to.throw('Cannot convert 0xinvalid to a BigInt');
    });

    it('should throw on an empty string', function() {
      expect(() => BI.sToBigInt('')).to.throw('Cannot convert 0x to a BigInt');
    });
  });

  describe('max', function() {
    it('should return the maximum bigint from an array of bigints', function() {
      expect(BI.max([1n, 2n, 3n, 2n, 1n])).to.equal(3n);
    });

    it('should return the maximum bigint from an array of mixed types', function() {
      expect(BI.max([1n, 2, '3', 2n, '1'])).to.equal('3');
    });

    it('should return undefined for an empty array', function() {
      expect(BI.max([])).to.be.undefined;
    });

    it('should throw on a null input', function() {
      expect(() => BI.max(null)).to.throw('Input must be an array');
    });
    
    it('should throw on an array of invalid types', function() {
      expect(() => BI.max(['x', 'y', 'z'])).to.throw('Array must contain only BigInt-like values');
    });

    it('should throw on an array with NaN, null, undefined, empty string', function() {
      expect(() => BI.max([1n, 2, '3', 2n, '1', NaN])).to.throw('Array must contain only BigInt-like values');
      expect(() => BI.max([1n, 2, '3', 2n, '1', null])).to.throw('Array must contain only BigInt-like values');
      expect(() => BI.max([1n, 2, '3', 2n, '1', undefined])).to.throw('Array must contain only BigInt-like values');
      expect(() => BI.max([1n, 2, '3', 2n, '1', ''])).to.throw('Array must contain only BigInt-like values');
    });
  });

  describe('min', function() {
    it('should return the minimum bigint from an array of bigints', function() {
      expect(BI.min([1n, 2n, 3n, 2n, 1n])).to.equal(1n);
    });

    it('should return the minimum bigint from an array of mixed types', function() {
      expect(BI.min([1n, 2, '3', 2n, '1'])).to.equal(1n);
    });

    it('should return undefined for an empty array', function() {
      expect(BI.min([])).to.be.undefined;
    });

    it('should throw on a null input', function() {
      expect(() => BI.min(null)).to.throw('Input must be an array');
    });
    
    it('should throw on an array of invalid types', function() {
      expect(() => BI.min(['x', 'y', 'z'])).to.throw('Array must contain only BigInt-like values');
    });

    it('should throw on an array with NaN, null, undefined, empty string', function() {
      expect(() => BI.min([1n, 2, '3', 2n, '1', NaN])).to.throw('Array must contain only BigInt-like values');
      expect(() => BI.min([1n, 2, '3', 2n, '1', null])).to.throw('Array must contain only BigInt-like values');
      expect(() => BI.min([1n, 2, '3', 2n, '1', undefined])).to.throw('Array must contain only BigInt-like values');
      expect(() => BI.min([1n, 2, '3', 2n, '1', ''])).to.throw('Array must contain only BigInt-like values');
    });
  });

  describe('divToFloat', function() {
    it('should return a number', function() {
      expect(BI.divToFloat(1n, 3n)).to.be.a('number');
    });

    it('should convert a bigint to a float', function() {
      expect(BI.divToFloat(1n, 3n).toString()).to.equal('0.3333333333333333');
    });

    it('should throw on division by zero', function() {
      expect(() => BI.divToFloat(1n, 0n)).to.throw('Division by zero');
      expect(() => BI.divToFloat(1n, 0)).to.throw('Division by zero');
      expect(() => BI.divToFloat(1n, '0')).to.throw('Division by zero');
      expect(() => BI.divToFloat(1n, '0x0')).to.throw('Division by zero');
      expect(() => BI.divToFloat(1n, '0o0')).to.throw('Division by zero');
    });

    it('should throw on invalid numerator', function() {
      expect(() => BI.divToFloat('', 3n)).to.throw('Invalid numerator');
      expect(() => BI.divToFloat(null, 3n)).to.throw('Invalid numerator');
      expect(() => BI.divToFloat(undefined, 3n)).to.throw('Invalid numerator');
      expect(() => BI.divToFloat('invalid', 3n)).to.throw('Invalid numerator');
    });

    it('should throw on invalid denominator', function() {
      expect(() => BI.divToFloat(1n, '')).to.throw('Invalid denominator');
      expect(() => BI.divToFloat(1n, null)).to.throw('Invalid denominator');
      expect(() => BI.divToFloat(1n, undefined)).to.throw('Invalid denominator');
      expect(() => BI.divToFloat(1n, 'invalid')).to.throw('Invalid denominator');
    });

    it('should convert a bigint to a float with specified precision', function() {
      expect(BI.divToFloat(1n, 3n, 5).toString()).to.equal('0.33333');
    });

    it('should maintain large float precision', function() {
      // Note that numerator / denominator with Numbers & strings != result
      // e.g. 12.4444444444444444444444444445 / 2 => 6.222222222222222
      // Thus, this test case tests that divToFloat() maintains precision
      const numerator = '12.4444444444444444444444444445'; // 28 decimals
      const denominator = 2;
      const result = 6.222222222222223; // the 3 at the end is important
      expect(BI.divToFloat(numerator, denominator)).to.equal(result);
    });
  });

  describe('div', function() {
    it('should return a bigint', function() {
      expect(BI.div(10n, 5n)).to.be.a('bigint');
    });

    it('should return a divided bigint', function() {
      expect(BI.div(10n, 5n)).to.equal(2n);
    });

    it('should return a rounded bigint', function() {
      expect(BI.div(1n, 2n)).to.equal(1n); // 1 / 2 = 0.5 => 1
      expect(BI.div(1n, 3n)).to.equal(0n); // 1 / 3 = 0.333... => 0
      expect(BI.div(10n, 3n)).to.equal(3n); // 10 / 3 = 3.333... => 3
      expect(BI.div(20n, 3n)).to.equal(7n); // 20 / 3 = 6.666... => 7
    });

    it('should throw on division by zero', function() {
      expect(() => BI.div(1n, 0n)).to.throw('Division by zero');
      expect(() => BI.divToFloat(1n, 0)).to.throw('Division by zero');
      expect(() => BI.divToFloat(1n, '0')).to.throw('Division by zero');
      expect(() => BI.divToFloat(1n, '0x0')).to.throw('Division by zero');
      expect(() => BI.divToFloat(1n, '0o0')).to.throw('Division by zero');
    });

    it('should throw on invalid numerator', function() {
      expect(() => BI.divToFloat('', 3n)).to.throw('Invalid numerator');
      expect(() => BI.divToFloat(null, 3n)).to.throw('Invalid numerator');
      expect(() => BI.divToFloat(undefined, 3n)).to.throw('Invalid numerator');
      expect(() => BI.divToFloat('invalid', 3n)).to.throw('Invalid numerator');
    });

    it('should throw on invalid denominator', function() {
      expect(() => BI.divToFloat(1n, '')).to.throw('Invalid denominator');
      expect(() => BI.divToFloat(1n, null)).to.throw('Invalid denominator');
      expect(() => BI.divToFloat(1n, undefined)).to.throw('Invalid denominator');
      expect(() => BI.divToFloat(1n, 'invalid')).to.throw('Invalid denominator');
    });

    it('should maintain large number precision', function() {
      // Note that numerator / denominator with Numbers != result
      // e.g. BigInt(123456789012345678901234567890 / 2) => 61728394506172838938859798528n
      // Thus, this test case tests that div() maintains precision
      const numerator = 123456789012345678901234567890n; // 30 digits
      const denominator = 2n;
      const result = 61728394506172839450617283945n; // 29 digits
      expect(BI.div(numerator, denominator)).to.equal(result);
    });

    it('should maintain large number precision with string inputs', function() {
      // Note that numerator / denominator with Numbers != result
      // e.g. BigInt(123456789012345678901234567890 / 2) => 61728394506172838938859798528n
      // Thus, this test case tests that div() maintains precision
      const numerator = '123456789012345678901234567890'; //
      const denominator = '2';
      const result = 61728394506172839450617283945n; // 29 digits
      expect(BI.div(numerator, denominator)).to.equal(result);
    });
  });

  describe('mul', function() {
    it('should return a bigint', function() {
      expect(BI.mul(2n, 3n)).to.be.a('bigint');
    });

    it('should return the product of two bigints', function() {
      expect(BI.mul(2n, 3n)).to.equal(6n);
    });

    it('should return the product of a bigint and a number', function() {
      expect(BI.mul(2n, 3)).to.equal(6n);
    });

    it('should return the product of a bigint and a numeric string', function() {
      expect(BI.mul(2n, '3')).to.equal(6n);
    });

    it('should throw on invalid inputs', function() {
      expect(() => BI.mul()).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mul(2n, null)).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mul(2n, undefined)).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mul(2n, 'x')).to.throw('Input must contain only BigInt-like values');
    });

    it('should return the rounded product of a bigint and a float', function() {
      expect(BI.mul(2n, 1.4)).to.equal(3n); // 2 * 1.4 = 2.8 => 3
      expect(BI.mul(2n, 1.1)).to.equal(2n); // 2 * 1.1 = 2.2 => 2
      expect(BI.mul(2n, 1.4, 3n)).to.equal(8n); // 2 * 1.4 * 3 = 8.4 => 8
      expect(BI.mul(2n, 1.1, 3n)).to.equal(7n); // 2 * 1.1 * 3 = 6.6 => 7
      expect(BI.mul(2n, 1.223)).to.equal(2n); // 2 * 1.223 = 2.446 => 2 (rounds to first decimal)
      expect(BI.mul(2n, 1.25)).to.equal(3n); // 2 * 1.25 = 2.5 => 3
    });
  });

  describe('mulFloor', function() {
    it('should return a bigint', function() {
      expect(BI.mulFloor(2n, 3n)).to.be.a('bigint');
    });

    it('should return the product of two bigints', function() {
      expect(BI.mulFloor(2n, 3n)).to.equal(6n);
    });

    it('should return the product of a bigint and a number', function() {
      expect(BI.mulFloor(2n, 3)).to.equal(6n);
    });

    it('should return the product of a bigint and a numeric string', function() {
      expect(BI.mulFloor(2n, '3')).to.equal(6n);
    });

    it('should throw on invalid inputs', function() {
      expect(() => BI.mulFloor()).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mulFloor(2n, null)).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mulFloor(2n, undefined)).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mulFloor(2n, 'x')).to.throw('Input must contain only BigInt-like values');
    });

    it('should return the floored product of a bigint and a float', function() {
      expect(BI.mulFloor(2n, 1.4)).to.equal(2n); // 2 * 1.4 = 2.8 => 2
      expect(BI.mulFloor(2n, 1.1)).to.equal(2n); // 2 * 1.1 = 2.2 => 2
      expect(BI.mulFloor(2n, 1.4, 3n)).to.equal(8n); // 2 * 1.4 * 3 = 8.4 => 8
      expect(BI.mulFloor(2n, 1.1, 3n)).to.equal(6n); // 2 * 1.1 * 3 = 6.6 => 6
      expect(BI.mulFloor(2n, 1.223)).to.equal(2n); // 2 * 1.223 = 2.446 => 2
      expect(BI.mulFloor(2n, 1.25)).to.equal(2n); // 2 * 1.25 = 2.5 => 2
    });
  });

  describe('mulCeil', function() {
    it('should return a bigint', function() {
      expect(BI.mulCeil(2n, 3n)).to.be.a('bigint');
    });

    it('should return the product of two bigints', function() {
      expect(BI.mulCeil(2n, 3n)).to.equal(6n);
    });

    it('should return the product of a bigint and a number', function() {
      expect(BI.mulCeil(2n, 3)).to.equal(6n);
    });

    it('should return the product of a bigint and a numeric string', function() {
      expect(BI.mulCeil(2n, '3')).to.equal(6n);
    });

    it('should throw on invalid inputs', function() {
      expect(() => BI.mulCeil()).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mulCeil(2n, null)).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mulCeil(2n, undefined)).to.throw('Input must contain only BigInt-like values');
      expect(() => BI.mulCeil(2n, 'x')).to.throw('Input must contain only BigInt-like values');
    });

    it('should return the ceiling of the product of a bigint and a float', function() {
      expect(BI.mulCeil(2n, 1.4)).to.equal(3n); // 2 * 1.4 = 2.8 => 3
      expect(BI.mulCeil(2n, 1.1)).to.equal(3n); // 2 * 1.1 = 2.2 => 3
      expect(BI.mulCeil(2n, 1.4, 3n)).to.equal(9n); // 2 * 1.4 * 3 = 8.4 => 9
      expect(BI.mulCeil(2n, 1.1, 3n)).to.equal(7n); // 2 * 1.1 * 3 = 6.6 => 7
      expect(BI.mulCeil(2n, 1.223)).to.equal(3n); // 2 * 1.223 = 2.446 => 3
      expect(BI.mulCeil(2n, 1.25)).to.equal(3n); // 2 * 1.25 = 2.5 => 3
    });
  });

  describe('JSONStringifyBigIntReplacer', function() {
    it('should convert bigint values to serializable objects during JSON.stringify', function() {
      const obj = { a: 123n, b: 'test' };
      const jsonString = JSON.stringify(obj, BI.JSONStringifyBigIntReplacer);
      expect(jsonString).to.equal('{"a":{"data":"123","type":"BigInt"},"b":"test"}');
    });
  });

  describe('JSONParseBigIntReviver', function() {
    it('should convert bigint values from serializable objects during JSON.parse', function() {
      const str = '{"a":{"data":"123","type":"BigInt"},"b":"test"}';
      const jsonObject = JSON.parse(str, BI.JSONParseBigIntReviver);
      expect(jsonObject).to.deep.equal({ a: 123n, b: 'test' });
    });
  });

  describe('scrubBigIntsInObject', function() {
    it('should convert all bigint values in an object to number by default', function() {
      const result = BI.scrubBigIntsInObject({ a: 123n, b: { c: 456n, d: 'test' }, e: [789n, 'value'] });
      expect(result).to.deep.equal({ a: 123, b: { c: 456, d: 'test' }, e: [789, 'value'] });
    });

    it('should convert all bigint values in an object to string when destType is "string"', function() {
      const result = BI.scrubBigIntsInObject({ a: 123n, b: { c: 456n, d: 'test' }, e: [789n, 'value'] }, 'string');
      expect(result).to.deep.equal({ a: '123', b: { c: '456', d: 'test' }, e: ['789', 'value'] });
    });

    it('should convert all bigint values in an object to hex string when destType is "hex"', function() {
      const result = BI.scrubBigIntsInObject({ a: 123n, b: { c: 456n, d: 'test' }, e: [789n, 'value'] }, 'hex');
      expect(result).to.deep.equal({ a: '0x7b', b: { c: '0x1c8', d: 'test' }, e: ['0x315', 'value'] });
    });
  });

  describe('isEqual', function() {
    it('should return true for two identical bigints', function() {
      expect(BI.isEqual(123n, 123n)).to.equal(true);
    });

    it('should return true for two identical numbers', function() {
      expect(BI.isEqual(123, 123)).to.equal(true);
    });

    it('should return true for two identical numeric strings', function() {
      expect(BI.isEqual('123', '123')).to.equal(true);
    });

    it('should return true for same value in different formats', function() {
      expect(BI.isEqual(1n, 1)).to.equal(true);
      expect(BI.isEqual(1n, 1.0)).to.equal(true);
      expect(BI.isEqual(1n, '1')).to.equal(true);
      expect(BI.isEqual(1n, '0x1')).to.equal(true);
      expect(BI.isEqual(1n, '1.0')).to.equal(true);
      expect(BI.isEqual(1n, '1e0')).to.equal(true);
      expect(BI.isEqual(1, '1')).to.equal(true);
      expect(BI.isEqual(1, '0x1')).to.equal(true);
      expect(BI.isEqual(1, '1.0')).to.equal(true);
      expect(BI.isEqual(1, '1e0')).to.equal(true);
      expect(BI.isEqual('1', '0x1')).to.equal(true);
      expect(BI.isEqual('1', '1.0')).to.equal(true);
      expect(BI.isEqual('1', '1e0')).to.equal(true);
      expect(BI.isEqual('0x1', '1.0')).to.equal(true);
      expect(BI.isEqual('0x1', '1e0')).to.equal(true);
      expect(BI.isEqual('1.0', '1e0')).to.equal(true);
    });

    it('should handle special numeric values and edge cases', function() {
      expect(BI.isEqual(0n, 0)).to.equal(true);
      expect(BI.isEqual('Infinity', Infinity)).to.equal(true);
      expect(BI.isEqual('-Infinity', -Infinity)).to.equal(true);
      expect(BI.isEqual('NaN', NaN)).to.equal(false);
      expect(BI.isEqual('1.0', 1n)).to.equal(true);
      expect(BI.isEqual('1e0', 1n)).to.equal(true);
      expect(BI.isEqual(123456789012345678901234567890n, '123456789012345678901234567890')).to.equal(true);
      expect(BI.isEqual(123456789012345678901234567890n, '123456789012345678901234567890.0000')).to.equal(true);
      expect(BI.isEqual(123456789012345678901234567890n, '123456789012345678901234567890.0001')).to.equal(false);
    });

    it('should return true for zero in different formats', function() {
      expect(BI.isEqual(0n, 0)).to.equal(true);
      expect(BI.isEqual(0n, '0')).to.equal(true);
      expect(BI.isEqual(0, '0')).to.equal(true);
    });

    it('should return true for large numbers in different formats', function() {
      expect(BI.isEqual(123456789012345678901234567890n, '123456789012345678901234567890')).to.equal(true);
      // eslint-disable-next-line no-loss-of-precision
      expect(BI.isEqual(123456789012345678901234567890, '123456789012345678901234567890')).to.equal(true);
    });

    it('should return false when precision loss is inevitable', function() {
      // eslint-disable-next-line no-loss-of-precision
      expect(BI.isEqual(123456789012345678901234567890n, 123456789012345678901234567890)).to.equal(false);
      // eslint-disable-next-line no-loss-of-precision
      expect(BI.isEqual(123456789012345678901234567890, 123456789012345678901234567890n)).to.equal(false);
    });

    it('should return false for different values', function() {
      expect(BI.isEqual(1n, 2n)).to.equal(false);
      expect(BI.isEqual(1, 2)).to.equal(false);
      expect(BI.isEqual('1', '2')).to.equal(false);
      expect(BI.isEqual(1n, 2)).to.equal(false);
    });

    it('should return false when one value is invalid', function() {
      expect(BI.isEqual(1n, 'invalid')).to.equal(false);
      expect(BI.isEqual('invalid', 1n)).to.equal(false);
      expect(BI.isEqual(1n, null)).to.equal(false);
      expect(BI.isEqual(1n, undefined)).to.equal(false);
      expect(BI.isEqual(1n, '')).to.equal(false);
    });

    it('should return true when both values are invalid but loosely equal', function() {
      expect(BI.isEqual('invalid', 'invalid')).to.equal(true);
      expect(BI.isEqual(null, null)).to.equal(true);
      expect(BI.isEqual(undefined, undefined)).to.equal(true);
      expect(BI.isEqual(null, undefined)).to.equal(true);
      expect(BI.isEqual('', '')).to.equal(true);
    });

    it('should return false when both values are invalid but not loosely equal', function() {
      expect(BI.isEqual('invalid', 'different')).to.equal(false);
      expect(BI.isEqual(null, '')).to.equal(false);
      expect(BI.isEqual(undefined, '')).to.equal(false);
      expect(BI.isEqual('', ' ')).to.equal(false);
    });

    it('should handle negative numbers', function() {
      expect(BI.isEqual(-5n, -5)).to.equal(true);
      expect(BI.isEqual(-5n, '-5')).to.equal(true);
      expect(BI.isEqual(-5, '-5')).to.equal(true);
      expect(BI.isEqual(-5n, 5n)).to.equal(false);
    });
  });

  describe('BigIntTry', function() {
    it('should convert a number to bigint', function() {
      const result = BI.BigIntTry(123);
      expect(result).to.equal(123n);
      expect(typeof result).to.equal('bigint');
    });

    it('should convert a numeric string to bigint', function() {
      const result = BI.BigIntTry('123');
      expect(result).to.equal(123n);
      expect(typeof result).to.equal('bigint');
    });

    it('should convert a bigint to bigint', function() {
      const result = BI.BigIntTry(123n);
      expect(result).to.equal(123n);
      expect(typeof result).to.equal('bigint');
    });

    it('should convert a hex string to bigint', function() {
      const result = BI.BigIntTry('0x123');
      expect(result).to.equal(0x123n);
      expect(typeof result).to.equal('bigint');
    });

    it('should handle zero', function() {
      expect(BI.BigIntTry(0)).to.equal(0n);
      expect(BI.BigIntTry('0')).to.equal(0n);
      expect(BI.BigIntTry('0x0')).to.equal(0n);
    });

    it('should handle negative numbers', function() {
      expect(BI.BigIntTry(-5)).to.equal(-5n);
      expect(BI.BigIntTry('-5')).to.equal(-5n);
    });

    it('should return original value for empty string', function() {
      const result = BI.BigIntTry('');
      expect(result).to.equal('');
      expect(typeof result).to.equal('string');
    });

    it('should return original value for non-numeric string', function() {
      const result = BI.BigIntTry('invalid');
      expect(result).to.equal('invalid');
      expect(typeof result).to.equal('string');
    });

    it('should return original value for null', function() {
      const result = BI.BigIntTry(null);
      expect(result).to.equal(null);
      expect(typeof result).to.equal('object');
    });

    it('should return original value for undefined', function() {
      const result = BI.BigIntTry(undefined);
      expect(result).to.equal(undefined);
      expect(typeof result).to.equal('undefined');
    });

    it('should return original value for object', function() {
      const obj = { a: 1 };
      const result = BI.BigIntTry(obj);
      expect(result).to.equal(obj);
      expect(typeof result).to.equal('object');
    });

    it('should return original value for array', function() {
      const arr = [1, 2, 3];
      const result = BI.BigIntTry(arr);
      expect(result).to.equal(arr);
      expect(Array.isArray(result)).to.equal(true);
    });

    it('should return original value for NaN', function() {
      const result = BI.BigIntTry(NaN);
      expect(Number.isNaN(result)).to.equal(true);
      expect(typeof result).to.equal('number');
    });

    it('should handle large numbers', function() {
      const largeNum = '123456789012345678901234567890';
      const result = BI.BigIntTry(largeNum);
      expect(result).to.equal(123456789012345678901234567890n);
      expect(typeof result).to.equal('bigint');
    });

    it('should return bigint value for boolean', function() {
      expect(BI.BigIntTry(true)).to.equal(1n);
      expect(BI.BigIntTry(false)).to.equal(0n);
    });
  });
});
