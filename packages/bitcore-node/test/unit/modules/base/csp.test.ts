import { expect } from 'chai';
import * as sinon from 'sinon';
import { CryptoRpc } from '@bitpay-labs/crypto-rpc';
import { MultiProviderEVMStateProvider } from '../../../../src/modules/multiProvider/api/csp';
import { MoralisStateProvider } from '../../../../src/modules/moralis/api/csp';
import { CacheStorage } from '../../../../src/models/cache';
import { BaseEVMStateProvider } from '../../../../src/providers/chain-state/evm/api/csp';
import { EVMBlockStorage } from '../../../../src/providers/chain-state/evm/models/block';
import { Config } from '../../../../src/services/config';


describe('BASE Chain State Provider', function() {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(Config, 'get').returns({
      chains: {
        BASE: {
          mainnet: {
            chainSource: 'external',
            module: './moralis',
            needsL1Fee: true,
            providers: [{
              dataType: 'combined',
              host: 'sample.example',
              port: '1234',
              protocol: 'http',
            }, {
              dataType: 'realtime',
              host: 'sample.example',
              port: '1234',
              protocol: 'http',
            }]
          },
          sepolia: {
            chainSource: 'external',
            module: './moralis',
            needsL1Fee: true,
            providers: [{
              dataType: 'combined',
              host: 'sample.example',
              port: '1234',
              protocol: 'ws',
            }]
          }
        }
      }
    });
  });

  afterEach(() => {
    BaseEVMStateProvider.teardownRpcs();
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should call initializeRpcs', function() {
      sandbox.stub(BaseEVMStateProvider, 'initializeRpcs');
      new BaseEVMStateProvider('BASE');
      expect((BaseEVMStateProvider.initializeRpcs as any).callCount).to.eq(1);
    });
  });

  describe('initializeRpcs', () => {
    beforeEach(function() {
      // Clear any existing RPCs before each test
      BaseEVMStateProvider.rpcs = {};
      BaseEVMStateProvider.rpcInitialized = {};
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.not.exist;
    });

    it('should initialize RPCs for BASE', function() {
      BaseEVMStateProvider.initializeRpcs('BASE');
      expect(BaseEVMStateProvider.rpcs['BASE:mainnet']).to.exist;
      expect(BaseEVMStateProvider.rpcs['BASE:mainnet'].realtime.length).to.equal(2); // realtime + combined
      expect(BaseEVMStateProvider.rpcs['BASE:mainnet'].historical.length).to.equal(1); // only combined
      expect(BaseEVMStateProvider.rpcIndicies['BASE:mainnet']).to.deep.equal({ realtime: 0, historical: 0 });
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia']).to.exist;
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].realtime.length).to.equal(1); // combined
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].historical.length).to.equal(1); // combined
      expect(BaseEVMStateProvider.rpcIndicies['BASE:sepolia']).to.deep.equal({ realtime: 0, historical: 0 });
      // 'combined' dataType will put the same object in both
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].realtime[0]).to.equal(BaseEVMStateProvider.rpcs['BASE:sepolia'].historical[0]);
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.be.true;
    });

    it('should not re-initialize RPCs for BASE if already initialized', function() {
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.not.exist;
      sandbox.spy(CryptoRpc.prototype, 'get');
      BaseEVMStateProvider.initializeRpcs('BASE');
      const existingRpcsMainnet = BaseEVMStateProvider.rpcs['BASE:mainnet'];
      const existingRpcsSepolia = BaseEVMStateProvider.rpcs['BASE:sepolia'];
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.be.true;
      expect((CryptoRpc.prototype.get as sinon.SinonSpy).callCount).to.equal(3);
      
      // Check for re-initialization
      (CryptoRpc.prototype.get as sinon.SinonSpy).resetHistory();
      BaseEVMStateProvider.initializeRpcs('BASE');
      expect(BaseEVMStateProvider.rpcs['BASE:mainnet']).to.equal(existingRpcsMainnet);
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia']).to.equal(existingRpcsSepolia);
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.be.true; // still true
      expect((CryptoRpc.prototype.get as sinon.SinonSpy).callCount).to.equal(0); // no new calls
    });

    it('should only initialize RPCs for provided data types', function() {
      (Config.get as sinon.SinonStub).restore();
      sandbox.stub(Config, 'get').returns({
        chains: {
          BASE: {
            sepolia: {
              chainSource: 'external',
              module: './moralis',
              needsL1Fee: true,
              providers: [{
                dataType: 'realtime', // no historical/combined
                host: 'sample.example',
                port: '1234',
                protocol: 'ws',
              }]
            }
          }
        }
      });
      BaseEVMStateProvider.initializeRpcs('BASE');
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia']).to.exist;
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].realtime.length).to.equal(1);
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].historical.length).to.equal(0);
      expect(BaseEVMStateProvider.rpcIndicies['BASE:sepolia']).to.deep.equal({ realtime: 0, historical: 0 });
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.be.true;
    });
  });

  describe('teardownRpcs', () => {
    it('should teardown RPCs for BASE', function() {
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.not.exist;
      BaseEVMStateProvider.initializeRpcs('BASE');
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.be.true;
      expect(BaseEVMStateProvider.rpcs['BASE:mainnet']).to.exist;
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia']).to.exist;
      expect(BaseEVMStateProvider.rpcIndicies).to.deep.equal({ 'BASE:mainnet': { realtime: 0, historical: 0 }, 'BASE:sepolia': { realtime: 0, historical: 0 } });
      BaseEVMStateProvider.teardownRpcs();
      expect(BaseEVMStateProvider.rpcs).to.deep.equal({});
      expect(BaseEVMStateProvider.rpcIndicies).to.deep.equal({});
      expect(BaseEVMStateProvider.rpcInitialized['BASE']).to.not.exist;
    });

    it('should work idempotently', function() {
      expect(BaseEVMStateProvider.rpcs).to.deep.equal({});
      expect(BaseEVMStateProvider.rpcIndicies).to.deep.equal({});
      BaseEVMStateProvider.teardownRpcs();
      expect(BaseEVMStateProvider.rpcs).to.deep.equal({});
      expect(BaseEVMStateProvider.rpcIndicies).to.deep.equal({});
    });

    it('should not error if historical array is missing', function() {
      // If no historical or combined providers are configured, the historical array will be missing
      (Config.get as sinon.SinonStub).restore();
      sandbox.stub(Config, 'get').returns({
        chains: {
          BASE: {
            sepolia: {
              chainSource: 'external',
              module: './moralis',
              needsL1Fee: true,
              providers: [{
                dataType: 'realtime', // no historical/combined
                host: 'sample.example',
                port: '1234',
                protocol: 'ws',
              }]
            }
          }
        }
      });
      BaseEVMStateProvider.initializeRpcs('BASE');
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia']).to.exist;
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].realtime.length).to.equal(1);
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].historical.length).to.equal(0);
      expect(BaseEVMStateProvider.rpcIndicies['BASE:sepolia']).to.deep.equal({ realtime: 0, historical: 0 });
      BaseEVMStateProvider.teardownRpcs();
      expect(BaseEVMStateProvider.rpcs).to.deep.equal({});
      expect(BaseEVMStateProvider.rpcIndicies).to.deep.equal({});
    });

    it('should not error if realtime array is missing', function() {
      // If no realtime or combined providers are configured, the realtime array will be missing
      (Config.get as sinon.SinonStub).restore();
      sandbox.stub(Config, 'get').returns({
        chains: {
          BASE: {
            sepolia: {
              chainSource: 'external',
              module: './moralis',
              needsL1Fee: true,
              providers: [{
                dataType: 'historical', // no realtime/combined
                host: 'sample.example',
                port: '1234',
                protocol: 'ws',
              }]
            }
          }
        }
      });
      BaseEVMStateProvider.initializeRpcs('BASE');
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia']).to.exist;
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].realtime.length).to.equal(0);
      expect(BaseEVMStateProvider.rpcs['BASE:sepolia'].historical.length).to.equal(1);
      expect(BaseEVMStateProvider.rpcIndicies['BASE:sepolia']).to.deep.equal({ realtime: 0, historical: 0 });
      BaseEVMStateProvider.teardownRpcs();
      expect(BaseEVMStateProvider.rpcs).to.deep.equal({});
      expect(BaseEVMStateProvider.rpcIndicies).to.deep.equal({});
    });
  });

  describe('getWeb3', () => {
    const network = 'sepolia';
    let BASE;

    before(() => {
      BASE = new MoralisStateProvider('BASE');
    });

    beforeEach(function() {
      BaseEVMStateProvider.initializeRpcs('BASE');
    });

    it('should be able to get web3 with only 1 realtime provider', async () => {
      const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`BASE:${network}`]: {
        realtime: [{ web3: web3Stub, rpc: sandbox.stub(), dataType: 'combined' }]
      } });
      const { web3 } = await BASE.getWeb3(network);
      const block = await web3.eth.getBlockNumber();
      const stub = web3.eth.getBlockNumber as sinon.SinonStub;
      expect(stub.callCount).to.eq(1); // doesn't do a test call with only 1 provider
      expect(block).to.eq(1);
    });

    it('should be able to get web3 with multiple realtime provider', async () => {
      const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`BASE:${network}`]: {
        realtime: [
          { web3: web3Stub, rpc: sandbox.stub(), dataType: 'combined' },
          { web3: web3Stub, rpc: sandbox.stub(), dataType: 'combined' }
        ]
      } });
      const { web3 } = await BASE.getWeb3(network);
      const block = await web3.eth.getBlockNumber();
      const stub = web3.eth.getBlockNumber as sinon.SinonStub;
      expect(stub.callCount).to.eq(2); // does a test call to select responsive provider
      expect(block).to.eq(1);
    });

    it('should handle when last used index is last in array', async () => {
      const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`BASE:${network}`]: {
        realtime: [
          { web3: web3Stub, rpc: sandbox.stub(), dataType: 'combined', index: 0 },
          { web3: web3Stub, rpc: sandbox.stub(), dataType: 'combined', index: 1 },
        ]
      } });
      BaseEVMStateProvider.rpcIndicies[`BASE:${network}`].realtime = 1; // set to last index
      const response = await BASE.getWeb3(network);
      expect(response.index).to.eq(0); // should wrap around to index 0
      const block = await response.web3.eth.getBlockNumber();
      const stub = response.web3.eth.getBlockNumber as sinon.SinonStub;
      expect(stub.callCount).to.eq(2); // does a test call to select responsive provider
      expect(block).to.eq(1);
    });

    it('should round-robin multiple web3 providers', async () => {
      const web3Stub1 = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
      const web3Stub2 = { eth: { getBlockNumber: sandbox.stub().resolves(2) } };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`BASE:${network}`]: {
        realtime: [
          { web3: web3Stub1, rpc: sandbox.stub(), dataType: 'combined' },
          { web3: web3Stub2, rpc: sandbox.stub(), dataType: 'combined' }
        ]
      } });
      let { web3 } = await BASE.getWeb3(network);
      expect(web3).to.equal(web3Stub2); // index starts at index 1
      ({ web3 } = await BASE.getWeb3(network));
      expect(web3).to.equal(web3Stub1);
      ({ web3 } = await BASE.getWeb3(network));
      expect(web3).to.equal(web3Stub2);
    });

    it('should return web3 for provider dataType', async () => {
      const web3Stub1 = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
      const web3Stub2 = { eth: { getBlockNumber: sandbox.stub().resolves(2) } };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`BASE:${network}`]: {
        realtime: [{ web3: web3Stub1, rpc: sandbox.stub(), dataType: 'combined' }],
        historical: [{ web3: web3Stub2, rpc: sandbox.stub(), dataType: 'combined' }]
      } });
      let { web3 } = await BASE.getWeb3(network, { type: 'realtime' });
      expect(web3).to.equal(web3Stub1);
      ({ web3 } = await BASE.getWeb3(network, { type: 'historical' }));
      expect(web3).to.equal(web3Stub2);
    });

    it('should return web3 for provider dataType with round-robin for each', async () => {
      const web3StubRealtime1 = { eth: { getBlockNumber: sandbox.stub().resolves(11) } };
      const web3StubRealtime2 = { eth: { getBlockNumber: sandbox.stub().resolves(12) } };
      const web3StubHistorical1 = { eth: { getBlockNumber: sandbox.stub().resolves(21) } };
      const web3StubHistorical2 = { eth: { getBlockNumber: sandbox.stub().resolves(22) } };
      const web3StubCombined = { eth: { getBlockNumber: sandbox.stub().resolves(31) } };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`BASE:${network}`]: {
        realtime: [{ web3: web3StubRealtime1, rpc: sandbox.stub(), dataType: 'realtime' }, { web3: web3StubRealtime2, rpc: sandbox.stub(), dataType: 'realtime' }, { web3: web3StubCombined, rpc: sandbox.stub(), dataType: 'combined' }],
        historical: [{ web3: web3StubHistorical1, rpc: sandbox.stub(), dataType: 'historical' }, { web3: web3StubHistorical2, rpc: sandbox.stub(), dataType: 'historical' }, { web3: web3StubCombined, rpc: sandbox.stub(), dataType: 'combined' }]
      } });
      let { web3 } = await BASE.getWeb3(network, { type: 'realtime' });
      expect(web3).to.equal(web3StubRealtime2); // index starts at index 1
      ({ web3 } = await BASE.getWeb3(network, { type: 'historical' }));
      expect(web3).to.equal(web3StubHistorical2); // index starts at index 1
      ({ web3 } = await BASE.getWeb3(network, { type: 'historical' }));
      expect(web3).to.equal(web3StubCombined); // index 2
      ({ web3 } = await BASE.getWeb3(network, { type: 'historical' }));
      expect(web3).to.equal(web3StubHistorical1); // index 0
      ({ web3 } = await BASE.getWeb3(network, { type: 'realtime' }));
      expect(web3).to.equal(web3StubCombined); // index 2
      ({ web3 } = await BASE.getWeb3(network, { type: 'realtime' }));
      expect(web3).to.equal(web3StubRealtime1); // index 0
    });
  });
});

