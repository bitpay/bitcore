import { expect } from 'chai';
import * as sinon from 'sinon';
import logger from '../../src/logger';
import { CacheStorage } from '../../src/models/cache';
import { EventStorage } from '../../src/models/events';
import { BCHStateProvider } from '../../src/providers/chain-state/bch/bch';
import { BTCStateProvider } from '../../src/providers/chain-state/btc/btc';
import { DOGEStateProvider } from '../../src/providers/chain-state/doge/doge';
import { LTCStateProvider } from '../../src/providers/chain-state/ltc/ltc';
import * as FeeProviders from '../../src/providers/fee';
import { Event } from '../../src/services/event';
import { resetDatabase } from '../helpers';
import { intAfterHelper, intBeforeHelper } from '../helpers/integration';

describe('UTXO fee estimates', function() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  const network = 'mainnet';
  const sandbox = sinon.createSandbox();
  let rpc: { getEstimateSmartFee: sinon.SinonStub; getEstimateFee: sinon.SinonStub };
  let feeProviders: sinon.SinonStub[];
  let warn: sinon.SinonStub;

  // the provider with its node's estimates stubbed: estimatesmartfee answers feerate per target, estimatefee feerate
  const withRpc = <T extends { getRPC: any }>(provider: T) => {
    sandbox.stub(provider, 'getRPC').returns(rpc as any);
    return provider;
  };

  beforeEach(async () => {
    await resetDatabase();
    rpc = {
      getEstimateSmartFee: sandbox.stub().callsFake(async (target: number) => ({ feerate: target / 10000, blocks: target })),
      getEstimateFee: sandbox.stub().resolves(0.00001)
    };
    // BTC averages its node's estimate with these, in sats per byte
    feeProviders = [
      sandbox.stub(FeeProviders.BlockCypher, 'getFee').resolves(10),
      sandbox.stub(FeeProviders.MempoolSpace, 'getFee').resolves(30),
      sandbox.stub(FeeProviders.Bitgo, 'getFee').resolves(50)
    ];
    warn = sandbox.stub(logger, 'warn');
  });

  afterEach(() => {
    sandbox.restore();
  });

  // no block times from other tests, before or after each test that uses them
  const isolateBlockTimes = () => {
    beforeEach(() => Event.lastBlockTimes.clear());
    afterEach(() => Event.lastBlockTimes.clear());
  };

  const MINUTE = 60 * 1000;
  // makes the stored estimate look as if it was cached ms ago
  const age = (key: string, ms: number) => CacheStorage.collection.updateOne({ key }, { $set: { created: Date.now() - ms } });
  const stored = async (key: string) => CacheStorage.collection.findOne({ key });
  const waitFor = async (check: () => Promise<boolean> | boolean) => {
    const until = Date.now() + 5000;
    while (!(await check())) {
      if (Date.now() > until) {
        throw new Error('timed out');
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  // marks a block of the chain and network as arrived just after the stored estimate was cached, and returns its time
  const blockAfter = async (chain: string, net: string, key: string) => {
    const time = (await stored(key))!.created + 1;
    Event.lastBlockTimes.set(`${chain}:${net}`, time);
    return time;
  };
  const refreshedSince = (key: string, time: number) => waitFor(async () => (await stored(key))!.created >= time);

  for (const [chain, Provider] of [['LTC', LTCStateProvider], ['DOGE', DOGEStateProvider]] as const) {
    describe(chain, function() {
      it('returns the node estimate for the target and caches it per target', async () => {
        const provider = withRpc(new Provider());
        expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.0002, blocks: 2 });
        expect(await provider.getFee({ chain, network, target: 6 })).to.deep.equal({ feerate: 0.0006, blocks: 6 });
        expect(rpc.getEstimateSmartFee.args).to.deep.equal([[2, undefined], [6, undefined]]);
        expect(await CacheStorage.getGlobal(`getFee-${chain}-${network}-2`)).to.deep.equal({ feerate: 0.0002, blocks: 2 });
        expect(await CacheStorage.getGlobal(`getFee-${chain}-${network}-6`)).to.deep.equal({ feerate: 0.0006, blocks: 6 });
      });

      it('passes the mode to the node and caches per mode', async () => {
        const provider = withRpc(new Provider());
        await provider.getFee({ chain, network, target: 3, mode: 'ECONOMICAL' });
        expect(rpc.getEstimateSmartFee.args).to.deep.equal([[3, 'ECONOMICAL']]);
        expect(await CacheStorage.getGlobal(`getFee-${chain}-${network}-3-economical`)).to.deep.equal({ feerate: 0.0003, blocks: 3 });
      });

      it('serves a fresh estimate without asking the node', async () => {
        const provider = withRpc(new Provider());
        await provider.getFee({ chain, network, target: 2 });
        rpc.getEstimateSmartFee.resolves({ feerate: 0.0009, blocks: 2 });
        expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.0002, blocks: 2 });
        expect(rpc.getEstimateSmartFee.callCount).to.equal(1);
      });

      it('keeps networks apart', async () => {
        const provider = withRpc(new Provider());
        await provider.getFee({ chain, network, target: 2 });
        await provider.getFee({ chain, network: 'testnet', target: 2 });
        expect(rpc.getEstimateSmartFee.callCount).to.equal(2);
      });

      it('passes on a node error when there is no estimate yet', async () => {
        const provider = withRpc(new Provider());
        rpc.getEstimateSmartFee.rejects(new Error('node down'));
        const err = await provider.getFee({ chain, network, target: 2 }).catch(e => e);
        expect(err).to.be.an('error').with.property('message', 'node down');
        expect(await CacheStorage.getGlobal(`getFee-${chain}-${network}-2`)).to.equal(null);
      });
    });
  }

  describe('BTC', function() {
    const chain = 'BTC';

    it('averages its node estimate with the fee providers, in sats per byte', async () => {
      const provider = withRpc(new BTCStateProvider());
      // node: 0.0002 BTC/kB = 20 sat/B; providers 10, 30, 50: (20 + 90) / 4 = 27.5, rounded up to 28 sat/B
      expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.00028, blocks: 2 });
      for (const getFee of feeProviders) {
        expect(getFee.args).to.deep.equal([[network, 2]]);
      }
      expect(await CacheStorage.getGlobal(`getFee-${chain}-${network}-2`)).to.deep.equal({ feerate: 0.00028, blocks: 2 });
    });

    it('averages with the providers that answer', async () => {
      const provider = withRpc(new BTCStateProvider());
      feeProviders[1].rejects(new Error('down'));
      // (20 + 10 + 50) / 3 = 26.67, rounded up to 27 sat/B
      expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.00027, blocks: 2 });
    });

    it('uses its node estimate alone when no provider answers', async () => {
      const provider = withRpc(new BTCStateProvider());
      for (const getFee of feeProviders) {
        getFee.rejects(new Error('down'));
      }
      expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.0002, blocks: 2 });
    });

    it('passes the mode to its node and caches per mode', async () => {
      const provider = withRpc(new BTCStateProvider());
      await provider.getFee({ chain, network, target: 3, mode: 'CONSERVATIVE' });
      expect(rpc.getEstimateSmartFee.args).to.deep.equal([[3, 'CONSERVATIVE']]);
      expect(await CacheStorage.getGlobal(`getFee-${chain}-${network}-3-conservative`)).to.exist;
    });

    it('serves a fresh estimate without asking its node or the providers', async () => {
      const provider = withRpc(new BTCStateProvider());
      await provider.getFee({ chain, network, target: 2 });
      expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.00028, blocks: 2 });
      expect(rpc.getEstimateSmartFee.callCount).to.equal(1);
      expect(feeProviders[0].callCount).to.equal(1);
    });

    it('passes on a node error when there is no estimate yet', async () => {
      const provider = withRpc(new BTCStateProvider());
      rpc.getEstimateSmartFee.rejects(new Error('node down'));
      const err = await provider.getFee({ chain, network, target: 2 }).catch(e => e);
      expect(err).to.be.an('error').with.property('message', 'node down');
    });
  });

  describe('BCH', function() {
    const chain = 'BCH';

    it('returns the node estimatefee for every target, cached once per network', async () => {
      const provider = withRpc(new BCHStateProvider());
      expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.00001 });
      expect(await provider.getFee({ chain, network, target: 6 })).to.deep.equal({ feerate: 0.00001 });
      expect(rpc.getEstimateFee.callCount).to.equal(1);
      expect(rpc.getEstimateSmartFee.callCount).to.equal(0);
      expect(await CacheStorage.getGlobal(`getFee-${chain}-${network}`)).to.deep.equal({ feerate: 0.00001 });
    });

    it('passes on a node error when there is no estimate yet', async () => {
      const provider = withRpc(new BCHStateProvider());
      rpc.getEstimateFee.rejects(new Error('node down'));
      const err = await provider.getFee({ chain, network, target: 2 }).catch(e => e);
      expect(err).to.be.an('error').with.property('message', 'node down');
    });
  });

  // each chain with its cache key, its stubbed node call, a way to set the node's next answer, and the estimate that
  // answer gives
  const refreshCases = [
    ...(['LTC', 'DOGE'] as const).map(chain => ({
      chain,
      provider: () => withRpc(chain === 'LTC' ? new LTCStateProvider() : new DOGEStateProvider()),
      key: `getFee-${chain}-${network}-2`,
      node: () => rpc.getEstimateSmartFee,
      answer: (feerate: number) => ({ feerate, blocks: 2 }),
      estimate: (feerate: number) => ({ feerate, blocks: 2 })
    })),
    {
      chain: 'BTC',
      provider: () => {
        // without the fee providers, the estimate is the node's
        for (const getFee of feeProviders) {
          getFee.rejects(new Error('down'));
        }
        return withRpc(new BTCStateProvider());
      },
      key: `getFee-BTC-${network}-2`,
      node: () => rpc.getEstimateSmartFee,
      answer: (feerate: number) => ({ feerate, blocks: 2 }),
      estimate: (feerate: number) => ({ feerate, blocks: 2 })
    },
    {
      chain: 'BCH',
      provider: () => withRpc(new BCHStateProvider()),
      key: `getFee-BCH-${network}`,
      node: () => rpc.getEstimateFee,
      answer: (feerate: number) => feerate,
      estimate: (feerate: number) => ({ feerate })
    }
  ];

  for (const c of refreshCases) {
    const setNode = (feerate: number) => c.node().resolves(c.answer(feerate));

    describe(`${c.chain} before a refresh is due`, function() {
      it('serves the stored estimate for 5 minutes when no block arrives', async () => {
        const provider = c.provider();
        setNode(0.0001);
        await provider.getFee({ chain: c.chain, network, target: 2 });
        await age(c.key, 4 * MINUTE);
        setNode(0.0003);
        expect(await provider.getFee({ chain: c.chain, network, target: 2 })).to.deep.equal(c.estimate(0.0001));
        expect(c.node().callCount).to.equal(1);
      });
    });

    describe(`${c.chain} after a block or 5 minutes`, function() {
      isolateBlockTimes();

      it('serves the stored estimate after 5 minutes, and replaces it in the background', async () => {
        const provider = c.provider();
        setNode(0.0001);
        await provider.getFee({ chain: c.chain, network, target: 2 });
        await age(c.key, 5 * MINUTE + 1000);
        setNode(0.0003);
        expect(await provider.getFee({ chain: c.chain, network, target: 2 })).to.deep.equal(c.estimate(0.0001));
        await waitFor(async () => (await stored(c.key))?.value.feerate === 0.0003);
        expect(await provider.getFee({ chain: c.chain, network, target: 2 })).to.deep.equal(c.estimate(0.0003));
        expect(c.node().callCount).to.equal(2);
      });

      it('serves the stored estimate after a block of its chain and network, and replaces it in the background', async () => {
        const provider = c.provider();
        setNode(0.0001);
        await provider.getFee({ chain: c.chain, network, target: 2 });
        setNode(0.0003);
        await blockAfter(c.chain, network, c.key);
        expect(await provider.getFee({ chain: c.chain, network, target: 2 })).to.deep.equal(c.estimate(0.0001));
        await waitFor(async () => (await stored(c.key))?.value.feerate === 0.0003);
        expect(await provider.getFee({ chain: c.chain, network, target: 2 })).to.deep.equal(c.estimate(0.0003));
        expect(c.node().callCount).to.equal(2);
      });

      it('ignores blocks of other chains and networks', async () => {
        const provider = c.provider();
        setNode(0.0001);
        await provider.getFee({ chain: c.chain, network, target: 2 });
        await blockAfter(c.chain, 'testnet', c.key);
        await blockAfter(c.chain === 'LTC' ? 'DOGE' : 'LTC', network, c.key);
        await provider.getFee({ chain: c.chain, network, target: 2 });
        expect(c.node().callCount).to.equal(1);
      });

      it('keeps the stored estimate when a refresh fails, and tries again on the next call', async () => {
        const provider = c.provider();
        setNode(0.0001);
        await provider.getFee({ chain: c.chain, network, target: 2 });
        await age(c.key, 5 * MINUTE + 1000);
        c.node().rejects(new Error('node down'));
        expect(await provider.getFee({ chain: c.chain, network, target: 2 })).to.deep.equal(c.estimate(0.0001));
        await waitFor(() => warn.callCount === 1);
        expect(warn.firstCall.args[1]).to.equal(c.key);
        expect((await stored(c.key))!.value).to.deep.equal(c.estimate(0.0001));
        expect(await provider.getFee({ chain: c.chain, network, target: 2 })).to.deep.equal(c.estimate(0.0001));
        await waitFor(() => warn.callCount === 2);
        expect(c.node().callCount).to.equal(3);
      });

      it('refreshes once for calls made while a refresh is running', async () => {
        const provider = c.provider();
        setNode(0.0001);
        await provider.getFee({ chain: c.chain, network, target: 2 });
        await age(c.key, 5 * MINUTE + 1000);
        let finish: () => void = () => undefined;
        c.node().callsFake(() => new Promise(resolve => {
          finish = () => resolve(c.answer(0.0003));
        }));
        try {
          const estimates = await Promise.all([...Array(5)].map(() => provider.getFee({ chain: c.chain, network, target: 2 })));
          expect(estimates).to.deep.equal([...Array(5)].map(() => c.estimate(0.0001)));
          expect(c.node().callCount).to.equal(2);
        } finally {
          finish();
        }
        await waitFor(async () => (await stored(c.key))?.value.feerate === 0.0003);
      });

      it('logs a failed refresh once, however many calls were waiting on it', async () => {
        const provider = c.provider();
        setNode(0.0001);
        await provider.getFee({ chain: c.chain, network, target: 2 });
        await age(c.key, 5 * MINUTE + 1000);
        let fail: () => void = () => undefined;
        c.node().callsFake(() => new Promise((_, reject) => {
          fail = () => reject(new Error('node down'));
        }));
        await Promise.all([...Array(3)].map(() => provider.getFee({ chain: c.chain, network, target: 2 })));
        fail();
        await waitFor(() => warn.callCount === 1);
        await new Promise(resolve => setImmediate(resolve));
        expect(warn.callCount).to.equal(1);
      });
    });
  }

  describe('LTC refresh details', function() {
    isolateBlockTimes();
    const chain = 'LTC';
    const key = `getFee-${chain}-${network}-2`;

    it('treats an estimate whose refresh started before a block as stale after it', async () => {
      const provider = withRpc(new LTCStateProvider());
      await provider.getFee({ chain, network, target: 2 });
      await age(key, 5 * MINUTE + 1000);
      let finish: () => void = () => undefined;
      rpc.getEstimateSmartFee.callsFake(() => new Promise(resolve => {
        finish = () => resolve({ feerate: 0.0003, blocks: 2 });
      }));
      await provider.getFee({ chain, network, target: 2 });
      // the block arrives while the refresh is running
      await new Promise(resolve => setTimeout(resolve, 5));
      Event.lastBlockTimes.set(`${chain}:${network}`, Date.now());
      finish();
      await waitFor(async () => (await stored(key))?.value.feerate === 0.0003);
      rpc.getEstimateSmartFee.resolves({ feerate: 0.0005, blocks: 2 });
      expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.0003, blocks: 2 });
      await waitFor(async () => (await stored(key))?.value.feerate === 0.0005);
      expect(rpc.getEstimateSmartFee.callCount).to.equal(3);
    });

    it('refreshes after a block that arrives through the event service', async () => {
      const provider = withRpc(new LTCStateProvider());
      await Event.start();
      try {
        await provider.getFee({ chain, network, target: 2 });
        rpc.getEstimateSmartFee.resolves({ feerate: 0.0003, blocks: 2 });
        await new Promise(resolve => setTimeout(resolve, 5));
        await EventStorage.signalBlock({ chain, network, height: 1, hash: 'a' } as any);
        await waitFor(() => Event.lastBlockTime(chain, network) !== undefined);
        expect(await provider.getFee({ chain, network, target: 2 })).to.deep.equal({ feerate: 0.0002, blocks: 2 });
        await waitFor(async () => (await stored(key))?.value.feerate === 0.0003);
      } finally {
        await Event.stop();
      }
    });

    it('refreshes the estimates of a block\'s network only', async () => {
      const provider = withRpc(new LTCStateProvider());
      await provider.getFee({ chain, network, target: 2 });
      await provider.getFee({ chain, network: 'testnet', target: 2 });
      const block = await blockAfter(chain, 'testnet', `getFee-${chain}-testnet-2`);
      await provider.getFee({ chain, network, target: 2 });
      expect(rpc.getEstimateSmartFee.callCount).to.equal(2);
      await provider.getFee({ chain, network: 'testnet', target: 2 });
      expect(rpc.getEstimateSmartFee.callCount).to.equal(3);
      await refreshedSince(`getFee-${chain}-testnet-2`, block);
    });

    it('refreshes each target after a block', async () => {
      const provider = withRpc(new LTCStateProvider());
      await provider.getFee({ chain, network, target: 2 });
      await provider.getFee({ chain, network, target: 6 });
      const block = await blockAfter(chain, network, `getFee-${chain}-${network}-6`);
      await provider.getFee({ chain, network, target: 2 });
      await provider.getFee({ chain, network, target: 6 });
      expect(rpc.getEstimateSmartFee.args.slice(2)).to.deep.equal([[2, undefined], [6, undefined]]);
      await refreshedSince(`getFee-${chain}-${network}-2`, block);
      await refreshedSince(`getFee-${chain}-${network}-6`, block);
    });

    it('shares a refresh between providers of the same chain in one process', async () => {
      const providers = [withRpc(new LTCStateProvider()), withRpc(new LTCStateProvider())];
      await providers[0].getFee({ chain, network, target: 2 });
      await age(key, 5 * MINUTE + 1000);
      let finish: () => void = () => undefined;
      rpc.getEstimateSmartFee.callsFake(() => new Promise(resolve => {
        finish = () => resolve({ feerate: 0.0003, blocks: 2 });
      }));
      try {
        await Promise.all(providers.map(p => p.getFee({ chain, network, target: 2 })));
        expect(rpc.getEstimateSmartFee.callCount).to.equal(2);
      } finally {
        finish();
      }
      await waitFor(async () => (await stored(key))?.value.feerate === 0.0003);
    });
  });

  describe('BCH refresh details', function() {
    isolateBlockTimes();

    it('refreshes its one estimate once after a block, whatever the target', async () => {
      const provider = withRpc(new BCHStateProvider());
      await provider.getFee({ chain: 'BCH', network, target: 2 });
      const block = await blockAfter('BCH', network, `getFee-BCH-${network}`);
      await Promise.all([2, 6].map(target => provider.getFee({ chain: 'BCH', network, target })));
      expect(rpc.getEstimateFee.callCount).to.equal(2);
      await refreshedSince(`getFee-BCH-${network}`, block);
    });
  });
});
