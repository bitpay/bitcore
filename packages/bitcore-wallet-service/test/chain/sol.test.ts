'use strict';

import * as chai from 'chai';
import { ChainService } from '../../src/lib/chain';
import { Defaults } from '../../src/lib/common/defaults';
import { TxProposal } from '../../src/lib/model/txproposal';

const should = chai.should();

describe('Chain SOL', function() {
  describe('#selectTxInputs', function() {
    it('should reject a total that a number rounds down to the balance', function(done) {
      const balance = 9007199254740992 + Defaults.MIN_SOL_BALANCE;
      const server = {
        getBalance: (_opts, cb) => cb(null, { totalAmount: balance, availableAmount: balance })
      };
      const txp = TxProposal.fromObj({
        version: 3,
        id: '75c34f49-1ed6-255f-e9fd-0c71ae75ed1e',
        walletId: '1',
        creatorId: '1',
        coin: 'sol',
        chain: 'sol',
        network: 'livenet',
        from: '8WyoNvKsmfdG6zrbzNBVN8DETyLra3ond61saU9C52YR',
        fee: 5000,
        status: 'pending',
        actions: [],
        outputs: [
          { toAddress: 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY', amount: '9007199254740992' },
          { toAddress: 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY', amount: '1' }
        ]
      } as any);

      ChainService.get('sol').selectTxInputs(server as any, txp, {} as any, {}, err => {
        should.exist(err);
        err.code.should.equal('INSUFFICIENT_FUNDS');
        done();
      });
    });
  });
});
