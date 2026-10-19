import { expect } from 'chai';
import { EthRpc } from '../lib/eth/EthRpc.js';
import { FakeEvmNode } from './evmFakeNode.helper.js';

const gwei = (value) => BigInt(Math.round(value * 1e9));
const mwei = (value) => BigInt(Math.round(value * 1e6));
// each chain's minimum priority fee; a chain without an entry in chains.js gets 2.5 gwei
const MINIMUM_FEES = { ETH: 1, MATIC: 30, OP: 1, ARB: 0, BASE: 1, ARC: 2.5, OTHER: 2.5 };
const minimumFee = (chain) => gwei(MINIMUM_FEES[chain]);
const max = (a, b) => a > b ? a : b;

// count blocks after genesis; block k has a base fee of 10 gwei and 10 type 2 transactions with tips of 1k to 10k
// (in gwei by default). So the top 15% of a block's tips starts at 9k, and over the last 10 blocks (k = 3 to 12) the
// estimate is max(average of the newest 5, average of all 10) + their difference: (10 + 2.5) * 9 = 112.5 gwei.
const market = (count, { unit = gwei, empty = [], baseFee = () => gwei(10) } = {}) => [...Array(count).keys()].map((i) => i + 1).map((k) => ({
  baseFee: baseFee(k),
  txs: empty.includes(k) ? [] : [...Array(10).keys()].map((j) => ({ tip: unit((j + 1) * k) }))
}));

// a chain of one block, with a base fee of 10 gwei and the given transactions
const oneBlock = (txs) => [{ baseFee: gwei(10), txs }];
// 10 transactions with tips of 1 to 10 times unit gwei
const tips = (unit, options = {}) => [...Array(10).keys()].map((j) => ({ tip: gwei(unit * (j + 1)), ...options }));

// OTHER is a chain without an entry in chains.js
const CHAINS = ['ETH', 'MATIC', 'OP', 'ARB', 'BASE', 'ARC', 'OTHER'];

