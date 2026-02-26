import { ObjectId } from 'bson';
import { expect } from 'chai';
import sinon from 'sinon';
import { Readable } from 'stream';
import { CoinStorage } from '../../../src/models/coin';
import { MintOp, SpendOp, TaggedBitcoinTx, TransactionStorage, TxOp } from '../../../src/models/transaction';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { BitcoinTransaction, TransactionInput } from '../../../src/types/namespaces/Bitcoin';
import { TransactionFixture } from '../../fixtures/transaction.fixture';
import { mockStorage } from '../../helpers';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';
const bitcoreLib = require('bitcore-lib');

describe('Transaction Model', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  let sandbox = sinon.sandbox.create();
  let address = 'mjVf6sFjt9q6aLY7M21Ap6CPSWdaoNHSf1';
  this.timeout(500000);
  before(() => {
    mockStorage([]);
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should stream all the mint operations', async () => {
    const tx = bitcoreLib.Transaction(TransactionFixture.transaction) as BitcoinTransaction;
    let batches = 0;

    const mintStream = new Readable({ objectMode: true, read: () => {} });
    const done = new Promise(r =>
      mintStream
        .on('data', (mintOps: MintOp[]) => {
          batches++;
          let ops = mintOps;
          expect(ops.length).to.eq(1);
          expect(ops[0].updateOne.update.$set.address).to.eq(address);
        })
        .on('end', r)
    );

    await TransactionStorage.streamMintOps({
      chain: 'BTC',
      network: 'regtest',
      txs: [tx],
      height: 8534,
      mintStream,
      initialSyncComplete: true
    });
    await done;
    expect(batches).to.eq(1);
  });

  it('should batch large amount of transactions', async () => {
    const tx = bitcoreLib.Transaction(TransactionFixture.transaction) as BitcoinTransaction;
    let batches = 0;

    const mintStream = new Readable({ objectMode: true, read: () => {} });
    const done = new Promise(r =>
      mintStream
        .on('data', (mintOps: MintOp[]) => {
          batches++;
          let ops = mintOps;
          expect(ops.length).to.eq(50000);
        })
        .on('end', r)
    );

    await TransactionStorage.streamMintOps({
      chain: 'BTC',
      network: 'regtest',
      txs: new Array(100000).fill(tx),
      height: 8534,
      mintStream,
      initialSyncComplete: true
    });
    await done;
    expect(batches).to.eq(2);
  });

  it('should stream all the spend operations', async () => {
    const tx = bitcoreLib.Transaction(TransactionFixture.transaction) as BitcoinTransaction;
    let batches = 0;
    const CURRENT_HEIGHT = 8534;

    const spentStream = new Readable({ objectMode: true, read: () => {} });
    const done = new Promise(r =>
      spentStream
        .on('data', (spentOps: SpendOp[]) => {
          batches++;
          let ops = spentOps;
          expect(ops.length).to.eq(tx.inputs.length);
          expect(ops[0].updateOne.update.$set.spentHeight).to.eq(CURRENT_HEIGHT);
          expect(ops[0].updateOne.update.$set.spentTxid).to.eq(tx.hash);
        })
        .on('end', r)
    );

    await TransactionStorage.streamSpendOps({
      chain: 'BTC',
      network: 'regtest',
      txs: [tx],
      height: CURRENT_HEIGHT,
      spentStream
    });
    await done;
    expect(batches).to.eq(1);
  });

  describe('Wallet Tagging', async () => {
    const tx = bitcoreLib.Transaction(TransactionFixture.transaction) as TaggedBitcoinTx;
    const CURRENT_HEIGHT = 8534;
    const correctWalletId = new ObjectId('5d93abeba811051da3af9a35');

    it('should tag wallets on the mint ops first', async () => {
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().returnsThis(),
        project: sandbox.stub().returnsThis(),
        toArray: sandbox.stub().resolves([
          { wallet: correctWalletId, address },
          { wallet: new ObjectId('6d93abeba811051da3af9a35'), address: 'fakeaddress' }
        ])
      }));

      const mintStream = new Readable({ objectMode: true, read: () => {} });
      let done = new Promise(r =>
        mintStream
          .on('data', (mintOps: MintOp[]) => {
            let ops = mintOps;
            expect(ops.length).to.eq(1);
            expect(ops[0].updateOne.update.$set.address).to.eq(address);
          })
          .on('end', r)
      );

      await TransactionStorage.streamMintOps({
        chain: 'BTC',
        network: 'regtest',
        txs: [tx],
        height: 8534,
        mintStream,
        initialSyncComplete: true
      });
      await done;
      expect(tx.wallets).to.exist;
      expect(tx.wallets.length).to.eq(1);
      expect(tx.wallets[0]).to.eq(correctWalletId);
    });

    it('should tag the transaction ops, and calculate the fee', async () => {
      function getCoinForInput(i: TransactionInput) {
        const input = i.toObject();
        const inputTxid = i.toObject().prevTxId;
        const fixtureInput = TransactionFixture.inputs[inputTxid];
        const inputTx = new bitcoreLib.Transaction(fixtureInput) as BitcoinTransaction;
        const coin = { spentTxid: tx.hash, value: inputTx.outputs[input.outputIndex].satoshis, wallets: [] };
        return coin;
      }

      sandbox.stub(CoinStorage, 'collection').get(() => ({
        find: sandbox.stub().returnsThis(),
        project: sandbox.stub().returnsThis(),
        toArray: sandbox.stub().resolves(tx.inputs.map(getCoinForInput))
      }));

      const txStream = new Readable({ objectMode: true, read: () => {} });
      let done = new Promise(r =>
        txStream
          .on('data', (spentOps: TxOp[]) => {
            let ops = spentOps;
            expect(ops.length).to.eq(1);
            expect(ops[0].updateOne.filter.txid).to.eq(tx.hash);
            expect(ops[0].updateOne.update.$set.fee).to.eq(81276);
            expect(ops[0].updateOne.update.$set.inputCount).to.eq(tx.inputs.length);
            expect(ops[0].updateOne.update.$set.wallets.length).to.eq(1);
            expect(ops[0].updateOne.update.$set.wallets[0]).to.eq(correctWalletId);
          })
          .on('end', r)
      );

      await TransactionStorage.streamTxOps({
        chain: 'BTC',
        network: 'regtest',
        txs: [tx],
        height: CURRENT_HEIGHT,
        initialSyncComplete: false,
        txStream
      });
      await done;
    });
  });
});
