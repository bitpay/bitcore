import { describe, it } from 'node:test';
import assert from 'assert';
import * as utils from '../../../src/utils';

describe('Utils', function() {
  describe('range', function() {
    it('should return an array of ascending numbers if start < end', function() {
      const result = utils.range(23, 35);
      assert.deepStrictEqual(result, [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]);
    });

    it('should return an array of descending numbers if start > end', function() {
      const result = utils.range(7, 1);
      assert.deepStrictEqual(result, [7, 6, 5, 4, 3, 2]);
    });

    it('should handle negative start', function() {
      const result = utils.range(-5, 3);
      assert.deepStrictEqual(result, [-5, -4, -3, -2, -1, 0, 1, 2]);
    });

    it('should handle negative end', function() {
      const result = utils.range(0, -6);
      assert.deepStrictEqual(result, [0, -1, -2, -3, -4, -5]);
    });

    it('should handle negative start and end', function() {
      const result = utils.range(-5, -10);
      assert.deepStrictEqual(result, [-5, -6, -7, -8, -9]);
    });

    it('should handle negative params with start < end', function() {
      const result = utils.range(-5, -1);
      assert.deepStrictEqual(result, [-5, -4, -3, -2]);
    });

    it('should handle negative params with start > end', function() {
      const result = utils.range(-1, -5);
      assert.deepStrictEqual(result, [-1, -2, -3, -4]);
    });

    it('should handle optional end param', function() {
      const result = utils.range(5);
      assert.deepStrictEqual(result, [0, 1, 2, 3, 4]);
    });

    it('should handle optional end param with negative start', function() {
      const result = utils.range(-5);
      assert.deepStrictEqual(result, [0, -1, -2, -3, -4]);
    });

    it('should return an empty array if start equals end', function() {
      const result = utils.range(5, 5);
      assert.deepStrictEqual(result, []);
    });

    it('should return an empty array if no params given', function() {
      const result = (utils.range as any)();
      assert.deepStrictEqual(result, []);
    });
  });
});