describe('MultiProviderEVMStateProvider: getLocalTip', function() {
  let cfgStub: sinon.SinonStub;
  let convertStub: sinon.SinonStub;

  before(function() {
    cfgStub = sinon.stub(Config, 'get').returns({ chains: { ETH: {} } } as any);
    (BaseEVMStateProvider as any).rpcInitialized = { ETH: true };
    // convertRawBlock writes Binary buffers; stub to return a height-only IBlock.
    convertStub = sinon.stub(EVMBlockStorage, 'convertRawBlock').callsFake((chain: string, network: string, raw: any) => ({
      chain, network, height: Number(raw.number), hash: raw.hash
    }) as any);
  });
  after(function() {
    cfgStub.restore();
    convertStub.restore();
  });

  function buildProvider(latestBlocks: any[]) {
    const provider = new MultiProviderEVMStateProvider('ETH');
    let i = 0;
    const getBlock = sinon.stub().callsFake(async (_tag: any) => latestBlocks[Math.min(i++, latestBlocks.length - 1)]);
    (provider as any).getWeb3 = async () => ({ web3: { eth: { getBlock } } });
    return { provider, getBlock };
  }

  it('returns tip from realtime RPC, not Mongo storage', async function() {
    const raw = { number: 12345, hash: '0xabc', timestamp: 1700000000 };
    const { provider, getBlock } = buildProvider([raw]);
    const tip = await provider.getLocalTip({ chain: 'ETH', network: 'mainnet' });
    expect(tip.height).to.equal(12345);
    expect(getBlock.calledWith('latest')).to.equal(true);
  });

  it('caches tip across calls within TTL window', async function() {
    const raw = { number: 100, hash: '0xa', timestamp: 1 };
    const { provider, getBlock } = buildProvider([raw, raw]);
    await provider.getLocalTip({ chain: 'ETH', network: 'mainnet' });
    await provider.getLocalTip({ chain: 'ETH', network: 'mainnet' });
    await provider.getLocalTip({ chain: 'ETH', network: 'mainnet' });
    expect(getBlock.callCount).to.equal(1);
  });

  it('caches per chain:network independently', async function() {
    const raw1 = { number: 100, hash: '0xa', timestamp: 1 };
    const raw2 = { number: 200, hash: '0xb', timestamp: 2 };
    const { provider, getBlock } = buildProvider([raw1, raw2]);
    const tip1 = await provider.getLocalTip({ chain: 'ETH', network: 'mainnet' });
    const tip2 = await provider.getLocalTip({ chain: 'ETH', network: 'sepolia' });
    expect(tip1.height).to.equal(100);
    expect(tip2.height).to.equal(200);
    expect(getBlock.callCount).to.equal(2);
  });

  it('throws when realtime RPC returns no block', async function() {
    const { provider } = buildProvider([null]);
    try {
      await provider.getLocalTip({ chain: 'ETH', network: 'mainnet' });
      throw new Error('should have thrown');
    } catch (e: any) {
      expect(e.message).to.match(/no latest block/i);
    }
  });
});

