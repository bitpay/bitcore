import { expect } from 'chai';
import * as sinon from 'sinon';
import { Web3 } from '@bitpay-labs/crypto-wallet-core';
import { Config } from '../../../src/services/config';
import { BaseP2PWorker, P2P } from '../../../src/services/p2p';
import { EVMP2pWorker } from '../../../src/providers/chain-state/evm/p2p/p2p';
import { BaseEVMStateProvider } from '../../../src/providers/chain-state/evm/api/csp';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';
import { block } from '../../data/ETH/gethMainnet24486902';
import { Rpcs } from '../../../src/providers/chain-state/evm/p2p/rpcs';

describe('P2P Service', function() {
  const sandbox = sinon.createSandbox();
  class MockP2PWorker extends BaseP2PWorker<any> {
    started = false;
  
    constructor(params) {
      super(params);
      this.started = true;
    }
  }
  
  before(unitBeforeHelper);
  after(unitAfterHelper);

  afterEach(() => {
    sandbox.restore();
  });

  it('should have a test which runs', function() {
    expect(true).to.equal(true);
  });

  it('should register a class', () => {
    const chain = 'TEST';
    const network = 'test';
    P2P.register(chain, network, MockP2PWorker);
    const registered = P2P.get(chain, network);
    expect(registered).to.deep.eq(MockP2PWorker);
  });

  it('should start the p2p class', async () => {
    const chain = 'TEST';
    const network = 'testnet';
    const fakeConfig = {};

    P2P.register(chain, network, MockP2PWorker);
    sandbox.stub(Config, 'chainNetworks').returns([{ chain, network }]);
    sandbox
      .stub(Config, 'chainConfig')
      .withArgs({ chain, network })
      .returns(fakeConfig);

    expect(P2P.workers).to.deep.eq([]);
    await P2P.start();
    expect(`Worker length: ${P2P.workers.length}`).to.eq('Worker length: 1');
    expect(P2P.workers[0]).to.exist;
    const worker = P2P.workers[0] as MockP2PWorker;
    expect(worker.started).to.eq(true);
    await P2P.stop();
    expect(P2P.workers).to.deep.eq([]);
  });

  it('should not start if disabled', async () => {
    const chain = 'TEST';
    const network = 'test';

    P2P.register(chain, network, MockP2PWorker);
    sandbox
      .stub(Config, 'isDisabled')
      .withArgs('p2p')
      .returns(true);
    expect(P2P.workers).to.deep.eq([]);
    await P2P.start();
    expect(P2P.workers.length).to.eq(0);
  });

  it('should not start if config has disabled', async () => {
    const chain = 'TEST';
    const network = 'testnet';
    const fakeConfig = { disabled: true };

    P2P.register(chain, network, MockP2PWorker);
    sandbox.stub(Config, 'chainNetworks').returns([{ chain, network }]);
    sandbox
      .stub(Config, 'chainConfig')
      .withArgs({ chain, network })
      .returns(fakeConfig);

    expect(P2P.workers).to.deep.eq([]);
    await P2P.start();
    expect(P2P.workers.length).to.eq(0);
  });

  it('should not start if config has chainSource other than p2p', async () => {
    const chain = 'TEST';
    const network = 'testnet';
    const fakeConfig = { chainSource: 'rpc' };

    P2P.register(chain, network, MockP2PWorker);
    sandbox.stub(Config, 'chainNetworks').returns([{ chain, network }]);
    sandbox
      .stub(Config, 'chainConfig')
      .withArgs({ chain, network })
      .returns(fakeConfig);

    expect(P2P.workers).to.deep.eq([]);
    await P2P.start();
    expect(P2P.workers.length).to.eq(0);
  });

  it('should convert an EVM block', async function() {
    sandbox.stub(Rpcs.geth.prototype, 'getTransactionsFromBlock').resolves([]);
    sandbox.stub(BaseEVMStateProvider, 'initializeRpcs');
    sandbox.stub(Config, 'get').returns({ chains: { ETH: { mainnet: {} } } });
    class MockEVMP2pWorker extends EVMP2pWorker {
      protected rpc = new Rpcs.geth(sandbox.stub() as any);

      constructor(params) {
        super(params);
      }
    }
    
    const p2p = new MockEVMP2pWorker({ chain: 'ETH', network: 'mainnet', chainConfig: {} });
    const converted = await p2p.convertBlock(block as any);
    expect(converted.convertedTxs.every(tx => {
      return (tx.to === '' || tx.to === Web3.utils.toChecksumAddress(tx.to)) &&
        tx.from === Web3.utils.toChecksumAddress(tx.from);
    })).to.equal(true);
  });
});
