'use strict';

import assert from 'assert';
import * as chai from 'chai';
import 'chai/register-should';
import { BlockChainExplorer } from '../src/lib/blockchainexplorer';
import { V8 } from '../src/lib/blockchainexplorers/v8';
import logger from '../src/lib/logger';
import { WalletService } from '../src/lib/server';

const should = chai.should();

describe('BlockChain explorer', function() {
  describe('#constructor', function() {
    it('should return a blockchain explorer with basic methods', function() {
      let exp = BlockChainExplorer({
        coin: 'btc',
        network: 'testnet3',
      });
      should.exist(exp);
      exp.should.respondTo('broadcast');
      exp.should.respondTo('getUtxos');
      exp.should.respondTo('getTransactions');
      exp.should.respondTo('getAddressActivity');
      exp.should.respondTo('estimateFee');
      exp.should.respondTo('initSocket');
      exp = BlockChainExplorer({
        network: 'livenet',
      });
      should.exist(exp);

      const exp2 = BlockChainExplorer({
        provider: 'v8',
        coin: 'btc',
        network: 'livenet',
      });
      should.exist(exp2);
      exp2.should.respondTo('broadcast');
      exp2.should.respondTo('getUtxos');
      exp2.should.respondTo('getTransactions');
      exp2.should.respondTo('getAddressActivity');
      exp2.should.respondTo('estimateFee');
      exp2.should.respondTo('initSocket');
      exp2.should.respondTo('register');
      exp2.should.respondTo('addAddresses');

      for (const [network, apiNetwork] of [['livenet', 'mainnet'], ['testnet', 'testnet']]) {
        const opts = { coin: 'arc', network };
        BlockChainExplorer(opts).baseUrl.should.equal(`https://api-eth.bitcore.io/api/ARC/${apiNetwork}`);
        BlockChainExplorer({ ...opts, url: 'http://localhost:3000' })
          .baseUrl.should.equal(`http://localhost:3000/api/ARC/${apiNetwork}`);
      }
    });
    it('should fail on unsupported provider', function() {
      assert.throws(() => BlockChainExplorer({
        provider: 'dummy',
        coin: 'btc',
      }), { message: 'No url found for provider: dummy:btc:livenet' });
    });
  });

  describe('#_getBlockchainExplorer', function() {
    let server: WalletService;

    beforeEach(function() {
      // This helper only needs explorer configuration, without initializing storage.
      server = Object.create(WalletService.prototype);
      server.logw = () => logger;
    });

    function getExplorer(chain: string, network?: string): V8 {
      const explorer = server._getBlockchainExplorer(chain, network);
      assert.ok(explorer);
      return explorer;
    }

    for (const layout of ['network', 'chain/network']) {
      for (const network of ['__proto__', 'constructor']) {
        it(`does not modify inherited ${network} through ${layout} configuration`, function() {
          server.blockchainExplorerOpts = layout === 'network' ? {} : { eth: {} };
          const target = network === 'constructor' ? Object : Object.prototype;
          const before = Object.getOwnPropertyDescriptors(target);
          let after: typeof before;
          try {
            assert.equal(server._getBlockchainExplorer('eth', network), undefined);
            after = Object.getOwnPropertyDescriptors(target);
          } finally {
            // Restore process globals even when run against the vulnerable implementation.
            for (const key of ['provider', 'chain', 'network', 'userAgent']) {
              if (Object.hasOwn(before, key)) Object.defineProperty(target, key, before[key]);
              else delete target[key];
            }
          }
          assert.deepEqual(after, before);
        });
      }

      it(`uses ${layout} configuration without modifying it`, function() {
        const entry = Object.freeze({ provider: 'v8', url: 'http://127.0.0.1:1234', apiPrefix: '/custom' });
        server.blockchainExplorerOpts = layout === 'network'
          ? { livenet: entry }
          : { eth: { livenet: entry }, livenet: { url: 'http://127.0.0.1:5678' } };
        const explorer = getExplorer('ETH', 'livenet');
        assert.equal(explorer.baseUrl, 'http://127.0.0.1:1234/custom/ETH/mainnet');
        assert.equal(explorer.userAgent, WalletService.getServiceVersion());
        assert.deepEqual(Object.keys(entry), ['provider', 'url', 'apiPrefix']);
      });
    }

    it('ignores inherited chain configuration and uses the own network fallback', function() {
      server.blockchainExplorerOpts = Object.assign(Object.create({
        eth: { livenet: { url: 'http://127.0.0.1:1234/inherited' } }
      }), { livenet: { url: 'http://127.0.0.1:5678' } });
      assert.equal(getExplorer('eth', 'livenet').host, 'http://127.0.0.1:5678');
    });

    it('ignores inherited network configuration and uses the default provider', function() {
      const inherited = { livenet: { url: 'http://127.0.0.1:1234/inherited' } };
      server.blockchainExplorerOpts = Object.assign(Object.create(inherited), { eth: Object.create(inherited) });
      assert.equal(getExplorer('eth', 'livenet').host, 'https://api-eth.bitcore.io');
    });

    it('preserves defaults and looks up legacy network aliases before normalization', function() {
      assert.equal(getExplorer('eth').network, 'livenet');
      server.blockchainExplorerOpts = { eth: { testnet: { url: 'http://127.0.0.1:1234' } } };
      assert.equal(getExplorer('eth', 'testnet').baseUrl, 'http://127.0.0.1:1234/api/ETH/sepolia');
    });

    it('preserves an explicitly injected explorer', function() {
      server.blockchainExplorer = {} as V8;
      assert.equal(server._getBlockchainExplorer('eth', '__proto__'), server.blockchainExplorer);
    });

    it('can recover after a configured provider cannot be constructed', function() {
      const entry = { provider: 'unsupported', url: 'http://127.0.0.1:1234' };
      server.blockchainExplorerOpts = { eth: { livenet: entry } };
      assert.equal(server._getBlockchainExplorer('eth', 'livenet'), undefined);
      assert.deepEqual(entry, { provider: 'unsupported', url: 'http://127.0.0.1:1234' });
      entry.provider = 'v8';
      assert.equal(getExplorer('eth', 'livenet').host, entry.url);
    });
  });

  describe('#v8', function() {
    it.skip('should sign registration', function() {
      const exp = BlockChainExplorer({
        provider: 'v8',
        coin: 'btc',
        network: 'livenet',
      });
      should.exist(exp);
      exp.register; // ...TODO
    });
  });
});
