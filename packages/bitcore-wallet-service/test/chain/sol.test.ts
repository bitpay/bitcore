'use strict';

import * as chai from 'chai';
import sinon from 'sinon';
import { ChainService } from '../../src/lib/chain';
import { Defaults } from '../../src/lib/common/defaults';
import { ClientError } from '../../src/lib/errors/clienterror';

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
    const sol = ChainService.get('sol');
    const wallet = { chain: 'sol', network: 'livenet' };
    const fee = 5000;
    let checkTxCalled;

    beforeEach(function() {
      checkTxCalled = false;
      sinon.stub(sol, 'checkTx').callsFake(() => {
        checkTxCalled = true;
        return null;
      });
    });

    afterEach(function() {
      sinon.restore();
    });

    // Token balance is returned when tokenAddress is passed, native SOL balance otherwise
    const makeServer = ({ native, token }: { native: any; token?: any }) => ({
      getBalance: (opts, cb) => cb(null, opts.tokenAddress ? token : native)
    });
    const balance = (total, available) => ({ totalAmount: total, availableAmount: available });
    const makeTxp = amount => ({ fee, getTotalAmount: () => amount });

    describe('SPL token', function() {
      const opts = { tokenAddress: 'mint' };

      it('should fail with INSUFFICIENT_SOL_FEE if the wallet has no SOL for the fee', function(done) {
        const server = makeServer({ token: balance(1e6, 1e6), native: balance(0, 0) });
        sol.selectTxInputs(server as any, makeTxp(5e5) as any, wallet as any, opts, err => {
          should.exist(err);
          err.should.be.instanceof(ClientError);
          err.code.should.equal('INSUFFICIENT_SOL_FEE');
          err.message.should.equal('Your linked SOL wallet does not have enough SOL for fee. RequiredFee: 5000');
          err.messageData.should.deep.equal({ requiredFee: fee });
          checkTxCalled.should.equal(false);
          done();
        });
      });

      it('should fail with LOCKED_SOL_FEE if the SOL for the fee is locked', function(done) {
        const server = makeServer({ token: balance(1e6, 1e6), native: balance(1e7, 1000) });
        sol.selectTxInputs(server as any, makeTxp(5e5) as any, wallet as any, opts, err => {
          should.exist(err);
          err.should.be.instanceof(ClientError);
          err.code.should.equal('LOCKED_SOL_FEE');
          err.messageData.should.deep.equal({ requiredFee: fee });
          checkTxCalled.should.equal(false);
          done();
        });
      });

      it('should still fail with INSUFFICIENT_FUNDS when the token balance is short', function(done) {
        const server = makeServer({ token: balance(1e5, 1e5), native: balance(1e9, 1e9) });
        sol.selectTxInputs(server as any, makeTxp(5e5) as any, wallet as any, opts, err => {
          should.exist(err);
          err.code.should.equal('INSUFFICIENT_FUNDS');
          done();
        });
      });

      it('should pass when both the token and the SOL fee are covered', function(done) {
        const server = makeServer({ token: balance(1e6, 1e6), native: balance(1e9, 1e9) });
        sol.selectTxInputs(server as any, makeTxp(5e5) as any, wallet as any, opts, err => {
          should.not.exist(err);
          checkTxCalled.should.equal(true);
          done();
        });
      });
    });

    describe('native SOL', function() {
      it('should fail with INSUFFICIENT_FUNDS_FOR_FEE if the amount fits but the fee does not', function(done) {
        const amount = 1e9;
        const server = makeServer({ native: balance(amount + Defaults.MIN_SOL_BALANCE, amount) });
        sol.selectTxInputs(server as any, makeTxp(amount) as any, wallet as any, {}, err => {
          should.exist(err);
          err.should.be.instanceof(ClientError);
          err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
          err.message.should.equal('Insufficient funds for fee. RequiredFee: 5000');
          err.messageData.should.deep.equal({ requiredFee: fee });
          checkTxCalled.should.equal(false);
          done();
        });
      });

      it('should still fail with INSUFFICIENT_FUNDS when the amount does not fit', function(done) {
        const server = makeServer({ native: balance(1e9, 1e9) });
        sol.selectTxInputs(server as any, makeTxp(2e9) as any, wallet as any, {}, err => {
          should.exist(err);
          err.code.should.equal('INSUFFICIENT_FUNDS');
          done();
        });
      });

      it('should pass when the amount and fee are covered', function(done) {
        const amount = 1e9;
        const server = makeServer({ native: balance(2e9, amount + fee) });
        sol.selectTxInputs(server as any, makeTxp(amount) as any, wallet as any, {}, err => {
          should.not.exist(err);
          checkTxCalled.should.equal(true);
          done();
        });
      });
    });
  });
});
