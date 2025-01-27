import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'assert';
import sinon from 'sinon';
import { Modules } from '../../src/modules';
import { ChainStateProvider } from '../../src/providers/chain-state';
import { Libs } from '../../src/providers/libs';
import { Config } from '../../src/services/config';
import { P2P } from '../../src/services/p2p';
import { Verification } from '../../src/services/verification';
import { unitAfterHelper, unitBeforeHelper } from '../helpers/unit';

describe('Modules', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  const sandbox = sinon.createSandbox();

  afterEach(function() {
    sandbox.restore();
  });

  it('should load configured modules correctly', () => {
    sandbox.stub(Config, 'get').returns(mockConfig);
    validateModules();
  });

  it('should try to load custom module', () => {
    const mockConfigCopy = JSON.parse(JSON.stringify(mockConfig));
    mockConfigCopy.chains.BTC.testnet.module = './bitcoin-custom';
    sandbox.stub(Config, 'get').returns(mockConfigCopy);

    assert.throws(() => Modules.loadConfigured(), (err: any) => err.message.includes('Cannot find module \'./bitcoin-custom\''));
  });

  it('should have services registered after loading modules', () => {
    const chainsNetworks = Config.chainNetworks();
    for (const { chain, network } of chainsNetworks) {
      const service = ChainStateProvider.get({ chain, network });
      assert.notEqual(service, null, 'expected service to exist for ' + chain);
    }
  });

  it('should have libraries registered', () => {
    const chains = ['BTC', 'BCH'];
    for (const chain of chains) {
      const service = Libs.get(chain);
      assert.notEqual(service, null, 'expected service to exist for ' + chain);
    }
  });

  it('should have p2p services registered', () => {
    const chains = [['BTC', 'regtest'], ['BCH', 'regtest']];
    for (const [chain, network] of chains) {
      const service = P2P.get(chain, network);
      assert.notEqual(service, null, 'expected service to exist for ' + chain);
    }
  });

  it('should have verification services registered', () => {
    const chains = [['BTC', 'regtest'], ['BCH', 'regtest']];
    for (const [chain, network] of chains) {
      const service = Verification.get(chain, network);
      assert.notEqual(service, null, 'expected service to exist for ' + chain);
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
  Modules.internalServices = []; // Remove all loaded modules from internalServices array for a fresh load
  Modules.loadConfigured(); // Re-load modules with stubbed Config.get()

  assert.strictEqual(Modules.internalServices.length, 2);
  assert.strictEqual(Modules.internalServices[0].constructor.name, 'BitcoinModule');
  assert.strictEqual(Modules.internalServices[1].constructor.name, 'ETHModule');
};
