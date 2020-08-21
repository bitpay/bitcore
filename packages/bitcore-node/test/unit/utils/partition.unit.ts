import { expect } from 'chai';
import { describe } from 'mocha';
import { partition } from '../../../src/utils/partition';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Partition', () => {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should split an array of 5 to 5 arrays', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 5);
    expect(partitioned).to.deep.equal([[1, 2, 3, 4, 5]]);
    expect(testArr).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('should handle 0', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 0);
    expect(partitioned).to.deep.equal([[1], [2], [3], [4], [5]]);
    expect(testArr).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('should handle one', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 1);
    expect(partitioned).to.deep.equal([[1], [2], [3], [4], [5]]);
    expect(testArr).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('should handle two', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 2);
    expect(partitioned).to.deep.equal([[1, 2], [3, 4], [5]]);
    expect(testArr).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('should handle between one and zero', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 0.15);
    expect(partitioned).to.deep.equal([[1], [2], [3], [4], [5]]);
    expect(testArr).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('should handle different sizes of arrays', () => {
    for (let i = 0; i < 1000; i++) {
      const randomLen = Math.floor(Math.random() * 100) + 1;
      let adjustment = 0;
      let randomArr = new Array(randomLen).fill(1).map(num => num + adjustment++);
      let partitioned = partition(randomArr, 3);
      const amountInBatches = partitioned.reduce((sum, arr) => sum + arr.length, 0);
      expect(amountInBatches).to.equal(randomLen);
      expect(partitioned.length).to.be.gte(Math.floor(randomLen / 3));
      let lastBatch = partitioned[partitioned.length - 1];
      if (!lastBatch) {
        console.error('Array partition fails with length', randomLen);
      }
      expect(randomArr.length).to.deep.equal(randomLen);
    }
  });
});