describe('MultiProviderEVMStateProvider: getFee', function() {
  let cfgStub: sinon.SinonStub;
  let cacheStub: sinon.SinonStub;
  before(function() {
    cfgStub = sinon.stub(Config, 'get').returns({ chains: { ETH: {} } } as any);
    (BaseEVMStateProvider as any).rpcInitialized = { ETH: true };
    // Bypass Mongo-backed CacheStorage; just call through to the refresh fn.
    cacheStub = sinon.stub(CacheStorage, 'getGlobalOrRefresh').callsFake(async (_key: string, refresh: any) => refresh());
  });
  after(function() { cfgStub.restore(); cacheStub.restore(); });

  it('uses RPC estimateFee, not Mongo tx history', async function() {
    const provider = new MultiProviderEVMStateProvider('ETH');
    const estimateFee = sinon.stub().resolves(2_000_000_000n);
    (provider as any).getWeb3 = async () => ({ rpc: { estimateFee } });
    const result = await provider.getFee({ network: 'mainnet-getfee-uniq1', target: 4, txType: 2 } as any);
    expect(result.feerate).to.equal(2_000_000_000);
    expect(result.blocks).to.equal(4);
    expect(estimateFee.calledOnce).to.equal(true);
    expect(estimateFee.firstCall.args[0]).to.deep.equal({ nBlocks: 4, txType: 2 });
  });

  it('accepts "livenet" alias without throwing', async function() {
    const provider = new MultiProviderEVMStateProvider('ETH');
    const estimateFee = sinon.stub().resolves(1_000_000_000n);
    (provider as any).getWeb3 = async () => ({ rpc: { estimateFee } });
    const result = await provider.getFee({ network: 'livenet', target: 7 } as any);
    expect(result.feerate).to.equal(1_000_000_000);
    expect(result.blocks).to.equal(7);
  });
});

