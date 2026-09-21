'use strict';

import chai from 'chai';
import sinon from 'sinon';
import { createRequire } from 'module';
import { Transactions } from '@bitpay-labs/crypto-wallet-core';
import { TxProposal } from '@bitpay-labs/bitcore-wallet-service/ts_build/src/lib/model/txproposal';
import { Storage } from '@bitpay-labs/bitcore-wallet-service/ts_build/src/lib/storage';
import { Key } from '../src/lib/key';
import { Utils } from '../src/lib/common';
import { Verifier } from '../src/lib/verifier';

const { WalletService } = createRequire(__filename)('@bitpay-labs/bitcore-wallet-service/ts_build/src/lib/server');

const should = chai.should();

describe('Number format signing', function() {
  const key = new Key({
    seedType: 'mnemonic',
    seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  });
  const credentials = key.createCredentials(null, { chain: 'eth', network: 'livenet', account: 0, n: 1 });
  credentials.addWalletInfo('number-format-wallet', 'Number format wallet', 1, 1, 'Copayer');
  credentials.addPublicKeyRing([{
    xPubKey: credentials.xPubKey,
    requestPubKey: credentials.requestPubKey
  }]);
  const rootPath = key.getBaseAddressDerivationPath({ chain: 'eth', account: 0, n: 1 });
  const formats = ['number', 'string', 'hex', undefined] as const;
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  function createTxp(overrides: any = {}) {
    const txp = TxProposal.create({
      walletId: credentials.walletId,
      creatorId: credentials.copayerId,
      chain: 'eth',
      coin: 'eth',
      network: 'livenet',
      walletM: 1,
      walletN: 1,
      addressType: 'P2PKH',
      from: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
      nonce: 5,
      gasPrice: 25000000000,
      gasLimit: 60000,
      fee: 1500000000000000,
      tokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      outputs: [{
        toAddress: '0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8',
        amount: '70000000000000010',
        gasLimit: 60000
      }],
      ...overrides
    });
    txp.status = 'pending';
    txp.proposalSignature = Utils.signMessage(Utils.buildTx(txp).uncheckedSerialize(), credentials.requestPrivKey);
    return txp;
  }

  function createStorage() {
    const storage = new Storage();
    const wallet: any = {
      id: credentials.walletId,
      chain: 'eth',
      network: 'livenet',
      getCopayer: () => ({
        name: 'Copayer',
        xPubKey: credentials.xPubKey,
        requestPubKeys: [{ key: credentials.requestPubKey }]
      })
    };
    sandbox.stub(storage, 'fetchWallet').callsFake((_walletId, cb) => cb(null, wallet));
    return { storage, wallet };
  }

  for (const readFormat of formats) {
    for (const signFormat of formats) {
      it(`should sign ERC20 read as ${readFormat} using ${signFormat} and rebuild the persisted transaction`, async function() {
        const txp = createTxp();
        const unsignedRaw = txp.getRawTx();
        const returned = TxProposal.formatNumbers(txp, readFormat as any);
        Verifier.checkTxProposalSignature(credentials, returned).should.be.true;
        Utils.buildTx(returned).uncheckedSerialize().should.deep.equal(unsignedRaw);
        const signatures = await key.sign(rootPath, returned);

        txp.sign(credentials.copayerId, signatures, credentials.xPubKey, signFormat).should.be.true;
        txp.status.should.equal('accepted');
        const signedRaw = txp.raw;
        const txid = txp.txid;
        Transactions.getHash({ chain: 'ETH', tx: signedRaw[0] }).should.equal(txid);
        const reloaded = TxProposal.fromObj(txp.toObject());
        should.not.exist(reloaded.raw);
        reloaded.getRawTx().should.deep.equal(signedRaw);
        reloaded.getRawTx().should.deep.equal(signedRaw);

        const { storage } = createStorage();
        const completed = await new Promise<TxProposal>((resolve, reject) => {
          storage._completeTxData(credentials.walletId, reloaded, (err, result) => {
            if (err) return reject(err);
            resolve(result as TxProposal);
          });
        });
        completed.raw.should.deep.equal(signedRaw);
        completed.txid.should.equal(txid);
      });
    }
  }

  it('should reject a signature whose format rebuilds a different tx than broadcast sends', async function() {
    const txp = createTxp({
      tokenAddress: undefined,
      outputs: [{
        toAddress: '0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8',
        amount: '70000000000000008',
        gasLimit: 21000
      }]
    });
    const returned = txp;
    const clientRaw = Utils.buildTx(returned).uncheckedSerialize();
    txp.getRawTx('number').should.not.deep.equal(clientRaw);
    Verifier.checkTxProposalSignature(credentials, returned).should.be.true;
    const signatures = await key.sign(rootPath, returned);

    txp.sign(credentials.copayerId, signatures, credentials.xPubKey, 'number').should.be.false;
    txp.status.should.equal('pending');
    should.not.exist(txp.raw);

    txp.sign(credentials.copayerId, signatures, credentials.xPubKey).should.be.true;
    const persisted = txp.toObject();
    Transactions.getHash({ chain: 'ETH', tx: persisted.raw[0] }).should.equal(persisted.txid);
    TxProposal.fromObj(persisted).getRawTx().should.deep.equal(persisted.raw);
  });

  it('should rebuild a different native ETH tx when a number amount is read as hex', function() {
    const txp = createTxp({
      tokenAddress: undefined,
      outputs: [{
        toAddress: '0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8',
        amount: Number('70000000000000010'),
        gasLimit: 21000
      }]
    });
    const returned = TxProposal.formatNumbers(txp, 'hex');

    Utils.buildTx(returned).uncheckedSerialize().should.not.deep.equal(txp.getRawTx());
    Verifier.checkTxProposalSignature(credentials, returned).should.be.false;
    Verifier.checkTxProposalSignature(credentials, txp).should.be.true;
  });

  for (const [label, tokenAddress] of [
    ['native ETH', undefined],
    ['ERC20', '0x6B175474E89094C44Da98b954EedeAC495271d0F']
  ] as const) {
    it(`should verify a ${label} proposal whose amount the client sent as a number`, function() {
      const amount = Number('70000000000000010');
      const sent = {
        walletId: credentials.walletId,
        creatorId: credentials.copayerId,
        chain: 'eth',
        coin: 'eth',
        network: 'livenet',
        walletM: 1,
        walletN: 1,
        addressType: 'P2PKH',
        from: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
        nonce: 5,
        gasPrice: 25000000000,
        gasLimit: 60000,
        fee: 1500000000000000,
        tokenAddress,
        outputs: [{
          toAddress: '0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8',
          amount,
          gasLimit: 60000
        }]
      };
      const clientRaw = Utils.buildTx({ ...sent, version: 3 } as any).uncheckedSerialize();

      const txp = TxProposal.create(sent);
      txp.status = 'pending';
      txp.proposalSignature = Utils.signMessage(clientRaw, credentials.requestPrivKey);

      txp.outputs[0].amount.should.equal(amount);
      txp.getRawTx().should.deep.equal(clientRaw);
      Verifier.checkTxProposalSignature(credentials, txp).should.be.true;
    });
  }

  it('should preserve native ETH exact strings through real publish, sign, storage and broadcast methods', async function() {
    const txp = createTxp({
      tokenAddress: undefined,
      outputs: [{
        toAddress: '0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8',
        amount: '70000000000000008',
        gasLimit: 21000
      }]
    });
    txp.status = 'temporary';
    const { storage, wallet } = createStorage();
    let persisted = txp.toObject();
    const storedStates = [];
    storage.db = {
      collection: () => ({
        findOne: (_filter, cb) => cb(null, JSON.parse(JSON.stringify(persisted))),
        replaceOne: (_filter, stored, _opts, cb) => {
          persisted = JSON.parse(JSON.stringify(stored));
          storedStates.push(stored.status);
          cb();
        }
      })
    } as any;
    const server = Object.create(WalletService.prototype);
    server.walletId = credentials.walletId;
    server.copayerId = credentials.copayerId;
    server.storage = storage;
    server.lock = { runLocked: (_id, _opts, cb, task) => task(cb) };
    sandbox.stub(server, 'getWallet').callsFake((_opts, cb) => cb(null, wallet));
    sandbox.stub(storage, 'fetchTxNote').callsFake((_walletId, _id, cb) => cb(null, undefined));
    sandbox.stub(storage, 'fetchPendingTxs').callsFake((_walletId, cb) => cb(null, []));
    sandbox.stub(storage, 'storeTxConfirmationSub').callsFake((_sub, cb) => cb());
    sandbox.stub(server, '_notify').callsFake((_type, _data, _opts, cb) => cb?.());

    const published = await new Promise<TxProposal>((resolve, reject) => {
      server.publishTx({
        txProposalId: txp.id,
        proposalSignature: txp.proposalSignature,
      }, (err, result) => err ? reject(err) : resolve(result));
    });
    Verifier.checkTxProposalSignature(credentials, published).should.be.true;
    const signatures = await key.sign(rootPath, published);
    const signed = await new Promise<TxProposal>((resolve, reject) => {
      server.signTx({ txProposalId: txp.id, signatures }, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    const signedRaw = signed.raw;
    const txid = signed.txid;
    persisted.raw.should.deep.equal(signedRaw);
    persisted.outputs[0].amount.should.equal('70000000000000008');
    TxProposal.fromObj(persisted).getRawTx().should.deep.equal(signedRaw);

    const broadcast = sandbox.stub(server, '_broadcastRawTx').callsFake((_chain, _network, raw, cb) => {
      raw.should.deep.equal(signedRaw);
      Transactions.getHash({ chain: 'ETH', tx: raw[0] }).should.equal(txid);
      cb(null, txid);
    });

    await new Promise<void>((resolve, reject) => {
      server.broadcastTx({ txProposalId: txp.id }, err => err ? reject(err) : resolve());
    });
    broadcast.calledOnce.should.be.true;
    storedStates.should.deep.equal(['pending', 'accepted', 'broadcasted']);
    persisted.raw.should.deep.equal(signedRaw);
    persisted.txid.should.equal(txid);
  });
});
