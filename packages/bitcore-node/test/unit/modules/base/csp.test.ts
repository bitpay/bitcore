import { expect } from 'chai';
import * as sinon from 'sinon';
import { CryptoRpc } from 'crypto-rpc';
import { MoralisStateProvider } from '../../../../src/modules/moralis/api/csp';
import { BaseEVMStateProvider } from '../../../../src/providers/chain-state/evm/api/csp';
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
      expect(response.id).to.eq(0); // should wrap around to index 0
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