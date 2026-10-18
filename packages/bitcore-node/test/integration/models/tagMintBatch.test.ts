import { expect } from 'chai';
import * as crypto from 'crypto';
import { ObjectID } from 'mongodb';
import sinon from 'sinon';
import { Readable } from 'stream';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { CoinStorage } from '../../../src/models/coin';
import { MintOp, TaggedBitcoinTx, TransactionStorage } from '../../../src/models/transaction';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { Config } from '../../../src/services/config';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import { BitcoinTransaction } from '../../../src/types/namespaces/Bitcoin';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

/**
 * Pins how block import tags coins and txs with the wallets whose addresses they pay
 * (TransactionModel.streamMintOps + tagMintBatch), against the real WalletAddress collection.
 *
 * Tagging writes wallets in two places: each mint op's `$set.wallets` (the coin) and `tx.wallets`, which
 * streamTxOps merges with the wallets of the coins the tx spends.
 */
describe('TransactionModel.tagMintBatch', function() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(120000);

  const sandbox = sinon.createSandbox();
  const chain = 'BTC';
  const network = 'regtest';
  const HEIGHT = 100;

  const W1 = new ObjectID('64c000000000000000000001');
  const W2 = new ObjectID('64c000000000000000000002');
  const W3 = new ObjectID('64c000000000000000000003');

  /** a deterministic regtest P2PKH address; cheap to make in bulk */
  const address = (seed: string) =>
    BitcoreLib.Address.fromPublicKeyHash(crypto.createHash('sha256').update(seed).digest().slice(0, 20), 'regtest').toString();
  const A1 = address('a1');
  const A2 = address('a2');
  const B1 = address('b1');
  const X = address('external');
  const other = (i: number) => address(`other-${i}`);

  let txCount = 0;
  /** marks an OP_RETURN output in makeTx */
  const OP_RETURN = 'OP_RETURN';

  /** an unsigned tx paying `outputs` (one output per address, in order) from a made-up input */
  function makeTx(outputs: string[]): TaggedBitcoinTx {
    const tx = new BitcoreLib.Transaction();
    tx.from({
      txId: crypto.createHash('sha256').update(`input-${txCount++}`).digest('hex'),
      outputIndex: 0,
      script: BitcoreLib.Script.buildPublicKeyHashOut(X).toHex(),
      satoshis: 1e15
    });
    for (const to of outputs) {
      const script = to === OP_RETURN ? BitcoreLib.Script.buildDataOut('data') : BitcoreLib.Script.buildPublicKeyHashOut(to);
      tx.addOutput(new BitcoreLib.Transaction.Output({ script, satoshis: to === OP_RETURN ? 0 : 1000 }));
    }
    return tx as unknown as TaggedBitcoinTx;
  }

  async function addWalletAddress(wallet: ObjectID, walletAddress: string, where = { chain, network }) {
    await WalletAddressStorage.collection.insertOne({ ...where, wallet, address: walletAddress, processed: true } as any);
  }

  /** runs streamMintOps for one block and returns the mint op batches it pushed */
  async function mintOps(txs: TaggedBitcoinTx[], initialSyncComplete = true): Promise<MintOp[][]> {
    const batches: MintOp[][] = [];
    const mintStream = new Readable({ objectMode: true, read: () => {} });
    const done = new Promise(resolve => mintStream.on('data', batch => batches.push(batch)).on('end', resolve));
    await TransactionStorage.streamMintOps({
      chain,
      network,
      txs: txs as unknown as BitcoinTransaction[],
      height: HEIGHT,
      initialSyncComplete,
      mintStream
    });
    await done;
    return batches;
  }

  const untaggedUpdate = (op: MintOp) => {
    expect(op.updateOne.update.$set.wallets, 'no $set.wallets').to.equal(undefined);
    expect(op.updateOne.update.$setOnInsert).to.deep.equal({ spentHeight: SpentHeightIndicators.unspent, wallets: [] });
  };
  const taggedUpdate = (op: MintOp, wallets: ObjectID[]) => {
    expect(op.updateOne.update.$set.wallets, `wallets of output ${op.updateOne.filter.mintIndex}`).to.deep.equal(wallets);
    expect(op.updateOne.update.$setOnInsert).to.deep.equal({ spentHeight: SpentHeightIndicators.unspent });
  };
  const hex = (ids?: ObjectID[]) => ids && ids.map(id => id.toHexString());

  /** sets services.api.wallets.allowCreationBeforeCompleteSync for this test only */
  function allowCreationBeforeCompleteSync(allow: boolean) {
    const realFor = Config.for.bind(Config);
    sandbox.stub(Config, 'for').callsFake((service: any) =>
      service === 'api' ? { ...realFor('api'), wallets: { ...realFor('api').wallets, allowCreationBeforeCompleteSync: allow } } : realFor(service)
    );
  }

  before(intBeforeHelper);
  after(async () => {
    await resetDatabase();
    await intAfterHelper(suite);
  });
  beforeEach(resetDatabase);
  afterEach(() => sandbox.restore());

  describe('streamMintOps', () => {
    it('does not tag anything before initial sync is complete', async () => {
      await addWalletAddress(W1, A1);
      allowCreationBeforeCompleteSync(false);
      const tx = makeTx([A1, X]);
      const [ops] = await mintOps([tx], false);
      ops.map(untaggedUpdate);
      expect(tx.wallets).to.equal(undefined);
    });

    it('tags before initial sync is complete when allowCreationBeforeCompleteSync is set', async () => {
      await addWalletAddress(W1, A1);
      allowCreationBeforeCompleteSync(true);
      const tx = makeTx([A1, X]);
      const [ops] = await mintOps([tx], false);
      taggedUpdate(ops[0], [W1]);
      taggedUpdate(ops[1], []);
      expect(hex(tx.wallets)).to.deep.equal(hex([W1]));
    });

    it('leaves mint ops and txs untouched when no output pays a wallet address', async () => {
      await addWalletAddress(W1, A1);
      const txs = [makeTx([X, B1]), makeTx([A2])];
      const [ops] = await mintOps(txs);
      ops.map(untaggedUpdate);
      expect(txs.map(tx => tx.wallets)).to.deep.equal([undefined, undefined]);
    });

    it('tags each output with its wallets, and each tx with its outputs\' wallets in output order', async () => {
      await addWalletAddress(W1, A1);
      await addWalletAddress(W2, B1);
      const paying = makeTx([A1, X, A1, B1]);
      const unrelated = makeTx([X, OP_RETURN, OP_RETURN]);
      const [ops] = await mintOps([paying, unrelated]);
      expect(ops).to.have.length(7);
      taggedUpdate(ops[0], [W1]);
      taggedUpdate(ops[1], []);
      taggedUpdate(ops[2], [W1]);
      taggedUpdate(ops[3], [W2]);
      // every op in a batch with any match is tagged, even with no wallets (OP_RETURN outputs included)
      taggedUpdate(ops[4], []);
      taggedUpdate(ops[5], []);
      taggedUpdate(ops[6], []);
      // each op gets its own array, even for the same address
      expect(ops[0].updateOne.update.$set.wallets).to.not.equal(ops[2].updateOne.update.$set.wallets);
      // one entry per tagged output, duplicates included; streamTxOps dedupes when it writes the tx
      expect(hex(paying.wallets)).to.deep.equal(hex([W1, W1, W2]));
      expect(unrelated.wallets).to.deep.equal([]);
    });

    it('tags an address that belongs to several wallets with all of them', async () => {
      await addWalletAddress(W1, A1);
      await addWalletAddress(W3, A1);
      const tx = makeTx([A1]);
      const [ops] = await mintOps([tx]);
      expect(hex(ops[0].updateOne.update.$set.wallets)!.sort()).to.deep.equal(hex([W1, W3]));
      expect(hex(tx.wallets)!.sort()).to.deep.equal(hex([W1, W3]));
    });

    it('ignores wallet addresses on another chain or network', async () => {
      await addWalletAddress(W1, A1, { chain: 'BCH', network });
      await addWalletAddress(W2, A1, { chain, network: 'testnet' });
      const tx = makeTx([A1]);
      const [ops] = await mintOps([tx]);
      ops.map(untaggedUpdate);
      expect(tx.wallets).to.equal(undefined);
    });

    it('finds wallet addresses among more than 1000 distinct output addresses', async () => {
      await addWalletAddress(W1, other(3));
      await addWalletAddress(W2, other(1400));
      const tx = makeTx(Array.from({ length: 1500 }, (_, i) => other(i)));
      const [ops] = await mintOps([tx]);
      expect(ops).to.have.length(1500);
      taggedUpdate(ops[3], [W1]);
      taggedUpdate(ops[1400], [W2]);
      expect(ops.filter(op => op.updateOne.update.$set.wallets!.length)).to.have.length(2);
      expect(hex(tx.wallets)).to.deep.equal(hex([W1, W2]));
    });
  });

  describe('across lookups and batches', () => {
    /**
     * Pins one WalletAddress Collection and records the query and projection of every find on it for any of
     * `addresses`. Finds for other addresses are ignored: earlier suites can leave regtest sync running in this
     * process, and it tags its own blocks.
     */
    function recordWalletAddressFinds(addresses: string[]) {
      const ours = new Set(addresses);
      const collection = WalletAddressStorage.collection;
      sandbox.stub(WalletAddressStorage, 'collection').get(() => collection);
      const realFind = collection.find.bind(collection);
      const calls: { addresses: number; projection?: any }[] = [];
      sandbox.stub(collection, 'find').callsFake((query: any, options: any) => {
        const cursor = realFind(query, options);
        if (!query.address.$in.some((a: string) => ours.has(a))) {
          return cursor;
        }
        const call: { addresses: number; projection?: any } = { addresses: query.address.$in.length };
        calls.push(call);
        const project = cursor.project.bind(cursor);
        cursor.project = (projection: any) => {
          call.projection = projection;
          return project(projection);
        };
        return cursor;
      });
      return calls;
    }

    it('runs no wallet address query when tagging is off', async () => {
      allowCreationBeforeCompleteSync(false);
      const calls = recordWalletAddressFinds([A1]);
      await mintOps([makeTx([A1])], false);
      expect(calls).to.deep.equal([]);
    });
  });

  describe('tagMintBatch', () => {
    const op = (mintTxid: string, mintIndex: number, to: string, setOnInsert?: any): MintOp =>
      ({
        updateOne: {
          filter: { mintTxid, mintIndex, chain, network },
          update: { $set: { chain, network, address: to, mintHeight: HEIGHT, coinbase: false, value: 1000 }, ...(setOnInsert && { $setOnInsert: setOnInsert }) },
          upsert: true,
          forceServerObjectId: true
        }
      }) as any;

    it('drops $setOnInsert when wallets was its only field, handles ops without one, and tags txs with no ops', async () => {
      await addWalletAddress(W1, A1);
      const tx = makeTx([A1]);
      (tx as any)._hash = tx.hash;
      // e.g. a pre-fork tx whose outputs were all skipped
      const withoutOps = makeTx([X]);
      (withoutOps as any)._hash = withoutOps.hash;
      const ops = [op(tx.hash, 0, A1, { wallets: [] }), op(tx.hash, 1, X)];
      await TransactionStorage.tagMintBatch({ chain, network, initialSyncComplete: true, mintBatch: ops, txs: [tx, withoutOps] });
      expect(withoutOps.wallets).to.deep.equal([]);
      expect(ops[0].updateOne.update.$set.wallets).to.deep.equal([W1]);
      expect(ops[0].updateOne.update).to.not.have.property('$setOnInsert');
      expect(ops[1].updateOne.update.$set.wallets).to.deep.equal([]);
      expect(ops[1].updateOne.update).to.not.have.property('$setOnInsert');
      expect(hex(tx.wallets)).to.deep.equal(hex([W1]));
    });
  });

  describe('through batchImport', () => {
    it('re-tags existing coins when a block is imported again, and keeps their wallets when nothing matches', async () => {
      const block = makeTx([A1, X]);
      const coinWallets = async () =>
        (await CoinStorage.collection.find({ chain, network, mintTxid: block.hash }).sort({ mintIndex: 1 }).toArray()).map(c => hex(c.wallets));
      await TransactionStorage.batchImport({ txs: [block] as any, height: 1, chain, network, initialSyncComplete: true });
      expect(await coinWallets()).to.deep.equal([[], []]);

      // A1 joins a wallet; importing the block again tags the existing coin
      await addWalletAddress(W1, A1);
      await TransactionStorage.batchImport({ txs: [block] as any, height: 1, chain, network, initialSyncComplete: true });
      expect(await coinWallets()).to.deep.equal([hex([W1]), []]);

      // with no wallet address matching, an import leaves existing coin wallets alone ($setOnInsert only)
      await WalletAddressStorage.collection.deleteMany({});
      await TransactionStorage.batchImport({ txs: [block] as any, height: 1, chain, network, initialSyncComplete: true });
      expect(await coinWallets()).to.deep.equal([hex([W1]), []]);
    });

    it('stores wallets on the coins and on the tx, merged with the wallets of the coins it spends', async () => {
      await addWalletAddress(W1, A1);
      await addWalletAddress(W2, B1);
      const funding = makeTx([A1, X]);
      await TransactionStorage.batchImport({ txs: [funding] as any, height: 1, chain, network, initialSyncComplete: true });
      const spend = new BitcoreLib.Transaction()
        .from({ txId: funding.hash, outputIndex: 0, script: BitcoreLib.Script.buildPublicKeyHashOut(A1).toHex(), satoshis: 1000 })
        .to(B1, 900) as unknown as BitcoinTransaction;
      await TransactionStorage.batchImport({ txs: [spend], height: 2, chain, network, initialSyncComplete: true });

      const ours = { chain, network, mintTxid: { $in: [funding.hash, spend.hash] } };
      const coins = await CoinStorage.collection.find(ours).sort({ mintHeight: 1, mintIndex: 1 }).toArray();
      expect(coins.map(c => [c.mintTxid, c.mintIndex, hex(c.wallets)])).to.deep.equal([
        [funding.hash, 0, hex([W1])],
        [funding.hash, 1, []],
        [spend.hash, 0, hex([W2])]
      ]);
      const txs = await TransactionStorage.collection.find({ chain, network, txid: { $in: [funding.hash, spend.hash] } }).sort({ blockHeight: 1 }).toArray();
      expect(txs.map(t => [t.txid, hex(t.wallets)])).to.deep.equal([
        [funding.hash, hex([W1])],
        // minted wallets first, then the spent coin's
        [spend.hash, hex([W2, W1])]
      ]);
    });
  });
});
