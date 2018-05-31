/**
 * Implements a simple "LRU" Cache with a ring buffer.
 * The last used value is evicted, and up to `capacity` values are stored.
 */
export class Cache {
  private cache: any[];
  private idx: number;
  private memo: Set<any>;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error(`Capacity must be at least one, got ${capacity}.`);
    }
    this.cache = new Array(capacity).fill(undefined);
    this.idx = 0;
    this.memo = new Set();
  }

  /** Insert a value into the cache.
   * @return `true` if it was already in the cache, `false` otherwise.
   */
  use(v: any): boolean {
    if (this.memo.has(v)) {
      return true;
    }
    this.memo.delete(this.cache[this.idx]);
    this.cache[this.idx] = v;
    this.memo.add(v);
    this.idx = (this.idx + 1) % this.cache.length;
    return false;
  }

  /** Check if value is in the cache without marking it used.
   * @return `true` if it was cached, `false` otherwise.
   */
  peek(v: any): boolean {
    return this.memo.has(v);
  }
}
