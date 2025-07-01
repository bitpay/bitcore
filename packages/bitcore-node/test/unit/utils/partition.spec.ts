import { describe, before, after, it } from 'node:test';
import assert from 'assert';
import { partition } from '../../../src/utils';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Partition', () => {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should split an array of 5 to 5 arrays', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 5);
    assert.deepStrictEqual(partitioned, [[1, 2, 3, 4, 5]]);
    assert.deepStrictEqual(testArr, [1, 2, 3, 4, 5]);
  });

  it('should handle 0', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 0);
    assert.deepStrictEqual(partitioned, [[1], [2], [3], [4], [5]]);
    assert.deepStrictEqual(testArr, [1, 2, 3, 4, 5]);
  });

  it('should handle one', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 1);
    assert.deepStrictEqual(partitioned, [[1], [2], [3], [4], [5]]);
    assert.deepStrictEqual(testArr, [1, 2, 3, 4, 5]);
  });

  it('should handle two', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 2);
    assert.deepStrictEqual(partitioned, [[1, 2], [3, 4], [5]]);
    assert.deepStrictEqual(testArr, [1, 2, 3, 4, 5]);
  });

  it('should handle between one and zero', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 0.15);
    assert.deepStrictEqual(partitioned, [[1], [2], [3], [4], [5]]);
    assert.deepStrictEqual(testArr, [1, 2, 3, 4, 5]);
  });

  it('should handle different sizes of arrays', () => {
    for (let i = 0; i < 1000; i++) {
      const randomLen = Math.floor(Math.random() * 100) + 1;
      let adjustment = 0;
      let randomArr = new Array(randomLen).fill(1).map(num => num + adjustment++);
      let partitioned = partition(randomArr, 3);
      const amountInBatches = partitioned.reduce((sum, arr) => sum + arr.length, 0);
      assert.strictEqual(amountInBatches, randomLen);
      assert.ok(partitioned.length >= Math.floor(randomLen / 3));
      let lastBatch = partitioned[partitioned.length - 1];
      if (!lastBatch) {
        console.error('Array partition fails with length', randomLen);
      }
      assert.strictEqual(randomArr.length, randomLen);
    }
  });
});
