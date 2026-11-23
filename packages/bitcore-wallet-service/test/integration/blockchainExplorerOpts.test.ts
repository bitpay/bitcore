'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import sinon from 'sinon';
import config from '../../src/config';
import { WalletService } from '../../src/lib/server';
import { Storage } from '../../src/lib/storage';
import helpers from './helpers';

const should = chai.should();

// Objects every plain object or function inherits from. A test that writes onto one of them would break later tests
// (and every Mongo query: bson serializes inherited enumerable properties), so the tests below undo any such write
// before asserting on it.
const SHARED = [Object.prototype, Object, Function.prototype];
const ownNames = () => SHARED.map(o => new Set(Object.getOwnPropertyNames(o)));
const undoWritesSince = (before: Array<Set<string>>): string[] => {
  const written = [];
  for (const [i, o] of SHARED.entries()) {
    for (const name of Object.getOwnPropertyNames(o).filter(n => !before[i].has(n))) {
      written.push(name);
      delete o[name];
    }
  }
  return written;
};
const NETWORK_NAMES_ON_OBJECT_PROTOTYPE = ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty'];

describe('WalletService#_getBlockchainExplorer', function() {
  let server: WalletService;
  let storage: Storage;

  before(async function() {
    ({ storage } = await helpers.before());
    // undoWritesSince() compares against a snapshot, so make sure the snapshot starts clean
    const inherited = [];
    for (const key in {}) inherited.push(key);
    inherited.should.deep.equal([]);
  });

  beforeEach(async function() {
    await helpers.beforeEach();
    server = new WalletService();
    // helpers.before() installs a mock explorer for every server; these tests exercise the real lookup
    server.blockchainExplorer = undefined;
  });

  afterEach(function() {
    sinon.restore();
  });

  after(async function() {
    await helpers.after();
  });

  it('should return the configured explorer instance when there is one', function() {
    const explorer = helpers.getBlockchainExplorer();
    server.blockchainExplorer = explorer;
    server._getBlockchainExplorer('btc', 'livenet').should.equal(explorer);
  });

  it('should use the url configured for the chain and network', function() {
    server.blockchainExplorerOpts = { btc: { livenet: { url: 'http://localhost:1234' } } };
    server._getBlockchainExplorer('btc', 'livenet').baseUrl.should.equal('http://localhost:1234/api/BTC/mainnet');
  });

  it('should match the chain case-insensitively', function() {
    server.blockchainExplorerOpts = { btc: { livenet: { url: 'http://localhost:1234' } } };
    server._getBlockchainExplorer('BTC', 'livenet').baseUrl.should.equal('http://localhost:1234/api/BTC/mainnet');
  });

  it('should use the provider configured for the chain and network', function() {
    server.blockchainExplorerOpts = { btc: { livenet: { url: 'http://localhost:1234', provider: 'dummy' } } };
    const logw = sinon.spy(server, 'logw');
    should.not.exist(server._getBlockchainExplorer('btc', 'livenet'));
    logw.calledOnce.should.equal(true);
    logw.firstCall.args[0].should.equal('Could not instantiate blockchain explorer:');
    logw.firstCall.args[1].message.should.equal('Provider not supported: dummy');
  });

  it('should fall back to options configured for the network alone, without their provider', function() {
    server.blockchainExplorerOpts = { livenet: { url: 'http://localhost:4321', provider: 'dummy' } };
    server._getBlockchainExplorer('btc', 'livenet').baseUrl.should.equal('http://localhost:4321/api/BTC/mainnet');
  });

  it('should use the default url when nothing is configured for the chain and network', function() {
    server.blockchainExplorerOpts = { btc: { livenet: { url: 'http://localhost:1234' } } };
    server._getBlockchainExplorer('eth', 'sepolia').baseUrl.should.equal('https://api-eth.bitcore.io/api/ETH/sepolia');
    server.blockchainExplorerOpts = undefined;
    server._getBlockchainExplorer('eth', 'sepolia').baseUrl.should.equal('https://api-eth.bitcore.io/api/ETH/sepolia');
  });

  it('should look up the options by the given network and pass the chain-specific network name on', function() {
    server.blockchainExplorerOpts = { eth: { testnet: { url: 'http://localhost:1234' } } };
    server._getBlockchainExplorer('eth', 'testnet').baseUrl.should.equal('http://localhost:1234/api/ETH/sepolia');
  });

  it('should log and return nothing when no explorer can be built', function() {
    server.blockchainExplorerOpts = {};
    const logw = sinon.spy(server, 'logw');
    should.not.exist(server._getBlockchainExplorer('eth', 'nonet'));
    logw.calledOnce.should.equal(true);
    logw.firstCall.args[1].message.should.equal('No url found for provider: v8:eth:nonet');
  });

  describe('with names inherited from Object.prototype', function() {
    beforeEach(function() {
      // a copy, so no test can change the shared config
      server.blockchainExplorerOpts = JSON.parse(JSON.stringify(config.blockchainExplorerOpts));
      sinon.stub(server, 'logw');
    });

    for (const chain of ['eth', 'btc', 'sol', 'nochain', '__proto__', 'constructor']) {
      it(`should not write onto shared objects for chain ${chain}`, function() {
        for (const network of NETWORK_NAMES_ON_OBJECT_PROTOTYPE) {
          const before = ownNames();
          let explorer, written;
          try {
            explorer = server._getBlockchainExplorer(chain, network);
          } finally {
            written = undoWritesSince(before);
          }
          written.should.deep.equal([], `${chain}/${network}`);
          should.not.exist(explorer, `${chain}/${network}`);
        }
      });
    }

    it('should not let a public request break the database for later requests', async function() {
      const before = ownNames();
      let requestErr, dbErr, written;
      try {
        requestErr = await server.getTokenAllowance({
          chain: 'eth', network: '__proto__', tokenAddress: 'a', ownerAddress: 'b', spenderAddress: 'c'
        }).then(() => null, err => err);
        dbErr = await storage.db.collection('wallets').findOne({ id: 'none' }).then(() => null, err => err);
      } finally {
        written = undoWritesSince(before);
      }
      written.should.deep.equal([]);
      should.not.exist(dbErr);
      requestErr.message.should.equal('Could not get blockchain explorer instance');
    });
  });

  describe('lookups', function() {
    it('should not write into the configured options', function() {
      const opts = {
        btc: { livenet: { url: 'http://localhost:1234' } },
        bch: { livenet: { url: 'http://localhost:1234' } },
        livenet: { url: 'http://localhost:4321' }
      };
      const copy = JSON.parse(JSON.stringify(opts));
      server.blockchainExplorerOpts = opts;
      should.exist(server._getBlockchainExplorer('btc', 'livenet'));
      should.exist(server._getBlockchainExplorer('bch', 'livenet'));
      should.exist(server._getBlockchainExplorer('eth', 'livenet'));
      opts.should.deep.equal(copy);
    });
  });
});