describe('EVM fee estimates', function() {
  const node = new FakeEvmNode();
  let nodeConfig;
  let rpc;
  let failures;

  before(async () => {
    nodeConfig = await node.start();
  });

  after(async () => {
    await node.stop();
  });

  const connect = (chain) => {
    rpc = new EthRpc({ chain, ...nodeConfig });
    failures = [];
    rpc.emitter.on('failure', (err) => failures.push(err));
  };

  for (const chain of CHAINS) {
    describe(`${chain}`, function() {
      const minimum = minimumFee(chain);

      beforeEach(() => {
        node.setChain(market(12), { gasPrice: gwei(1) });
        connect(chain);
      });

      describe('estimateMaxPriorityFee', function() {
        it('estimates from the given top percentile of the last 10 blocks', async () => {
          expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(gwei(112.5));
          expect(await rpc.estimateMaxPriorityFee({ percentile: 25 })).to.equal(gwei(12.5 * 8));
          expect(await rpc.estimateMaxPriorityFee({ percentile: 50 })).to.equal(gwei(12.5 * 5));
          expect(await rpc.estimateMaxPriorityFee({})).to.equal(gwei(12.5 * 8));
          expect(failures).to.deep.equal([]);
        });

        it('takes fractional, string and end percentiles', async () => {
          expect(await rpc.estimateMaxPriorityFee({ percentile: 12.5 })).to.equal(gwei(112.5));
          expect(await rpc.estimateMaxPriorityFee({ percentile: '15' })).to.equal(gwei(112.5));
          expect(await rpc.estimateMaxPriorityFee({ percentile: 0 })).to.equal(gwei(12.5 * 10));
          expect(await rpc.estimateMaxPriorityFee({ percentile: 100 })).to.equal(max(gwei(12.5), minimum));
          // a negative percentile takes the highest tip, as 0 does
          expect(await rpc.estimateMaxPriorityFee({ percentile: -5 })).to.equal(gwei(12.5 * 10));
          expect(failures).to.deep.equal([]);
        });

        it('gives the chain minimum for a percentile over 100 or not a number', async () => {
          expect(await rpc.estimateMaxPriorityFee({ percentile: 150 })).to.equal(minimum);
          expect(await rpc.estimateMaxPriorityFee({ percentile: NaN })).to.equal(minimum);
          expect(await rpc.estimateMaxPriorityFee({ percentile: 'fast' })).to.equal(minimum);
          expect(failures).to.deep.equal([]);
        });

        it('gives the chain minimum when the estimate is lower', async () => {
          node.setChain(market(12, { unit: mwei }));
          expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(max(mwei(112.5), minimum));
        });

        it('skips blocks without transactions', async () => {
          node.setChain(market(12, { empty: [5, 8] }));
          // k = 12, 11, 10, 9, 7, 6, 4, 3: newest 4 average 10.5, all 8 average 7.75
          expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(gwei((10.5 + 2.75) * 9));
        });

        it('uses the blocks there are on a chain shorter than 10 blocks', async () => {
          node.setChain(market(3));
          // k = 3, 2, 1: the newest 1 averages 3, all 3 average 2
          expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(gwei((3 + 1) * 9));
        });

        it('takes the one block of a chain with one block', async () => {
          node.setChain(market(1, { unit: (value) => gwei(10 * value) }));
          expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(gwei(90));
        });

        it('gives the chain minimum on a chain with no blocks after genesis', async () => {
          node.setChain([]);
          expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(minimum);
        });

        it('gives the chain minimum and emits a failure when the node cannot give fees', async () => {
          node.fail('eth_getBlockByNumber');
          node.fail('eth_feeHistory');
          expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(minimum);
          expect(failures).to.not.be.empty;
        });

        it('keeps the estimates of different percentiles apart', async () => {
          const estimates = [];
          for (const percentile of [15, 25, 15, 50, 25]) {
            estimates.push(await rpc.estimateMaxPriorityFee({ percentile }));
          }
          expect(estimates).to.deep.equal([gwei(112.5), gwei(100), gwei(112.5), gwei(62.5), gwei(100)]);
        });
      });

      describe('estimateGasPrice', function() {
        it('estimates from the top 25% of gas prices of the last 10 blocks', async () => {
          // the top 25% of block k starts at 10 + 8k gwei
          expect(await rpc.estimateGasPrice()).to.equal(gwei(10 + 8 * 12.5));
          expect(failures).to.deep.equal([]);
        });

        it('adds the base fee of each block', async () => {
          // block k has a base fee of k gwei, so its top 25% starts at 9k gwei
          node.setChain(market(12, { baseFee: (k) => gwei(k) }), { gasPrice: gwei(1) });
          expect(await rpc.estimateGasPrice()).to.equal(gwei(9 * 12.5));
        });

        it('gives the node gas price when it is higher', async () => {
          node.setChain(market(12), { gasPrice: gwei(200) });
          expect(await rpc.estimateGasPrice()).to.equal(gwei(200));
        });

        it('gives the node gas price on a chain with no blocks after genesis', async () => {
          node.setChain([], { gasPrice: gwei(3) });
          expect(await rpc.estimateGasPrice()).to.equal(gwei(3));
        });

        it('gives the node gas price and emits a failure when the node cannot give fees', async () => {
          node.fail('eth_getBlockByNumber');
          node.fail('eth_feeHistory');
          expect(await rpc.estimateGasPrice()).to.equal(gwei(1));
          expect(failures).to.not.be.empty;
        });
      });

      describe('estimateMaxFee', function() {
        it('adds a given priority fee to twice the latest base fee', async () => {
          expect(await rpc.estimateMaxFee({ priority: 5 })).to.equal(gwei(2 * 10 + 5));
        });

        it('adds the percentile priority fee to twice the latest base fee', async () => {
          expect(await rpc.estimateMaxFee({ percentile: 15 })).to.equal(gwei(2 * 10) + max(gwei(112.5), minimum));
        });

        it('adds 2.5 gwei to twice the latest base fee without a priority fee or a percentile from 1 to 100', async () => {
          expect(await rpc.estimateMaxFee({})).to.equal(gwei(2 * 10 + 2.5));
          expect(await rpc.estimateMaxFee({ percentile: 0 })).to.equal(gwei(2 * 10 + 2.5));
          expect(await rpc.estimateMaxFee({ percentile: 101 })).to.equal(gwei(2 * 10 + 2.5));
        });
      });

      it('gives the same estimates when they run at once', async () => {
        const estimates = await Promise.all([
          rpc.estimateMaxPriorityFee({ percentile: 15 }),
          rpc.estimateGasPrice(),
          rpc.estimateMaxFee({ percentile: 25 }),
          rpc.estimateMaxPriorityFee({ percentile: 50 })
        ]);
        expect(estimates).to.deep.equal([gwei(112.5), gwei(110), gwei(20 + 100), max(gwei(62.5), minimum)]);
      });

      describe('estimateFee', function() {
        it('estimates the max fee for type 2', async () => {
          expect(await rpc.estimateFee({ txType: 2, priority: 5 })).to.equal(gwei(25));
          expect(await rpc.estimateFee({ txType: '2', percentile: 15 })).to.equal(gwei(20) + max(gwei(112.5), minimum));
          expect(await rpc.estimateFee({ txType: 'EIP-1559' })).to.equal(gwei(22.5));
        });

        it('estimates the gas price for legacy and by default', async () => {
          expect(await rpc.estimateFee({ txType: 0, nBlocks: 2 })).to.equal(gwei(110));
          expect(await rpc.estimateFee({ txType: 'legacy' })).to.equal(gwei(110));
          expect(await rpc.estimateFee({ nBlocks: 4 })).to.equal(gwei(110));
        });
      });
    });
  }

  for (const chain of ['ETH', 'OTHER']) {
    describe(`${chain} reads blocks`, function() {
      beforeEach(() => {
        node.setChain(market(12), { gasPrice: gwei(1) });
        connect(chain);
      });

      it('reads the transactions of the last 10 blocks, and not eth_feeHistory', async () => {
        await rpc.estimateMaxPriorityFee({ percentile: 15 });
        expect(node.count('eth_blockNumber')).to.equal(1);
        expect(node.calls.filter((call) => call.method === 'eth_getBlockByNumber').map((call) => call.params))
          .to.have.deep.members([...Array(10).keys()].map((i) => ['0x' + (12 - i).toString(16), true]));
        expect(node.count('eth_feeHistory')).to.equal(0);
      });

      it('reads blocks for the gas price, and not eth_feeHistory', async () => {
        await rpc.estimateGasPrice();
        expect(node.count('eth_gasPrice')).to.equal(1);
        expect(node.count('eth_getBlockByNumber')).to.equal(10);
        expect(node.count('eth_feeHistory')).to.equal(0);
      });

      it('gives the chain minimum and emits a failure when a block cannot be read', async () => {
        node.fail('eth_getBlockByNumber');
        expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(minimumFee(chain));
        expect(failures).to.have.lengthOf(1);
      });

      it('uses the tips transactions declare', async () => {
        // declared tips of 20 to 200 gwei, although a max fee of 60 gwei over a 10 gwei base fee pays at most 50
        node.setChain(oneBlock(tips(20, { maxFee: gwei(60) })));
        expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(gwei(180));
      });

      it('counts each transaction once, whatever gas it uses', async () => {
        const txs = tips(10);
        txs[9].gas = 420000n;
        node.setChain(oneBlock(txs), { gasPrice: gwei(1) });
        expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(gwei(90));
        expect(await rpc.estimateGasPrice()).to.equal(gwei(10 + 80));
      });

      it('skips legacy transactions for the priority fee, and counts them for the gas price', async () => {
        node.setChain(oneBlock(tips(20, { legacy: true })), { gasPrice: gwei(1) });
        expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(minimumFee(chain));
        expect(await rpc.estimateGasPrice()).to.equal(gwei(10 + 160));
      });

      it('skips type 2 transactions that tip nothing', async () => {
        node.setChain(oneBlock([...Array(8).fill({ tip: 0n }), { tip: gwei(100) }, { tip: gwei(200) }]));
        expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(gwei(200));
      });

      it('keeps the cached block fees when a block cannot be read', async () => {
        await rpc.estimateMaxPriorityFee({ percentile: 15 });
        await rpc.estimateGasPrice();
        const keys = (cache) => [...cache.keys()].sort((a, b) => (a < b ? -1 : 1));
        const before = [keys(rpc.blockMaxPriorityFeeCache), keys(rpc.blockGasPriceCache)];
        node.addBlocks(market(1));
        node.fail('eth_getBlockByNumber');
        expect(await rpc.estimateMaxPriorityFee({ percentile: 15 })).to.equal(minimumFee(chain));
        expect(await rpc.estimateGasPrice()).to.equal(gwei(1));
        expect([keys(rpc.blockMaxPriorityFeeCache), keys(rpc.blockGasPriceCache)]).to.deep.equal(before);
      });
    });
  }
});
