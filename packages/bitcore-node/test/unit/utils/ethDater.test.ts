import { expect } from 'chai';
import sinon from 'sinon';
import { EthDater } from '../../../src/utils/ethDater';

/**
 * Fake web3 backed by a fixed map of block_number -> timestamp.
 * `latest` resolves to the largest block in the map.
 */
function fakeWeb3(blocks: Record<number | 'latest', number>) {
  const latestNum = Math.max(...Object.keys(blocks).filter(k => k !== 'latest').map(Number));
  return {
    eth: {
      getBlock: sinon.stub().callsFake(async (id: number | 'latest') => {
        const num = id === 'latest' ? latestNum : id;
        if (blocks[num] === undefined) throw new Error(`no fake block ${num}`);
        return { number: num, timestamp: blocks[num] };
      })
    }
  };
}

describe('EthDater', function() {
  describe('boundary edges', function() {
    it('returns block 1 for a date before genesis', async function() {
      // genesis (block 1) at ts=1000; latest (block 100) at ts=2000 → avg block time 1010/99
      const blocks: Record<number, number> = { 1: 1000, 100: 2000 };
      const dater = new EthDater(fakeWeb3(blocks));
      const result = await dater.getDate(new Date(500 * 1000), false);
      expect(result.block).to.equal(1);
    });

    it('returns the latest block for a future date', async function() {
      const blocks: Record<number, number> = { 1: 1000, 100: 2000 };
      const dater = new EthDater(fakeWeb3(blocks));
      const result = await dater.getDate(new Date(5000 * 1000), false);
      expect(result.block).to.equal(100);
    });
  });

  describe('interpolation', function() {
    it('finds the block whose timestamp is at or before target ("after=false")', async function() {
      // Linear chain: block N at timestamp N*10. block 5 = ts 50, block 6 = ts 60, etc.
      const blocks: Record<number, number> = {};
      for (let i = 1; i <= 100; i++) blocks[i] = i * 10;
      const dater = new EthDater(fakeWeb3(blocks));

      // Target ts=555 → largest block with ts < 555 is block 55 (ts=550). after=false returns it.
      const result = await dater.getDate(new Date(555 * 1000), false);
      expect(result.block).to.equal(55);
      expect(result.timestamp).to.equal(550);
    });

    it('finds the block whose timestamp is at or after target ("after=true")', async function() {
      const blocks: Record<number, number> = {};
      for (let i = 1; i <= 100; i++) blocks[i] = i * 10;
      const dater = new EthDater(fakeWeb3(blocks));

      // Target ts=555 → smallest block with ts >= 555 is block 56 (ts=560). after=true returns it.
      const result = await dater.getDate(new Date(555 * 1000), true);
      expect(result.block).to.equal(56);
      expect(result.timestamp).to.equal(560);
    });
  });

  describe('per-call probe cache', function() {
    it('does not refetch the same block within a single getDate call', async function() {
      const blocks: Record<number, number> = {};
      for (let i = 1; i <= 100; i++) blocks[i] = i * 10;
      const web3 = fakeWeb3(blocks);
      const dater = new EthDater(web3);

      await dater.getDate(new Date(555 * 1000), false);
      const firstCallCount = web3.eth.getBlock.callCount;

      // Reset the stub history for clarity, then call again with same boundaries
      // (no `refresh`) — boundaries reused, only refinement probes.
      web3.eth.getBlock.resetHistory();
      await dater.getDate(new Date(555 * 1000), false);
      const secondCallCount = web3.eth.getBlock.callCount;

      // First call probes boundaries (2) + refinement; second call skips boundaries and
      // benefits from the savedBlocks cache → strictly fewer probes.
      expect(secondCallCount).to.be.lessThan(firstCallCount);
    });
  });

  describe('result shape', function() {
    it('returns { block, timestamp, date } where date is the requested ISO string', async function() {
      const blocks: Record<number, number> = {};
      for (let i = 1; i <= 100; i++) blocks[i] = i * 10;
      const dater = new EthDater(fakeWeb3(blocks));

      const target = new Date(555 * 1000);
      const result = await dater.getDate(target, false);
      expect(result).to.have.keys('block', 'timestamp', 'date');
      expect(result.date).to.equal(target.toISOString());
    });
  });

  describe('bigint timestamps (web3 v4)', function() {
    it('handles getBlock returning bigint number/timestamp', async function() {
      const web3 = {
        eth: {
          getBlock: sinon.stub().callsFake(async (id: number | 'latest') => {
            const num = id === 'latest' ? 100 : (id as number);
            return { number: BigInt(num), timestamp: BigInt(num * 10) };
          })
        }
      };
      const dater = new EthDater(web3);
      const result = await dater.getDate(new Date(555 * 1000), false);
      expect(result.block).to.equal(55);
      expect(result.timestamp).to.equal(550);
    });
  });
});
