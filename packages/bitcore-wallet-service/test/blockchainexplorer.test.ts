'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import { BlockChainExplorer } from '../src/lib/blockchainexplorer';

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
    it('should use the default url for the chain and network', function() {
      BlockChainExplorer({ chain: 'eth', network: 'sepolia' }).baseUrl.should.equal('https://api-eth.bitcore.io/api/ETH/sepolia');
      BlockChainExplorer({ chain: 'BTC', network: 'livenet' }).baseUrl.should.equal('https://api.bitcore.io/api/BTC/mainnet');
    });
    it('should prefer opts.url over the default url', function() {
      BlockChainExplorer({ chain: 'eth', network: 'sepolia', url: 'http://localhost:3000' })
        .baseUrl.should.equal('http://localhost:3000/api/ETH/sepolia');
    });
    it('should fail on a network with no default url', function() {
      (() => BlockChainExplorer({ chain: 'eth', network: 'nonet' })).should.throw('No url found for provider: v8:eth:nonet');
      (() => BlockChainExplorer({ chain: 'nochain', network: 'livenet' })).should.throw('No url found for provider: v8:nochain:livenet');
    });
    it('should fail on a provider it does not support even with a url', function() {
      (() => BlockChainExplorer({ provider: 'dummy', chain: 'btc', network: 'livenet', url: 'http://localhost:3000' }))
        .should.throw('Provider not supported: dummy');
    });
    it('should not take a url from names inherited from Object.prototype', function() {
      for (const network of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
        (() => BlockChainExplorer({ chain: 'eth', network })).should.throw(`No url found for provider: v8:eth:${network}`);
      }
      (() => BlockChainExplorer({ chain: '__proto__', network: 'toString' })).should.throw('No url found for provider: v8:__proto__:toString');
      (() => BlockChainExplorer({ provider: '__proto__', chain: 'constructor', network: 'name' })).should.throw('No url found for provider: __proto__:constructor:name');
    });
    it('should default the bch address format to cashaddr on the given opts', function() {
      const opts: any = { chain: 'bch', network: 'livenet' };
      BlockChainExplorer(opts);
      opts.addressFormat.should.equal('cashaddr');
    });
    it('should fail on unsupported provider', function() {
      try {
        const exp = BlockChainExplorer({
          provider: 'dummy',
          coin: 'btc',
        });
        throw new Error('Should have thrown');
      } catch (err) {
        err.message.should.equal('No url found for provider: dummy:btc:livenet');
      }
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
