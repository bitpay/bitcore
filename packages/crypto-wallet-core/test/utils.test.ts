import { expect } from 'chai';
import * as xrpl from 'xrpl';
import * as utils from '../src/utils';

describe('Utils', function() {
  describe('isHexString', function() {
    it('should return true for valid prefixed hex string', function() {
      const str = '0xabcdef123456';
      const result = utils.isHexString(str);
      expect(result).to.equal(true);
    });

    it('should return true for valid non-prefixed hex string', function() {
      const str = 'abcdef123456';
      const result = utils.isHexString(str);
      expect(result).to.equal(true);
    });

    it('should return true for valid odd-length hex string', function() {
      const str = 'abcdef12345';
      const result = utils.isHexString(str);
      expect(result).to.be.true;
    });

    it('should return false for invalid prefixed hex string', function() {
      const str = '0xabc123g';
      const result = utils.isHexString(str);
      expect(result).to.equal(false);
    });

    it('should return false for string with 0x somewhere in the middle', function() {
      const str = 'abc0x123';
      const result = utils.isHexString(str);
      expect(result).to.equal(false);
    });

    it('should return false for invalid non-prefixed hex string', function() {
      const str = 'abc123g';
      const result = utils.isHexString(str);
      expect(result).to.equal(false);
    });

    it('should return false for empty string', function() {
      const str = '';
      const result = utils.isHexString(str);
      expect(result).to.equal(false);
    });

    it('should return false for null/undefined input', function() {
      expect(utils.isHexString(null)).to.equal(false);
      expect(utils.isHexString(undefined as any)).to.equal(false);
    });

    it('should return false for non-string input', function() {
      expect(utils.isHexString(123 as any)).to.equal(false);
      expect(utils.isHexString({} as any)).to.equal(false);
    });

    it('should return false for octal string', function() {
      const str = '0o01234567';
      const result = utils.isHexString(str);
      expect(result).to.equal(false);
    });
  });

  describe('toHex', function() {
    it('should convert number to hex string', function() {
      const input = 255;
      const result = utils.toHex(input);
      expect(result).to.equal('0xff');
    });
    
    it('should convert bigint to hex string', function() {
      const input = BigInt('12345678901234567890');
      const result = utils.toHex(input);
      expect(result).to.equal('0xab54a98ceb1f0ad2');
    });

    it('should convert number string to hex string', function() {
      const input = '4095';
      const result = utils.toHex(input);
      expect(result).to.equal('0xfff');
    });

    it('should convert prefixed hex string to hex string', function() {
      const input = '0xabcdef';
      const result = utils.toHex(input);
      expect(result).to.equal('0xabcdef');
    });

    it('should convert non-prefixed hex string to hex string', function() {
      const input = 'abcdef';
      const result = utils.toHex(input);
      expect(result).to.equal('0xabcdef');
    });

    it('should convert octal string to hex string', function() {
      const input = '0o17';
      const result = utils.toHex(input);
      expect(result).to.equal('0xf');
    });

    it('should throw error for invalid string input', function() {
      const input = 'notanumber';
      expect(() => utils.toHex(input)).to.throw('Invalid input for toHex: notanumber');
    });

    it('should throw error for unsupported input type', function() {
      const input = { key: 'value' };
      expect(() => utils.toHex(input as any)).to.throw('Input for toHex must be a number, string (non-empty), or bigint. Got typeof object');
    });

    it('should throw error for empty string input', function() {
      const input = '';
      expect(() => utils.toHex(input)).to.throw('Input for toHex must be a number, string (non-empty), or bigint. Got ""');
    });

    it('should throw error for null/undefined input', function() {
      expect(() => utils.toHex(null as any)).to.throw('Input for toHex must be a number, string (non-empty), or bigint. Got null');
      expect(() => utils.toHex(undefined as any)).to.throw('Input for toHex must be a number, string (non-empty), or bigint. Got undefined');
    });

    it('should throw error for NaN input', function() {
      const input = NaN;
      expect(() => utils.toHex(input)).to.throw('Invalid input for toHex: NaN');
    });
  });

  describe('difference', function() {
    it('should return items from first array that are not in second array', function() {
      const arr1 = [1, 2, 3, 4];
      const arr2 = [2, 4, 6];
      const result = utils.difference(arr1, arr2);
      expect(result).to.deep.equal([1, 3]);
    });

    it('should consider different pointer references as a difference', function() {
      const arr1 = [1, 2, 3, {}];
      const arr2 = [1, 2, 3, {}];
      const result = utils.difference(arr1, arr2);
      expect(result).to.deep.equal([{}]);
    });

    it('should consider same pointer references as no difference', function() {
      const obj = {};
      const arr1 = [1, 2, 3, obj];
      const arr2 = [1, 2, 3, obj];
      const result = utils.difference(arr1, arr2);
      expect(result).to.deep.equal([]);
    });

    it('should remove all matching duplicates from first array', function() {
      const arr1 = ['a', 'b', 'b', 'c'];
      const arr2 = ['b'];
      const result = utils.difference(arr1, arr2);
      expect(result).to.deep.equal(['a', 'c']);
    });

    it('should return empty array when first array is null/undefined', function() {
      expect(utils.difference(null as any, [1, 2])).to.deep.equal([]);
      expect(utils.difference(undefined as any, [1, 2])).to.deep.equal([]);
    });

    it('should return first array unchanged when second array is null/undefined', function() {
      expect(utils.difference([1, 2, 3], null as any)).to.deep.equal([1, 2, 3]);
      expect(utils.difference([1, 2, 3], undefined as any)).to.deep.equal([1, 2, 3]);
    });

    it('should not mutate input arrays', function() {
      const arr1 = [1, 2, 3];
      const arr2 = [2];
      const arr1Copy = [...arr1];
      const arr2Copy = [...arr2];

      utils.difference(arr1, arr2);

      expect(arr1).to.deep.equal(arr1Copy);
      expect(arr2).to.deep.equal(arr2Copy);
    });
  });

  describe('isEqual', function() {
    it('should return true for the same object reference', function() {
      const obj = { a: 1, b: { c: 2 } };
      expect(utils.isEqual(obj, obj)).to.equal(true);
    });

    it('should return false when one object is null', function() {
      expect(utils.isEqual(null as any, { a: 1 })).to.equal(false);
      expect(utils.isEqual({ a: 1 }, null as any)).to.equal(false);
    });

    it('should return false for different primitive values', function() {
      const obj1 = { a: 1, b: 'hello' };
      const obj2 = { a: 2, b: 'hello' };
      expect(utils.isEqual(obj1, obj2)).to.equal(false);
    });

    it('should return false when one object has additional keys', function() {
      const obj1 = { a: 1 };
      const obj2 = { a: 1, b: 2 };
      expect(utils.isEqual(obj1, obj2)).to.equal(false);
      expect(utils.isEqual(obj2, obj1)).to.equal(false);
    });

    it('should return false for different nested object values', function() {
      const obj1 = { a: { b: 1 } };
      const obj2 = { a: { b: 2 } };
      expect(utils.isEqual(obj1, obj2)).to.equal(false);
    });

    it('should handle implicit vs explicit undefined values', function() {
      const obj1 = {}; // obj1.a is implicitly undefined
      const obj2 = { a: undefined }; // obj2.a is explicitly undefined
      expect(utils.isEqual(obj1, obj2)).to.equal(false);
      expect(utils.isEqual(obj2, obj1)).to.equal(false);

      const obj3 = { a: undefined };
      expect(utils.isEqual(obj2, obj3)).to.equal(true);
    });

    it('should handle null vs undefined values correctly', function() {
      const obj1 = { a: null };
      const obj2 = { a: undefined };
      expect(utils.isEqual(obj1, obj2)).to.equal(false);
    });

    it('should prevent infinite recursion on circular references', function() {
      const obj1: any = { a: 1 };
      obj1.self = obj1;

      const obj2: any = { a: 1 };
      obj2.self = obj2;

      expect(utils.isEqual(obj1, obj2)).to.equal(true);

      obj2.extra = 'value';
      expect(utils.isEqual(obj1, obj2)).to.equal(false);
    });

    it('should handle large complex objects (stress test)', function() {
      const buildLargeObject = () => {
        const root: any = {
          meta: {
            chain: 'eth',
            network: 'mainnet',
            createdAt: '2026-05-06T00:00:00.000Z'
          },
          buckets: [],
          matrix: [],
          lookup: {}
        };

        for (let i = 0; i < 120; i++) {
          const bucket = {
            id: i,
            name: `bucket-${i}`,
            flags: {
              active: i % 2 === 0,
              archived: i % 5 === 0
            },
            balances: [],
            tokens: []
          } as any;

          for (let j = 0; j < 20; j++) {
            bucket.balances.push({
              height: j,
              satoshis: i * 100000 + j,
              confirmations: (i + j) % 18
            });
            bucket.tokens.push({
              symbol: `T${j}`,
              amount: `${i * j}`,
              decimals: 18,
              tags: [`g${i % 4}`, `t${j % 7}`]
            });
          }

          root.buckets.push(bucket);
          root.lookup[`k-${i}`] = {
            index: i,
            ref: `bucket-${i}`,
            checksums: [i * 3, i * 7, i * 11]
          };
        }

        for (let r = 0; r < 40; r++) {
          const row: number[] = [];
          for (let c = 0; c < 40; c++) {
            row.push(r * 40 + c);
          }
          root.matrix.push(row);
        }

        return root;
      };

      const left = buildLargeObject();
      const right = buildLargeObject();

      expect(utils.isEqual(left, right)).to.equal(true);

      right.buckets[119].tokens[19].tags[1] = 'mutated-tag';
      expect(utils.isEqual(left, right)).to.equal(false);
    });
  });

  describe('normalizeXrpFlag', function() {
    it('should return the same flag name when passed a valid AccountSetTfFlags string', function() {
      const result = utils.normalizeXrpFlag('tfRequireDestTag');
      expect(result).to.equal('tfRequireDestTag');
    });

    it('should return the same flag name when passed a valid PaymentFlags string', function() {
      const result = utils.normalizeXrpFlag('tfPartialPayment', xrpl.PaymentFlags);
      expect(result).to.equal('tfPartialPayment');
    });

    it('should convert numeric AccountSetTfFlags value to flag name', function() {
      // 65536 maps to 'tfRequireDestTag' in xrpl.AccountSetTfFlags
      const result = utils.normalizeXrpFlag(65536);
      expect(result).to.equal('tfRequireDestTag');
      expect(result).to.be.a('string');
    });

    it('should convert numeric PaymentFlags value to flag name', function() {
      // 131072 maps to 'tfPartialPayment' in xrpl.PaymentFlags
      const result = utils.normalizeXrpFlag(131072, xrpl.PaymentFlags);
      expect(result).to.equal('tfPartialPayment');
      expect(result).to.be.a('string');
    });

    it('should throw error for invalid string flag', function() {
      expect(() => utils.normalizeXrpFlag('invalidFlag')).to.throw(Error).with.property('message', 'Invalid XRP flag: invalidFlag. Flag is not in enum AccountSetTfFlags');
    });

    it('should throw error for numeric string that is not a valid flag', function() {
      expect(() => utils.normalizeXrpFlag('999')).to.throw(Error).with.property('message', 'Invalid XRP flag: 999. Flag is not in enum AccountSetTfFlags');
    });

    it('should throw error for invalid numeric flag', function() {
      expect(() => utils.normalizeXrpFlag(99999)).to.throw(Error).with.property('message', 'Invalid XRP flag: 99999. Flag is not in enum AccountSetTfFlags');
    });

    it('should be case-sensitive for string flags', function() {
      expect(() => utils.normalizeXrpFlag('tfrequiredestag')).to.throw(Error).with.property('message', 'Invalid XRP flag: tfrequiredestag. Flag is not in enum AccountSetTfFlags');
    });

    it('should handle negative numbers', function() {
      expect(() => utils.normalizeXrpFlag(-1)).to.throw(Error).with.property('message', 'Invalid XRP flag: -1. Flag is not in enum AccountSetTfFlags');
    });

    it('should handle zero as input', function() {
      expect(() => utils.normalizeXrpFlag(0)).to.throw(Error).with.property('message', 'Invalid XRP flag: 0. Flag is not in enum AccountSetTfFlags');
    });

    it('should throw if flag enum provided does not contain the flag', function() {
      expect(() => utils.normalizeXrpFlag('tfRequireDestTag', xrpl.PaymentFlags)).to.throw(Error).with.property('message', 'Invalid XRP flag: tfRequireDestTag. Flag is not in enum PaymentFlags');
      enum MyCustomFlags {
        CustomFlag1 = 1,
        CustomFlag2 = 2
      };
      expect(() => utils.normalizeXrpFlag('tfRequireDestTag', MyCustomFlags as any)).to.throw(Error).with.property('message', 'Invalid XRP flag: tfRequireDestTag. Flag is not in enum <unknown>');
    });

    it('should accept numeric string input that maps to a valid AccountSetTfFlags', function() {
      // '65536' should map to 'tfRequireDestTag'
      const result = utils.normalizeXrpFlag('65536');
      expect(result).to.equal('tfRequireDestTag');
    });

    it('should accept numeric string input that maps to PaymentFlags', function() {
      // '131072' should map to 'tfPartialPayment'
      const result = utils.normalizeXrpFlag('131072', xrpl.PaymentFlags);
      expect(result).to.equal('tfPartialPayment');
    });

    it('should handle multiple AccountSetTfFlags values', function() {
      // Test another flag: 262144 maps to 'tfRequireAuth'
      const result = utils.normalizeXrpFlag(262144);
      expect(result).to.equal('tfRequireAuth');
    });

    it('should handle multiple PaymentFlags values', function() {
      // Test another flag: 262144 maps to 'tfLimitQuality'
      const result = utils.normalizeXrpFlag(262144, xrpl.PaymentFlags);
      expect(result).to.equal('tfLimitQuality');
    });

    it('should normalize a flag with a custom enum', function() {
      enum CustomFlags {
        CustomFlag1 = 1,
        CustomFlag2 = 2,
        CustomFlagX = 123
      };
      const result = utils.normalizeXrpFlag(123, CustomFlags as any);
      expect(result).to.equal('CustomFlagX');
    });

    it('should throw when a valid PaymentFlags string is passed without the enum', function() {                                                                                
      // tfPartialPayment is valid for PaymentFlags, but without the enum the function                                                                                         
      // falls back to AccountSetTfFlags, so this should throw                                                                                                                 
      expect(() => utils.normalizeXrpFlag('tfPartialPayment')).to.throw(Error).with.property('message', 'Invalid XRP flag: tfPartialPayment. Flag is not in enum AccountSetTfFlags');                                                                 
    });
  });
});