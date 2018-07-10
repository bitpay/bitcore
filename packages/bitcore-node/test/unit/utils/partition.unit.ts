import { describe } from 'mocha';
import { expect } from 'chai';
import { partition } from '../../../src/utils/partition';

describe('Partition', () => {
  it('should split an array of 5 to 5 arrays', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 5);
    expect(partitioned).to.deep.equal([[1, 2, 3, 4, 5]]);
  });

  it('should handle 0', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 0);
    expect(partitioned).to.deep.equal([[1], [2], [3], [4], [5]]);
  });

  it('should handle one', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 1);
    expect(partitioned).to.deep.equal([[1], [2], [3], [4], [5]]);
  });

  it('should handle two', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 2);
    expect(partitioned).to.deep.equal([[1, 2], [3, 4], [5]]);
  });

  it('should handle between one and zero', () => {
    let testArr = [1, 2, 3, 4, 5];
    let partitioned = partition(testArr, 0.15);
    expect(partitioned).to.deep.equal([[1], [2], [3], [4], [5]]);
  });
});
