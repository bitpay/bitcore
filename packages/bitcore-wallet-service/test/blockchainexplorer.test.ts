'use strict';

import chai from 'chai';
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
