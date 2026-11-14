'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import util from 'util';
import sinon from 'sinon';
import { WalletService } from '../../src/lib/server';
import { Storage } from '../../src/lib/storage';
import * as TestData from '../testdata';
import helpers from './helpers';

const should = chai.should();

const TOKEN_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const TO_ADDRESS = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';
// The fields getStatus leaves out of the wallet and of each copayer unless includeExtendedInfo is set
const WALLET_EXTENDED_KEYS = ['publicKeyRing', 'pubKey', 'addressManager'];
const COPAYER_EXTENDED_KEYS = ['xPubKey', 'requestPubKey', 'signature', 'addressManager', 'customData'];
const omit = (obj, keys: string[]) => Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));

describe('Wallet reads', function() {
  let blockchainExplorer;
  let storage: Storage;

  before(async function() {
    ({ blockchainExplorer, storage } = await helpers.before());
  });

  beforeEach(async function() {
    await helpers.beforeEach();
  });

  afterEach(function() {
    sinon.restore();
  });

  after(async function() {
    await helpers.after();
  });

  const call = (server: WalletService, method: string, opts = {}) => util.promisify(server[method]).call(server, opts);
  // The wallet document as stored, as plain JSON
  const storedWallet = async (walletId: string) => JSON.parse(JSON.stringify(await util.promisify(storage.fetchWallet).call(storage, walletId)));
  const createTx = (server, amount, message = 'some message') => helpers.createAndPublishTx(
    server,
    { outputs: [{ toAddress: TO_ADDRESS, amount }], feePerKb: 100e2, message },
    TestData.copayers[0].privKey_1H_0
  );
  const sign = (server, txp, copayer = 0) => call(server, 'signTx', {
    txProposalId: txp.id,
    signatures: helpers.clientSign(txp, TestData.copayers[copayer].xPrivKey_44H_0H_0H)
  });

  // Returns a function that counts the wallet's reads since this was called
  const countWalletReads = (walletId: string) => {
    const fetchWallet = sinon.spy(storage, 'fetchWallet');
    return () => fetchWallet.getCalls().filter(c => c.args[0] === walletId).length;
  };

  describe('getStatus', function() {
    it('returns the stored wallet without the extended fields', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 2);
      await call(server, 'getStatus'); // registers the wallet
      const status = await call(server, 'getStatus');

      const expected: any = omit(await storedWallet(wallet.id), WALLET_EXTENDED_KEYS);
      expected.copayers = expected.copayers.map(copayer => omit(copayer, COPAYER_EXTENDED_KEYS));
      JSON.parse(JSON.stringify(status.wallet)).should.deep.equal(expected);
    });

    it('returns the stored wallet with the extended fields, and only the caller\'s customData', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 2);
      await call(server, 'getStatus');
      const status = await call(server, 'getStatus', { includeExtendedInfo: true });

      const expected = await storedWallet(wallet.id);
      expected.copayers = expected.copayers.map(copayer => copayer.id == server.copayerId ? copayer : omit(copayer, ['customData']));
      JSON.parse(JSON.stringify(status.wallet)).should.deep.equal(expected);
      status.wallet.copayers.find(c => c.id == server.copayerId).customData.should.equal('custom data 1');
    });

    for (const includeExtendedInfo of [false, true]) {
      it(`keeps every copayer's customData in storage when a status registers the wallet (includeExtendedInfo: ${includeExtendedInfo})`, async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 2);
        (await storedWallet(wallet.id)).beRegistered.should.equal(false);

        await call(server, 'getStatus', { includeExtendedInfo });

        blockchainExplorer.register.calledOnce.should.equal(true);
        const stored = await storedWallet(wallet.id);
        stored.beRegistered.should.equal(true);
        stored.copayers.map(c => c.customData).should.deep.equal(['custom data 1', 'custom data 2']);
        stored.should.not.have.property('tokenAddress');
        stored.should.not.have.property('multisigContractAddress');
      });
    }

    it('keeps a token status and a native status of one wallet apart when they run together', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' });
      await call(server, 'createAddress');
      await helpers.stubUtxos(server, wallet, [1], { tokenAddress: TOKEN_ADDRESS });
      // the token address each balance call saw, read when it was made
      const seen = [];
      const getBalance = blockchainExplorer.getBalance;
      sinon.stub(blockchainExplorer, 'getBalance').callsFake((w, cb) => {
        seen.push(w.tokenAddress || null);
        return getBalance(w, cb);
      });

      const [native, token] = await Promise.all([
        call(server, 'getStatus'),
        call(server, 'getStatus', { tokenAddress: TOKEN_ADDRESS })
      ]);

      native.balance.totalAmount.should.equal(1e18);
      token.balance.totalAmount.should.equal(2e6);
      seen.sort().should.deep.equal([null, TOKEN_ADDRESS].sort());
    });

    it('keeps the token address the balance step sets out of the returned and the stored wallet', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' });
      await call(server, 'createAddress');
      await helpers.stubUtxos(server, wallet, [1], { tokenAddress: TOKEN_ADDRESS });
      // an unregistered wallet, so the balance step stores its copy
      await storage.db.collection(Storage.collections.WALLETS).updateOne({ id: wallet.id }, { $set: { beRegistered: false } });

      const status = await call(server, 'getStatus', { tokenAddress: TOKEN_ADDRESS, includeExtendedInfo: true });

      status.balance.totalAmount.should.equal(2e6);
      status.wallet.should.not.have.property('tokenAddress');
      status.wallet.should.not.have.property('multisigContractAddress');
      const stored = await storedWallet(wallet.id);
      stored.beRegistered.should.equal(true);
      stored.should.not.have.property('tokenAddress');
      JSON.parse(JSON.stringify(status.wallet)).should.deep.equal({ ...stored, beRegistered: status.wallet.beRegistered });
    });

    it('counts pending txps as locked and the inputs of broadcast txps as spent', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
      await helpers.stubUtxos(server, wallet, [1, 2]);
      const broadcast = await sign(server, await createTx(server, 1.5e8));
      helpers.stubBroadcast(broadcast.txid);
      await call(server, 'broadcastTx', { txProposalId: broadcast.id });
      const pending = await createTx(server, 0.5e8);

      const status = await call(server, 'getStatus');

      const sum = inputs => inputs.reduce((total, input) => total + input.satoshis, 0);
      status.balance.totalAmount.should.equal(3e8 - sum(broadcast.inputs));
      status.balance.lockedAmount.should.equal(sum(pending.inputs));
      status.pendingTxps.map(t => t.id).should.deep.equal([pending.id]);
    });

    it('adds the creator\'s and the copayers\' names to pending txps', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(2, 3);
      await helpers.stubUtxos(server, wallet, [1]);
      const txp = await createTx(server, 0.5e8);
      const server2 = await helpers.getAuthServer(wallet.copayers[1].id);
      await sign(server2, txp, 1);

      const status = await call(server, 'getStatus');

      status.pendingTxps.length.should.equal(1);
      const [pending] = status.pendingTxps;
      pending.creatorName.should.equal('copayer 1');
      pending.actions.map(a => [a.type, a.copayerName]).should.deep.equal([['accept', 'copayer 2']]);
      pending.derivationStrategy.should.equal('BIP44');
      should.not.exist(pending.raw);
    });

    it('adds the raw tx to accepted pending txps', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 2);
      await helpers.stubUtxos(server, wallet, [1]);
      const signed = await sign(server, await createTx(server, 0.5e8));

      const status = await call(server, 'getStatus');

      status.pendingTxps.length.should.equal(1);
      status.pendingTxps[0].status.should.equal('accepted');
      status.pendingTxps[0].raw.should.equal(signed.getRawTx());
    });

    it('falls back to BIP45 for txps of a wallet stored without a derivation strategy', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
      await helpers.stubUtxos(server, wallet, [1]);
      await createTx(server, 0.5e8);
      await storage.db.collection(Storage.collections.WALLETS).updateOne({ id: wallet.id }, { $unset: { derivationStrategy: '' } });

      const status = await call(server, 'getStatus');

      status.pendingTxps[0].derivationStrategy.should.equal('BIP45');
    });

    it('migrates an old BCH wallet to cash addresses', async function() {
      const { server } = await helpers.createAndJoinWallet(1, 1, { coin: 'bch', earlyRet: true, nativeCashAddr: false });
      (await storedWallet(server.walletId)).nativeCashAddr.should.equal(false);

      const status = await call(server, 'getStatus');

      status.wallet.nativeCashAddr.should.equal(true);
      (await storedWallet(server.walletId)).nativeCashAddr.should.equal(true);
    });

    describe('wallet reads', function() {
      it('reads the wallet once for a UTXO wallet with pending and broadcast txps', async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
        await helpers.stubUtxos(server, wallet, [1, 1, 1]);
        const broadcast = await sign(server, await createTx(server, 0.5e8));
        helpers.stubBroadcast(broadcast.txid);
        await call(server, 'broadcastTx', { txProposalId: broadcast.id });
        await createTx(server, 0.5e8);
        await sign(server, await createTx(server, 0.5e8)); // accepted, not yet broadcast

        const reads = countWalletReads(wallet.id);
        await call(server, 'getStatus');
        reads().should.equal(1);
      });

      it('reads the wallet once for an account-based wallet', async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' });
        await call(server, 'createAddress');
        await helpers.stubUtxos(server, wallet, [1]);

        const reads = countWalletReads(wallet.id);
        await call(server, 'getStatus');
        reads().should.equal(1);
      });

      it('reads the wallet once when the status registers the wallet', async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 2);
        (await storedWallet(wallet.id)).beRegistered.should.equal(false);

        const reads = countWalletReads(wallet.id);
        await call(server, 'getStatus');
        reads().should.equal(1);
        blockchainExplorer.register.calledOnce.should.equal(true);
      });

      it('migrates an old BCH wallet once', async function() {
        const { server } = await helpers.createAndJoinWallet(1, 1, { coin: 'bch', earlyRet: true, nativeCashAddr: false });
        const migrate = sinon.spy(storage, 'migrateToCashAddr');
        await call(server, 'getStatus');
        migrate.callCount.should.equal(1);
      });
    });

    describe('errors', function() {
      it('fails with UPGRADE_NEEDED for a SOL wallet and an old client', async function() {
        const { server } = await helpers.createAndJoinWallet(1, 1, { coin: 'sol' });
        server.clientVersion = 'bwc-10.10.0';
        const err = await call(server, 'getStatus').catch(e => e);
        err.code.should.equal('UPGRADE_NEEDED');
      });

      it('fails with WALLET_NOT_FOUND when the wallet is gone', async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
        await storage.db.collection(Storage.collections.WALLETS).deleteOne({ id: wallet.id });
        const err = await call(server, 'getStatus').catch(e => e);
        err.code.should.equal('WALLET_NOT_FOUND');
      });

      it('passes on a storage error reading the wallet', async function() {
        const { server } = await helpers.createAndJoinWallet(1, 1);
        sinon.stub(server.storage, 'fetchWallet').callsArgWith(1, new Error('wallet read failed'));
        const err = await call(server, 'getStatus').catch(e => e);
        err.message.should.equal('wallet read failed');
      });

      it('passes on a storage error reading the pending txps', async function() {
        const { server } = await helpers.createAndJoinWallet(1, 1);
        sinon.stub(server.storage, 'fetchPendingTxs').callsArgWith(1, new Error('pending read failed'));
        const err = await call(server, 'getStatus').catch(e => e);
        err.message.should.equal('pending read failed');
      });

      it('passes on a storage error reading the preferences', async function() {
        const { server } = await helpers.createAndJoinWallet(1, 1);
        sinon.stub(server.storage, 'fetchPreferences').callsArgWith(2, new Error('preferences read failed'));
        const err = await call(server, 'getStatus').catch(e => e);
        err.message.should.equal('preferences read failed');
      });

      it('passes on a balance error, with or without includeExtendedInfo', async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
        await helpers.stubUtxos(server, wallet, [1]);
        sinon.stub(blockchainExplorer, 'getUtxos').callsArgWith(2, new Error('utxos failed'));
        for (const includeExtendedInfo of [false, true]) {
          const err = await call(server, 'getStatus', { includeExtendedInfo }).catch(e => e);
          err.message.should.equal('utxos failed');
        }
      });

      it('returns no balance for a wallet that needs a scan only with includeExtendedInfo', async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
        await storage.db.collection(Storage.collections.WALLETS).updateOne({ id: wallet.id }, { $set: { scanStatus: 'error' } });

        const err = await call(server, 'getStatus').catch(e => e);
        err.code.should.equal('WALLET_NEED_SCAN');

        const status = await call(server, 'getStatus', { includeExtendedInfo: true });
        should.exist(status.wallet);
        should.not.exist(status.balance);
      });
    });
  });

  describe('tx and note decoration', function() {
    let server: WalletService;
    let server2: WalletService;
    let txp;

    // A 1-of-2 wallet with one broadcast txp, and a note on its txid edited by the second copayer
    beforeEach(async function() {
      let wallet;
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 2));
      await helpers.stubUtxos(server, wallet, [1, 1]);
      txp = await sign(server, await createTx(server, 0.5e8));
      helpers.stubBroadcast(txp.txid);
      await call(server, 'broadcastTx', { txProposalId: txp.id });
      server2 = await helpers.getAuthServer(wallet.copayers[1].id);
      await call(server2, 'editTxNote', { txid: txp.txid, body: 'a note' });
    });

    const expectDecorated = tx => {
      tx.creatorName.should.equal('copayer 1');
      tx.actions.map(a => [a.type, a.copayerName]).should.deep.equal([['accept', 'copayer 1']]);
      tx.note.body.should.equal('a note');
      tx.note.editedByName.should.equal('copayer 2');
    };

    it('getTx adds the names and the note', async function() {
      const tx = await call(server, 'getTx', { txProposalId: txp.id });
      expectDecorated(tx);
      tx.derivationStrategy.should.equal('BIP44');
    });

    it('getTxByHash adds the names and the note', async function() {
      const tx = await call(server, 'getTxByHash', { txid: txp.txid });
      expectDecorated(tx);
    });

    it('getTxHistory adds the proposal and the note to the matching tx', async function() {
      helpers.stubHistory(0, 1000, [{
        txid: txp.txid,
        category: 'send',
        satoshis: 0.5e8,
        fee: 1000,
        height: 900,
        address: TO_ADDRESS,
        outputs: [{ address: TO_ADDRESS, amount: 0.5e8 }],
        // proposals are matched within days of the tx's time, so it has to be recent
        blockTime: new Date().toISOString()
      }]);

      const history = await call(server, 'getTxHistory');

      history.length.should.equal(1);
      const [tx] = history;
      tx.proposalId.should.equal(txp.id);
      tx.creatorName.should.equal('copayer 1');
      tx.message.should.equal('some message');
      tx.actions.map(a => [a.type, a.copayerName]).should.deep.equal([['accept', 'copayer 1']]);
      tx.note.body.should.equal('a note');
      tx.note.editedByName.should.equal('copayer 2');
    });

    it('getTx reads the wallet once', async function() {
      const reads = countWalletReads(server.walletId);
      await call(server, 'getTx', { txProposalId: txp.id });
      reads().should.equal(1);
    });

    it('getTxByHash reads the wallet once', async function() {
      const reads = countWalletReads(server.walletId);
      await call(server, 'getTxByHash', { txid: txp.txid });
      reads().should.equal(1);
    });

    it('getTxHistory reads the wallet once', async function() {
      helpers.stubHistory(0, 1000, [{
        txid: txp.txid, category: 'send', satoshis: 0.5e8, fee: 1000, height: 900, address: TO_ADDRESS,
        outputs: [{ address: TO_ADDRESS, amount: 0.5e8 }], blockTime: new Date().toISOString()
      }]);
      const reads = countWalletReads(server.walletId);
      const history = await call(server, 'getTxHistory');
      should.exist(history[0].proposalId);
      reads().should.equal(1);
    });

    it('getTx and getTxByHash fail with TX_NOT_FOUND for an unknown tx', async function() {
      for (const [method, opts] of [['getTx', { txProposalId: 'unknown' }], ['getTxByHash', { txid: 'unknown' }]] as Array<[string, object]>) {
        const err: any = await call(server, method, opts).catch(e => e);
        err.code.should.equal('TX_NOT_FOUND');
      }
    });

    it('getTx returns a txp that has not been broadcast, without a note', async function() {
      const pending = await createTx(server, 0.1e8);
      const tx = await call(server, 'getTx', { txProposalId: pending.id });
      tx.id.should.equal(pending.id);
      tx.creatorName.should.equal('copayer 1');
      should.not.exist(tx.txid);
      should.not.exist(tx.note);
    });

    const byIdAndHash = () => [['getTx', { txProposalId: txp.id }], ['getTxByHash', { txid: txp.txid }]] as Array<[string, object]>;

    it('getTx and getTxByHash pass on a storage error reading the wallet, after one read', async function() {
      const fetchWallet = sinon.stub(storage, 'fetchWallet').callsArgWith(1, new Error('wallet read failed'));
      for (const [method, opts] of byIdAndHash()) {
        fetchWallet.resetHistory();
        const err: any = await call(server, method, opts).catch(e => e);
        err.message.should.equal('wallet read failed');
        fetchWallet.callCount.should.equal(1, method);
      }
    });

    it('getTx and getTxByHash pass on a storage error looking up the tx', async function() {
      sinon.stub(storage, 'fetchTx').callsArgWith(2, new Error('tx read failed'));
      sinon.stub(storage, 'fetchTxByHashForWallet').callsArgWith(2, new Error('tx read failed'));
      for (const [method, opts] of byIdAndHash()) {
        const err: any = await call(server, method, opts).catch(e => e);
        err.message.should.equal('tx read failed', method);
      }
    });

    it('getTx and getTxByHash return the tx without its note when the note read fails', async function() {
      sinon.stub(storage, 'fetchTxNote').callsArgWith(2, new Error('note read failed'));
      for (const [method, opts] of byIdAndHash()) {
        const tx = await call(server, method, opts);
        tx.id.should.equal(txp.id);
        should.not.exist(tx.note);
      }
    });

    it('getTxByHash returns a tx that has no txid as it is', async function() {
      // A tx found by its hash always has a txid; the stub covers the guard for one that doesn't
      const tx = await util.promisify(storage.fetchTx).call(storage, server.walletId, txp.id);
      tx.txid = undefined;
      sinon.stub(storage, 'fetchTxByHashForWallet').callsFake((walletId, hash, cb) => cb(null, tx));
      const fetchTxNote = sinon.spy(storage, 'fetchTxNote');

      const result = await call(server, 'getTxByHash', { txid: txp.txid });

      result.id.should.equal(txp.id);
      fetchTxNote.called.should.equal(false);
    });

    it('each storage fetch completes from the wallet it is given, without reading it', async function() {
      // A copy of the wallet with renamed copayers shows which wallet the names came from
      const given = await util.promisify(storage.fetchWallet).call(storage, server.walletId);
      for (const copayer of given.copayers) copayer.name = 'given ' + copayer.name;
      const fetchWallet = sinon.spy(storage, 'fetchWallet');
      const walletId = server.walletId;
      const pending = await createTx(server, 0.1e8);
      fetchWallet.resetHistory();

      const fetches: Array<[string, (cb) => void, (result) => string[]]> = [
        ['fetchTx', cb => storage.fetchTx(walletId, txp.id, cb, given), tx => [tx.creatorName]],
        ['fetchTxByHashForWallet', cb => storage.fetchTxByHashForWallet(walletId, txp.txid, cb, given), tx => [tx.creatorName]],
        ['fetchPendingTxs', cb => storage.fetchPendingTxs(walletId, cb, given), txs => txs.map(t => t.creatorName)],
        ['fetchTxs', cb => storage.fetchTxs(walletId, {}, cb, given), txs => txs.map(t => t.creatorName)],
        ['fetchBroadcastedTxs', cb => storage.fetchBroadcastedTxs(walletId, {}, cb, given), txs => txs.map(t => t.creatorName)],
        ['fetchTxNote', cb => storage.fetchTxNote(walletId, txp.txid, cb, given), note => [note.editedByName]],
        ['fetchTxNotes', cb => storage.fetchTxNotes(walletId, {}, cb, given), notes => notes.map(n => n.editedByName)]
      ];
      for (const [name, fetch, names] of fetches) {
        const result = await util.promisify(fetch)();
        const got = names(result);
        got.length.should.be.above(0, name);
        got.every(n => n.startsWith('given ')).should.equal(true, name);
      }
      fetchWallet.callCount.should.equal(0);
      should.exist(pending);
    });

    it('a storage error reading the wallet fails each completion', async function() {
      sinon.stub(storage, 'fetchWallet').callsArgWith(1, new Error('wallet read failed'));
      for (const run of [
        cb => storage.fetchTx(server.walletId, txp.id, cb),
        cb => storage.fetchTxNote(server.walletId, txp.txid, cb)
      ]) {
        const err: any = await util.promisify(run)().catch(e => e);
        err.message.should.equal('wallet read failed');
      }
    });
  });
});
