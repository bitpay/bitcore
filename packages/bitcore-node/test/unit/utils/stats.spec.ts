import { describe, before, after, it } from 'node:test';
import assert from 'assert';
import { StatsUtil } from '../../../src/utils/stats';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Stats Util', () => {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  describe('Quartiles of 20', () => {
    const values = new Array(20).fill(0).map((_, i) => i);
    it('should give back the midpoint between 0 and 5', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 1);
      assert.strictEqual(firstQuartileMidPoint, 2);
    });

    it('should give back the midpoint between 5 and 10', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 2);
      assert.strictEqual(firstQuartileMidPoint, 7);
    });

    it('should give back the midpoint between 10 and 15', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 3);
      assert.strictEqual(firstQuartileMidPoint, 12);
    });

    it('should give back the midpoint between 15 and 20', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 4);
      assert.strictEqual(firstQuartileMidPoint, 17);
    });
  });

  describe('Quartiles of 4', () => {
    const values = new Array(4).fill(0).map((_, i) => i);
    it('should give back the midpoint between 0 and 1', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 1);
      assert.strictEqual(firstQuartileMidPoint, 0);
    });

    it('should give back the midpoint between 1 and 2', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 2);
      assert.strictEqual(firstQuartileMidPoint, 1);
    });

    it('should give back the midpoint between 2 and 3', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 3);
      assert.strictEqual(firstQuartileMidPoint, 2);
    });

    it('should give back the midpoint between 3 and 4', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 4);
      assert.strictEqual(firstQuartileMidPoint, 3);
    });
  });

  describe('Quartiles of 1', () => {
    const values = new Array(1).fill(0).map((_, i) => i);
    it('should give back the midpoint between 0 and 0', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 1);
      assert.strictEqual(firstQuartileMidPoint, 0);
    });

    it('should give back the midpoint between 0 and 0', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 2);
      assert.strictEqual(firstQuartileMidPoint, 0);
    });

    it('should give back the midpoint between 0 and 0', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 3);
      assert.strictEqual(firstQuartileMidPoint, 0);
    });

    it('should give back the midpoint between 0 and 0', () => {
      const firstQuartileMidPoint = StatsUtil.getNthQuartileMedian(values, 4);
      assert.strictEqual(firstQuartileMidPoint, 0);
    });
  });
});