describe('MultiProviderEVMStateProvider: streamBlocks and _getBlocks', function() {
  let cfgStub: sinon.SinonStub;
  let convertStub: sinon.SinonStub;
  before(function() {
    cfgStub = sinon.stub(Config, 'get').returns({ chains: { ETH: {} } } as any);
    (BaseEVMStateProvider as any).rpcInitialized = { ETH: true };
    convertStub = sinon.stub(EVMBlockStorage, 'convertRawBlock').callsFake((chain: string, network: string, raw: any) => ({
      chain, network, height: Number(raw.number), hash: raw.hash
    }) as any);
  });
  after(function() {
    cfgStub.restore();
    convertStub.restore();
  });

  function setupProvider(blockMap: Record<number, any>, tipHeight = 100) {
    const provider = new MultiProviderEVMStateProvider('ETH');
    const getBlock = sinon.stub().callsFake(async (n: any) => blockMap[Number(n)] ?? null);
    const getBlockNumber = sinon.stub().resolves(BigInt(tipHeight));
    (provider as any).getWeb3 = async () => ({ web3: { eth: { getBlock, getBlockNumber } } });
    (provider as any).getChainId = async () => 1n;
    (provider as any).getBlocksRange = async () => [10, 11, 12];
    return { provider, getBlock };
  }

  it('_getBlocks fetches blocks via RPC and computes tipHeight from getBlockNumber', async function() {
    const blockMap: Record<number, any> = {
      10: { number: 10n, hash: '0xa' },
      11: { number: 11n, hash: '0xb' },
      12: { number: 12n, hash: '0xc' },
      13: { number: 13n, hash: '0xd' }
    };
    const { provider } = setupProvider(blockMap, 200);
    const result = await (provider as any)._getBlocks({ chain: 'ETH', network: 'mainnet' });
    expect(result.tipHeight).to.equal(200);
    expect(result.blocks).to.have.length(3);
    expect(result.blocks[0].height).to.equal(10);
    expect(result.blocks[2].height).to.equal(12);
  });

  it('streamBlocks emits blocks from RPC range with confirmations and nextBlockHash', async function() {
    const blockMap: Record<number, any> = {
      10: { number: 10n, hash: '0xa' },
      11: { number: 11n, hash: '0xb' },
      12: { number: 12n, hash: '0xc' },
      13: { number: 13n, hash: '0xd' }
    };
    const { provider } = setupProvider(blockMap, 100);
    const stream: any = await (provider as any).streamBlocks({ chain: 'ETH', network: 'mainnet' });
    const out: any[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (b: any) => out.push(b));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    expect(out).to.have.length(3);
    expect(out[0].height).to.equal(10);
    expect(out[0].confirmations).to.equal(100 - 10 + 1);
    expect(out[0].nextBlockHash).to.equal('0xb');
    expect(out[2].nextBlockHash).to.equal('0xd');
  });
});

