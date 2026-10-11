'use strict';

import * as chai from 'chai';
import { ChainService } from '../../src/lib/chain';
import { TxProposal } from '../../src/lib/model/txproposal';

const should = chai.should();

describe('Chain ETH', function() {
  it('should transform addresses to the db', function() {
    const x = { address: '0x01' };
    ChainService.addressToStorageTransform('eth', 'abc', x);
    x.address.should.equal('0x01:abc');
  });

  it('should transform addresses from the db', function() {
    const x = { address: '0x01:dfg' };
    ChainService.addressFromStorageTransform('eth', 'dfg', x);
    x.address.should.equal('0x01');
  });

  describe('#selectTxInputs', function() {
    it('should reject a total that a number rounds down to the balance', function(done) {
      const server = {
        getBalance: (_opts, cb) => cb(null, { totalAmount: 9007199254740992, availableAmount: 9007199254740992 })
      };
      const txp = TxProposal.fromObj({
        ...aTXP(),
        outputs: [
          { ...aTXP().outputs[0], amount: '9007199254740992' },
          { ...aTXP().outputs[0], amount: '1' }
        ]
      } as any);

      ChainService.get('eth').selectTxInputs(server as any, txp, {} as any, {}, err => {
        should.exist(err);
        err.code.should.equal('INSUFFICIENT_FUNDS');
        done();
      });
    });
  });
});

const aTXP = function() {
  return {
    version: 3,
    createdOn: 1423146231,
    id: '75c34f49-1ed6-255f-e9fd-0c71ae75ed1e',
    walletId: '1',
    creatorId: '1',
    coin: 'eth',
    chain: 'eth',
    network: 'livenet',
    from: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    nonce: 5,
    gasPrice: 25000000000,
    gasLimit: 60000,
    fee: 1500000000000000,
    outputs: [{ toAddress: '0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8', amount: 1000, gasLimit: 60000 }],
    status: 'pending' as const,
    actions: []
  };
};

