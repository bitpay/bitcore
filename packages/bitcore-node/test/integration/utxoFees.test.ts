import { expect } from 'chai';
import * as sinon from 'sinon';
import { CacheStorage } from '../../src/models/cache';
import { BCHStateProvider } from '../../src/providers/chain-state/bch/bch';
import { BTCStateProvider } from '../../src/providers/chain-state/btc/btc';
import { DOGEStateProvider } from '../../src/providers/chain-state/doge/doge';
import { LTCStateProvider } from '../../src/providers/chain-state/ltc/ltc';
import * as FeeProviders from '../../src/providers/fee';
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
  });

  afterEach(() => {
    sandbox.restore();
  });

  const MINUTE = 60 * 1000;
  // makes the stored estimate look as if it was cached ms ago
  const age = (key: string, ms: number) => CacheStorage.collection.updateOne({ key }, { $set: { created: Date.now() - ms } });

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
  }
});
