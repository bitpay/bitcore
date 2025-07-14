import { ObjectID } from 'mongodb';
import * as utils from '../../../src/utils';
import { expect } from 'chai';

describe('Utils', function() {
  describe('range', function() {
    it('should return an array of ascending numbers if start < end', function() {
      const result = utils.range(23, 35);
      expect(result).to.deep.equal([23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]);
    });

    it('should return an array of descending numbers if start > end', function() {
      const result = utils.range(7, 1);
      expect(result).to.deep.equal([7, 6, 5, 4, 3, 2]);
    });

    it('should handle negative start', function() {
      const result = utils.range(-5, 3);
      expect(result).to.deep.equal([-5, -4, -3, -2, -1, 0, 1, 2]);
    });

    it('should handle negative end', function() {
      const result = utils.range(0, -6);
      expect(result).to.deep.equal([0, -1, -2, -3, -4, -5]);
    });

    it('should handle negative start and end', function() {
      const result = utils.range(-5, -10);
      expect(result).to.deep.equal([-5, -6, -7, -8, -9]);
    });

    it('should handle negative params with start < end', function() {
      const result = utils.range(-5, -1);
      expect(result).to.deep.equal([-5, -4, -3, -2]);
    });

    it('should handle negative params with start > end', function() {
      const result = utils.range(-1, -5);
      expect(result).to.deep.equal([-1, -2, -3, -4]);
    });

    it('should handle optional end param', function() {
      const result = utils.range(5);
      expect(result).to.deep.equal([0, 1, 2, 3, 4]);
    });

    it('should handle optional end param with negative start', function() {
      const result = utils.range(-5);
      expect(result).to.deep.equal([0, -1, -2, -3, -4]);
    });

    it('should return an empty array if start equals end', function() {
      const result = utils.range(5, 5);
      expect(result).to.deep.equal([]);
    });

    it('should return an empty array if no params given', function() {
      const result = (utils.range as any)();
      expect(result).to.deep.equal([]);
    });
  });
  describe('uniqBy', function() {
    it('should remove the redundant mongo object pairs without messing with order', function() {
      const objectIds = [
        new ObjectID('56d6a232ead1dc6e4f565e78'),
        // redundant pair
        new ObjectID('65e7573610d3fa8bc4930869'),
        new ObjectID('65e7573610d3fa8bc4930869'),

        new ObjectID('6f0d45b6dfeafa40f958afbf'),

        // redundant pair
        new ObjectID('e3b4cff2794d399d10f0a683'),
        new ObjectID('e3b4cff2794d399d10f0a683'), 

        new ObjectID('d6faff1f3d1ea0cd1ed847a3')
      ];
      const result = utils.uniqBy(objectIds, id => id.toHexString());
      const expectedResult = [
        new ObjectID('56d6a232ead1dc6e4f565e78'),
        new ObjectID('65e7573610d3fa8bc4930869'),
        new ObjectID('6f0d45b6dfeafa40f958afbf'),
        new ObjectID('e3b4cff2794d399d10f0a683'), 
        new ObjectID('d6faff1f3d1ea0cd1ed847a3')
      ];
      expect(result).deep.equal(expectedResult);
    });

    it('should remove all but one mongo object if all are redundant', function() {
      const objectIds = [
        // all redundant
        new ObjectID('56d6a232ead1dc6e4f565e78'),
        new ObjectID('56d6a232ead1dc6e4f565e78'),
        new ObjectID('56d6a232ead1dc6e4f565e78'),
        new ObjectID('56d6a232ead1dc6e4f565e78'),
        new ObjectID('56d6a232ead1dc6e4f565e78')
      ];
      const result = utils.uniqBy(objectIds, id => id.toHexString());
      const expectedResult = [
        new ObjectID('56d6a232ead1dc6e4f565e78')
      ];
      expect(result).deep.equal(expectedResult);
    });

    it('should remove objects with redundant names and not redundant values', function() {
      const array = [
        {
          name: 'a',
          value: 10
        },
        {
          name: 'b',
          value: 3.1
        },
        {
          name: 'a',
          value: 2.7
        },
        {
          name: 'c',
          value: 10
        },
        {
          name: 'b',
          value: 6
        }
      ];

      const result = utils.uniqBy(array, item => item.name);
      const expectedResult = [
        {
          name: 'a',
          value: 10
        },
        {
          name: 'b',
          value: 3.1
        },
        {
          name: 'c',
          value: 10
        },
      ];
      expect(result).deep.equal(expectedResult);
    });
    it('should handle null, undefined, and NaN', function() {
      const array = [
        {
          name: null,
          value: 10
        },
        {
          name: undefined,
          value: 3.1
        },
        {
          name: null,
          value: 2.7
        },
        {
          name: 'c',
          value: 10
        },
        {
          name: NaN,
          value: 10
        },
        {
          name: NaN,
          value: 101
        },
        {
          name: undefined,
          value: 6
        }
      ];

      const result = utils.uniqBy(array, item => item.name);
      const expectedResult = [
        {
          name: null,
          value: 10
        },
        {
          name: undefined,
          value: 3.1
        },
        {
          name: 'c',
          value: 10
        },
        {
          name: NaN,
          value: 10
        },
      ];

      expect(result).deep.equal(expectedResult);
    });
    it('should work using property string', function() {
      const array = [
        {
          name: 'a',
          value: 10
        },
        {
          name: 'b',
          value: 3.1
        },
        {
          name: 'a',
          value: 2.7
        },
        {
          name: 'c',
          value: 10
        },
        {
          name: 'b',
          value: 6
        }
      ];

      const result = utils.uniqBy(array, 'name');
      const expectedResult = [
        {
          name: 'a',
          value: 10
        },
        {
          name: 'b',
          value: 3.1
        },
        {
          name: 'c',
          value: 10
        },
      ];
      expect(result).deep.equal(expectedResult);
    });
  });
  describe('uniq', function() {
    it('should remove redundant values in numbers array', function() {
      const array = [3, 1, 4, 1, 5];
      const result = utils.uniq(array);
      const expectedResult = [3, 1, 4, 5];
      expect(result).deep.equal(expectedResult);
    });

    it('should handle first and last element redundancy', function() {
      const array = [1, 2, 3, 1];
      const result = utils.uniq(array);
      const expectedResult = [1, 2, 3];
      expect(result).deep.equal(expectedResult);
    });

    it('should handle null, undefined, NaN, objects and strings', function() {
      const array = 
      [NaN, NaN, new ObjectID('6f0d45b6dfeafa40f958afbf'), undefined, 
       'bitcoin', null, 'bitcoin', undefined, 'txs', null];
      const result = utils.uniq(array);
      const expectedResult = 
          [NaN, new ObjectID('6f0d45b6dfeafa40f958afbf'), undefined, 'bitcoin', null, 'txs'];
      expect(result).deep.equal(expectedResult);
    });
  });
});