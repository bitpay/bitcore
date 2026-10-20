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

  describe('#onTx', function() {
    const token = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const sender = '0xC877cBCF020A8AA259A1Efab1559B2A3A7259086';
    const recipient = '0x37D3bCDA9d7d5Dc41e32DAd77a5BA89a77aA8BD0';
    const multisig = '0x9527a556f0D9AA753dE0D1f9Ad024a17dd281B1D';
    // a tx event as bitcore-node emits it to the wallets room
    const tx = (fields = {}) => ({ chain: 'ETH', network: 'mainnet', txid: '0x01', to: token, from: sender, value: 0, ...fields });
    // effects as bitcore-node builds them
    const erc20 = { type: 'ERC20:transfer', to: recipient, from: sender, amount: '1000000', contractAddress: token, callStack: '' };
    const internal = { to: recipient, from: sender, amount: '2000', callStack: '0' };
    const multisigEffect = type => ({ type, to: recipient, from: sender, amount: '3000', contractAddress: multisig, callStack: '' });

    it('notifies the tx recipient and value for a tx without effects', function() {
      ChainService.onTx('eth', tx({ to: recipient, value: 5000 })).should.deep.equal({
        txid: '0x01',
        out: { address: recipient, amount: 5000, tokenAddress: undefined, multisigContractAddress: undefined }
      });
      ChainService.onTx('eth', tx({ to: recipient, value: 5000, effects: [] })).out.should.deep.equal({
        address: recipient, amount: 5000, tokenAddress: undefined, multisigContractAddress: undefined
      });
    });

    it('notifies the recipient of an internal value transfer', function() {
      ChainService.onTx('eth', tx({ effects: [internal] })).out.should.deep.equal({
        address: recipient, amount: '2000', tokenAddress: undefined, multisigContractAddress: undefined
      });
    });

    for (const type of ['MULTISIG:confirmTransaction', 'MULTISIG:submitTransaction']) {
      it(`notifies the recipient of a ${type} with its multisig contract`, function() {
        ChainService.onTx('eth', tx({ effects: [internal, multisigEffect(type)] })).out.should.deep.equal({
          address: recipient, amount: '3000', tokenAddress: undefined, multisigContractAddress: multisig
        });
      });
    }

    it('prefers a multisig effect to an ERC20 transfer', function() {
      ChainService.onTx('eth', tx({ effects: [erc20, multisigEffect('MULTISIG:submitTransaction')] })).out.should.deep.equal({
        address: recipient, amount: '3000', tokenAddress: undefined, multisigContractAddress: multisig
      });
    });

    it('falls back to the tx recipient for effects it does not know', function() {
      const other = { type: 'OTHER:call', to: recipient, from: sender, amount: '1', contractAddress: token, callStack: '' };
      ChainService.onTx('eth', tx({ effects: [other] })).out.should.deep.equal({
        address: token, amount: 0, tokenAddress: undefined, multisigContractAddress: undefined
      });
    });

    it('handles MATIC txs the same way', function() {
      ChainService.onTx('matic', tx({ chain: 'MATIC', to: recipient, value: 5000 })).out.should.deep.equal({
        address: recipient, amount: 5000, tokenAddress: undefined, multisigContractAddress: undefined
      });
    });
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

