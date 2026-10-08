'use strict';

import * as chai from 'chai';
import { ChainService } from '../../src/lib/chain';
import { Defaults } from '../../src/lib/common/defaults';
import { TxProposal } from '../../src/lib/model/txproposal';

const should = chai.should();

describe('Chain SOL', function() {
  describe('#getWalletBalance', function() {
    const cases = [
      { name: 'pending amounts and fees', amount: 1000000000, txps: [{ amount: '2000000000', fee: '5000' }], reserve: 1002240, locked: 2001007240, available: -1001007240 },
      { name: 'dust below rent', amount: 10000, txps: [], reserve: 1002240, locked: 1002240, available: -992240 },
      { name: 'an empty account with a pending proposal', amount: 0, txps: [{ amount: '2000000000', fee: '5000' }], reserve: 0, locked: 2000005000, available: -2000005000 },
      { name: 'an SPL balance', amount: 1000000, txps: [{ tokenAddress: 'mint', amount: '500000', fee: '5000' }], tokenAddress: 'mint', reserve: 0, locked: 500000, available: 500000 }
    ];

    for (const c of cases) {
      it('should expose the reserve separately for ' + c.name, function(done) {
        const server = {
          walletId: '1',
          _getBlockchainExplorer: () => ({
            getBalance: (_wallet, cb) => cb(null, { balance: c.amount, confirmed: c.amount }),
            getRentMinimum: (_space, cb) => cb(null, Defaults.MIN_SOL_BALANCE)
          }),
          getPendingTxs: (_opts, cb) => cb(null, c.txps),
          storage: { fetchAddresses: (_walletId, cb) => cb(null, []) }
        };
        const wallet = { chain: 'sol', network: 'livenet' };

        ChainService.get('sol').getWalletBalance(server as any, wallet as any, { tokenAddress: (c as { tokenAddress?: string }).tokenAddress }, (err, balance) => {
          should.not.exist(err);
          balance.should.deep.equal({
            totalAmount: c.amount,
            totalConfirmedAmount: c.amount,
            lockedAmount: c.locked,
            lockedConfirmedAmount: c.locked,
            reserve: c.reserve,
            availableAmount: c.available,
            availableConfirmedAmount: c.available,
            byAddress: []
          });
          done();
        });
      });
    }
  });

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
