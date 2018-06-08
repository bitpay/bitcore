import { describe } from 'mocha';
import { expect } from 'chai';
import { Cache } from '../../src/utils/cache';

describe('Cache', () => {
  it('should cache items in order', () => {
    const cache = new Cache(3);
    expect(cache.use(1)).to.be.false;
    expect(cache.use(2)).to.be.false;
    expect(cache.use(3)).to.be.false;

    expect(cache.peek(1)).to.be.true;
    expect(cache.peek(2)).to.be.true;
    expect(cache.peek(3)).to.be.true;

    expect(cache.use(4)).to.be.false;

    expect(cache.peek(1)).to.be.false;
    expect(cache.peek(2)).to.be.true;
    expect(cache.peek(3)).to.be.true;
    expect(cache.peek(4)).to.be.true;
  });

  it('should not allow repeated values', () => {
    const cache = new Cache(2);
    expect(cache.use(1)).to.be.false;
    expect(cache.use(1)).to.be.true;

    expect(cache.peek(1)).to.be.true;

    expect(cache.use(2)).to.be.false;

    expect(cache.peek(1)).to.be.true;
    expect(cache.peek(2)).to.be.true;

    expect(cache.use(2)).to.be.true;

    expect(cache.peek(1)).to.be.true;
    expect(cache.peek(2)).to.be.true;
  });

  it('should not store over capacity', () => {
    const cache = new Cache(3);
    expect(cache.use(1)).to.be.false;
    expect(cache.use(2)).to.be.false;
    expect(cache.use(1)).to.be.true;
    expect(cache.use(2)).to.be.true;
    expect(cache.use(3)).to.be.false;
    expect(cache.use(3)).to.be.true;
    expect(cache.use(3)).to.be.true;
    expect(cache.use(1)).to.be.true;
    expect(cache.use(2)).to.be.true;
    expect(cache.use(4)).to.be.false;
    expect(cache.use(1)).to.be.false;
  });
});
