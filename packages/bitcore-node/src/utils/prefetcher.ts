export class Prefetcher<I, O> {
  prefetched = {};
  batchIterator: Iterator<void> | null = null;
  lastPrefetch = '';

  constructor(private args: Array<I>, private count: number, private applyFn: (arg: I) => O, bind?: any) {
    if (bind) {
      this.applyFn = this.applyFn.bind(bind);
    }
    this.batchIterator = this.prefetch();
    if (this.batchIterator) {
      this.batchIterator.next();
    }
  }

  private *prefetch() {
    if (!this.args.length) {
      return;
    }
    let prefetchTilIndex = this.count - 1;
    let index = 0;
    let lastIndex = prefetchTilIndex < this.args.length ? prefetchTilIndex : this.args.length - 1;
    let lastBatchHeader = this.args[lastIndex];
    this.lastPrefetch = lastBatchHeader.toString();
    for (const arg of this.args) {
      const cacheKey = arg.toString();
      this.prefetched[cacheKey] = this.applyFn(arg);
      this.lastPrefetch = cacheKey;
      if (index == prefetchTilIndex) {
        yield;
        // pause until we use the hash we stopped at
        if (Object.keys(this.prefetched).length > 1.5 * this.count) {
          this.prefetched = {};
        }
        prefetchTilIndex += this.count;
      } else {
        index++;
      }
    }
  }

  async get(arg: I): Promise<O> {
    const cacheKey = arg.toString();
    if (this.prefetched[cacheKey]) {
      const data = this.prefetched[cacheKey];
      if (this.lastPrefetch === cacheKey && this.batchIterator) {
        this.batchIterator.next();
      }
      return data;
    } else {
      if (this.batchIterator) {
        this.batchIterator.next();
      }
      return this.applyFn(arg);
    }
  }
}
