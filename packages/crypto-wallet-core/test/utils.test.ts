import { expect } from 'chai';
import * as utils from '../src/utils';

describe('Utils', function() {
  describe('isHexString', function() {
    it('should return true for valid prefixed hex string', function() {
      const str = '0xabcdef123456';
      const result = utils.isHexString(str);
      expect(result).to.be.true;
    });

    it('should return true for valid non-prefixed hex string', function() {
      const str = 'abcdef123456';
      const result = utils.isHexString(str);
      expect(result).to.be.true;
    });

    it('should return false for invalid prefixed hex string', function() {
      const str = '0xabc123g';
      const result = utils.isHexString(str);
      expect(result).to.be.false;
    });

    it('should return false for string with 0x somewhere in the middle', function() {
      const str = 'abc0x123';
      const result = utils.isHexString(str);
      expect(result).to.be.false;
    });

    it('should return false for invalid non-prefixed hex string', function() {
      const str = 'abc123g';
      const result = utils.isHexString(str);
      expect(result).to.be.false;
    });

    it('should return false for empty string', function() {
      const str = '';
      const result = utils.isHexString(str);
      expect(result).to.be.false;
    });

    it('should return false for null/undefined input', function() {
      expect(utils.isHexString(null)).to.be.false;
      expect(utils.isHexString(undefined as any)).to.be.false;
    });

    it('should return false for non-string input', function() {
      expect(utils.isHexString(123 as any)).to.be.false;
      expect(utils.isHexString({} as any)).to.be.false;
    });

    it('should return false for octal string', function() {
      const str = '0o01234567';
      const result = utils.isHexString(str);
      expect(result).to.be.false;
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
});