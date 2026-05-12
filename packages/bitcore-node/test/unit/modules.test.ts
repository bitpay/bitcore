import { expect } from 'chai';
import sinon from 'sinon';
import { loadModules } from '../../src/modules';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';
import { EthP2pWorker } from '../../src/modules/ethereum/p2p/p2p';
import { ChainStateProvider } from '../../src/providers/chain-state';
import { Libs } from '../../src/providers/libs';
import { Config } from '../../src/services/config';
import { P2P } from '../../src/services/p2p';
import { Verification } from '../../src/services/verification';
import { unitAfterHelper, unitBeforeHelper } from '../helpers/unit';

describe('Modules', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should load configured modules correctly', () => {
    const sandbox = sinon.createSandbox();
    sandbox.stub(Config, 'get').returns(mockConfig);

    validateModules();
    sandbox.restore();
  });

  it('should try to load custom module', () => {
    const sandbox = sinon.createSandbox();
    const mockConfigCopy = JSON.parse(JSON.stringify(mockConfig));
    mockConfigCopy.chains.BTC.testnet.module = './bitcoin-custom';
    sandbox.stub(Config, 'get').returns(mockConfigCopy);

    try {
      loadModules();
      throw new Error('it should have thrown due to a non-existing custom module');
    } catch (e: any) {
      expect(e.message).to.include('Cannot find module \'./bitcoin-custom\'');
    }
    sandbox.restore();
  });

  it('should have services registered after loading modules', () => {
    const chainsNetworks = Config.chainNetworks();
    for (const { chain, network } of chainsNetworks) {
      const service = ChainStateProvider.get({ chain, network });
      expect(service).to.exist;
    }
  });

  it('should have libraries registered', () => {
    const chains = ['BTC', 'BCH'];
    for (const chain of chains) {
      const service = Libs.get(chain);
      expect(service).to.exist;
    }
  });

  it('should have p2p services registered', () => {
    const chains = [['BTC', 'regtest'], ['BCH', 'regtest']];
    for (const [chain, network] of chains) {
      const service = P2P.get(chain, network);
      expect(service).to.exist;
    }
  });

  it('should have verification services registered', () => {
    const chains = [['BTC', 'regtest'], ['BCH', 'regtest']];
    for (const [chain, network] of chains) {
      const service = Verification.get(chain, network);
      expect(service).to.exist;
    }
  });
});

const mockConfig = {
  chains: {
    BTC: {
      testnet: {
        chainSource: 'p2p',
        trustedPeers: [
          {
            host: '127.0.0.1',
            port: 18333
          }
        ],
        rpc: {
          host: '127.0.0.1',
          port: 18332,
          username: 'bitpaytest',
          password: 'local321'
        }
      },
    },
    ETH: {
      dev: {
        trustedPeers: [
          {
            host: '127.0.0.1',
            port: 8545
          }
        ],
        chainSource: 'p2p',
        provider: {
          protocol: 'http',
          host: '127.0.0.1',
          port: 8545,
          chain: 'ETH'
        }
      }
    }
  }
};

const validateModules = () => {
  const p2pSpy = sinon.spy(P2P, 'register');
  try {
    expect(p2pSpy.calledWith('BTC', 'testnet', BitcoinP2PWorker)).to.be.false;
    expect(p2pSpy.calledWith('ETH', 'dev', EthP2pWorker)).to.be.false;
    expect(p2pSpy.callCount).to.equal(0);

    loadModules(); // Re-load modules with stubbed Config.get()

    expect(p2pSpy.calledWith('BTC', 'testnet', BitcoinP2PWorker)).to.be.true;
    expect(p2pSpy.calledWith('ETH', 'dev', EthP2pWorker)).to.be.true;
    expect(p2pSpy.callCount).to.equal(2);
  } finally {
    p2pSpy.restore();
  }
};