describe('MultiProviderEVMStateProvider: _buildWalletTransactionsStream tokenAddress routing', function() {
  let cfgStub: sinon.SinonStub;
  before(function() {
    cfgStub = sinon.stub(Config, 'get').returns({ chains: { ETH: {} } } as any);
    (BaseEVMStateProvider as any).rpcInitialized = { ETH: true };
  });
  after(function() { cfgStub.restore(); });

  function buildProviderWithFakeAdapter() {
    const provider = new MultiProviderEVMStateProvider('ETH');
    const fakeStream = { eventPipe: (s: any) => s };
    const adapter = {
      name: 'fake',
      streamAddressTransactions: sinon.stub().returns(fakeStream),
      streamERC20Transfers: sinon.stub().returns(fakeStream)
    };
    const fakeProvider = { adapter, health: { isAvailable: () => true, recordFailure: sinon.stub() }, priority: 1 };
    (provider as any).providersByNetwork = new Map([['mainnet', [fakeProvider]]]);
    (provider as any).getChainId = async () => 1n;
    // Minimal stub for WalletAddressStorage.updateLastQueryTime
    (provider as any).updateLastQueryTime = async () => {};
    return { provider, adapter };
  }

  it('routes to streamERC20Transfers when args.tokenAddress is set', async function() {
    const { provider, adapter } = buildProviderWithFakeAdapter();
    const transactionStream: any = { eventPipe: (s: any) => s };
    await (provider as any)._buildWalletTransactionsStream(
      { network: 'mainnet', args: { tokenAddress: '0xtoken' } },
      { transactionStream, walletAddresses: ['0xaddr1', '0xaddr2'] }
    );
    expect(adapter.streamERC20Transfers.callCount).to.equal(2);
    expect(adapter.streamAddressTransactions.callCount).to.equal(0);
    expect(adapter.streamERC20Transfers.firstCall.args[0].tokenAddress).to.equal('0xtoken');
  });

  it('routes to streamAddressTransactions when no tokenAddress is set', async function() {
    const { provider, adapter } = buildProviderWithFakeAdapter();
    const transactionStream: any = { eventPipe: (s: any) => s };
    await (provider as any)._buildWalletTransactionsStream(
      { network: 'mainnet', args: {} },
      { transactionStream, walletAddresses: ['0xaddr1'] }
    );
    expect(adapter.streamAddressTransactions.callCount).to.equal(1);
    expect(adapter.streamERC20Transfers.callCount).to.equal(0);
  });
});