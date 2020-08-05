export class StatsUtil {
  /**
   * @param {Array<T>} array - A sorted array of values to be used for quartiles
   * @param {number} n - which quartile do you want the median from
   * @returns {T} - The median of nth quartile
   */
  static getNthQuartileMedian<T>(array: Array<T>, n: number): T {
    if (n < 1 || n > 4) {
      throw new Error('second parameter must be between 1 and 4');
    }
    const quartileLength = Math.floor(array.length / 4);
    const quartileStartPoint = (n - 1) * quartileLength;
    const quartileMidpoint = quartileStartPoint + Math.floor(quartileLength / 2);
    const quartileMedian = array[quartileMidpoint];
    return quartileMedian;
  }
}
