import { expect } from 'chai';
import sinon from 'sinon';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { CoinStorage } from '../../../src/models/coin';
import { SpendOp, TransactionStorage } from '../../../src/models/transaction';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import { BitcoinTransaction } from '../../../src/types/namespaces/Bitcoin';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

/**
 * Pins what TransactionModel.pruneMempool does to the txs and coins collections when a block (or a mempool tx)
 * spends outputs that a pending mempool tx had already spent.
 *
 * The direct tests seed a fixed tx/coin graph, run pruneMempool on hand-built spend ops (the same shape
 * streamSpendOps produces), and assert the complete resulting state, so any unexpected write fails. The
 * batchImport tests run the real import path with signed transactions.
 */
describe('TransactionModel.pruneMempool', function() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);

  const sandbox = sinon.createSandbox();
  const chain = 'BTC';
  const network = 'integration';
  const pending = SpentHeightIndicators.pending;
  const unspent = SpentHeightIndicators.unspent;
  const conflicting = SpentHeightIndicators.conflicting;
  const txid = (n: number) => n.toString(16).padStart(64, '0');

  type TxState = { chain: string; network: string; txid: string; blockHeight: number; replacedByTxid?: string };
  type CoinState = {
    chain: string;
    network: string;
    mintTxid: string;
    mintIndex: number;
    mintHeight: number;
    spentTxid: string;
    spentHeight: number;
  };
  type State = { txs: Record<string, TxState & Record<string, any>>; coins: Record<string, CoinState & Record<string, any>> };

  const txKey = (tx: { chain: string; network: string; txid: string }) => `${tx.chain}:${tx.network}:${tx.txid}`;
  const coinKey = (coin: { chain: string; network: string; mintTxid: string; mintIndex: number }) =>
    `${coin.chain}:${coin.network}:${coin.mintTxid}:${coin.mintIndex}`;

  async function seedTx(id: string, blockHeight: number, where = { chain, network }) {
    await TransactionStorage.collection.insertOne({ ...where, txid: id, blockHeight } as any);
  }

  async function seedCoin(coin: Partial<CoinState> & { mintTxid: string; mintIndex: number; mintHeight: number }) {
    await CoinStorage.collection.insertOne({
      chain,
      network,
      spentTxid: '',
      spentHeight: unspent,
      ...coin
    } as any);
  }

  /** the spend op streamSpendOps builds for `spender` spending mintTxid:mintIndex at `height` */
  function spendOp(spender: string, mintTxid: string, mintIndex: number, height = 10): SpendOp {
    return {
      updateOne: {
        filter: { mintTxid, mintIndex, spentHeight: { $lt: SpentHeightIndicators.minimum }, chain, network },
        update: { $set: { spentTxid: spender, spentHeight: height, sequenceNumber: 0xffffffff } }
      }
    } as SpendOp;
  }

  async function prune(spendOps: SpendOp[], initialSyncComplete = true) {
    await TransactionStorage.pruneMempool({ chain, network, spendOps, initialSyncComplete });
  }

  /** runs pruneMempool and asserts it invalidated nothing, not even a no-op _invalidateTx call */
  async function pruneExpectingNoInvalidation(spendOps: SpendOp[], initialSyncComplete = true) {
    const invalidateTx = sandbox.spy(TransactionStorage, '_invalidateTx');
    await prune(spendOps, initialSyncComplete);
    expect(invalidateTx.callCount, '_invalidateTx calls').to.equal(0);
  }

  async function snapshot(): Promise<State> {
    // whole documents (minus _id), so a write to any field shows up
    const txs = await TransactionStorage.collection.find({}).project({ _id: 0 }).toArray();
    const coins = await CoinStorage.collection.find({}).project({ _id: 0 }).toArray();
    return {
      txs: Object.fromEntries(txs.map(tx => [txKey(tx as TxState), tx as TxState])),
      coins: Object.fromEntries(coins.map(coin => [coinKey(coin as CoinState), coin as CoinState]))
    };
  }

  /** asserts the current txs and coins equal `before` with exactly these per-tx / per-coin field changes */
  async function expectChanges(
    before: State,
    changes: { txs?: Record<string, Partial<TxState>>; coins?: Record<string, Partial<CoinState>> } = {}
  ) {
    const expected: State = { txs: { ...before.txs }, coins: { ...before.coins } };
    for (const [id, change] of Object.entries(changes.txs || {})) {
      const key = txKey({ chain, network, txid: id });
      expect(expected.txs[key], `tx ${id} exists`).to.exist;
      expected.txs[key] = { ...expected.txs[key], ...change };
    }
    for (const [outpoint, change] of Object.entries(changes.coins || {})) {
      const key = `${chain}:${network}:${outpoint}`;
      expect(expected.coins[key], `coin ${outpoint} exists`).to.exist;
      expected.coins[key] = { ...expected.coins[key], ...change };
    }
    expect(await snapshot()).to.deep.equal(expected);
  }

  const invalidated = (replacedByTxid: string) => ({ blockHeight: conflicting, replacedByTxid });
  const freed = { spentTxid: '', spentHeight: unspent };
  const out = (id: string, index: number) => `${id}:${index}`;

  // mined (confirmed) funding txs whose outputs mempool txs spend
  const F = txid(0xf1);
  const G = txid(0xf2);
  const H = txid(0xf3);
  // pending mempool txs
  const M = txid(0xa1);
  const M2 = txid(0xa2);
  const C = txid(0xa3);
  // txs being mined (or imported into the mempool) now
  const A = txid(0xb1);
  const B = txid(0xb2);

  before(intBeforeHelper);
  after(async () => {
    await resetDatabase();
    await intAfterHelper(suite);
  });
  beforeEach(resetDatabase);
  afterEach(() => sandbox.restore());

  /** F, G and H are mined, with two outputs each */
  async function seedFunding() {
    for (const [i, id] of [F, G, H].entries()) {
      await seedTx(id, 1 + i);
      await seedCoin({ mintTxid: id, mintIndex: 0, mintHeight: 1 + i });
      await seedCoin({ mintTxid: id, mintIndex: 1, mintHeight: 1 + i });
    }
  }

  /** mempool tx `id` spends `inputs` and has `outputs` pending outputs */
  async function seedMempoolTx(id: string, inputs: Array<[string, number]>, outputs = 1) {
    await seedTx(id, pending);
    for (const [mintTxid, mintIndex] of inputs) {
      await CoinStorage.collection.updateOne(
        { chain, network, mintTxid, mintIndex },
        { $set: { spentTxid: id, spentHeight: pending } }
      );
    }
    for (let i = 0; i < outputs; i++) {
      await seedCoin({ mintTxid: id, mintIndex: i, mintHeight: pending });
    }
  }

  describe('direct', () => {
    beforeEach(seedFunding);

    it('does nothing before initial sync is complete', async () => {
      await seedMempoolTx(M, [[F, 0]]);
      const before = await snapshot();
      await pruneExpectingNoInvalidation([spendOp(A, F, 0)], false);
      await expectChanges(before);
    });

    it('does nothing for an empty batch', async () => {
      await seedMempoolTx(M, [[F, 0]]);
      const before = await snapshot();
      await pruneExpectingNoInvalidation([]);
      await expectChanges(before);
    });

    it('leaves a mempool tx alone when it is the tx being mined', async () => {
      await seedMempoolTx(M, [[F, 0], [G, 0]], 2);
      const before = await snapshot();
      await pruneExpectingNoInvalidation([spendOp(M, F, 0), spendOp(M, G, 0)]);
      await expectChanges(before);
    });

    it('invalidates a mempool tx that spent the mined tx\'s input, and frees its other inputs', async () => {
      await seedMempoolTx(M, [[F, 0], [G, 0]], 2);
      const before = await snapshot();
      await prune([spendOp(A, F, 0)]);
      await expectChanges(before, {
        txs: { [M]: invalidated(A) },
        coins: {
          // the mined spend itself is written after pruneMempool, by the spend ops
          [out(F, 0)]: freed,
          [out(G, 0)]: freed,
          [out(M, 0)]: { mintHeight: conflicting },
          [out(M, 1)]: { mintHeight: conflicting }
        }
      });
    });

    it('invalidates only the conflicting tx, not its pending descendants', async () => {
      await seedMempoolTx(M, [[F, 0]]);
      await seedMempoolTx(C, [[M, 0]]);
      const before = await snapshot();
      await prune([spendOp(A, F, 0)]);
      await expectChanges(before, {
        txs: { [M]: invalidated(A) },
        // M:0 stays spent by C; the pruning service cleans up descendants
        coins: { [out(F, 0)]: freed, [out(M, 0)]: { mintHeight: conflicting } }
      });
    });

    it('invalidates a mempool tx once when it conflicts with the mined tx on several inputs', async () => {
      await seedMempoolTx(M, [[F, 0], [G, 0]]);
      const before = await snapshot();
      const invalidateTx = sandbox.spy(TransactionStorage, '_invalidateTx');
      await prune([spendOp(A, F, 0), spendOp(A, G, 0)]);
      expect(invalidateTx.callCount).to.equal(1);
      await expectChanges(before, {
        txs: { [M]: invalidated(A) },
        coins: { [out(F, 0)]: freed, [out(G, 0)]: freed, [out(M, 0)]: { mintHeight: conflicting } }
      });
    });

    it('invalidates each mempool tx that conflicts with a different mined tx', async () => {
      await seedMempoolTx(M, [[F, 0]]);
      await seedMempoolTx(M2, [[G, 0]]);
      const before = await snapshot();
      await prune([spendOp(A, F, 0), spendOp(B, G, 0)]);
      await expectChanges(before, {
        txs: { [M]: invalidated(A), [M2]: invalidated(B) },
        coins: {
          [out(F, 0)]: freed,
          [out(G, 0)]: freed,
          [out(M, 0)]: { mintHeight: conflicting },
          [out(M2, 0)]: { mintHeight: conflicting }
        }
      });
    });

    it('records the first mined tx as the replacement when a mempool tx conflicts with several', async () => {
      await seedMempoolTx(M, [[F, 0], [G, 0]]);
      const before = await snapshot();
      await prune([spendOp(A, F, 0), spendOp(B, G, 0)]);
      await expectChanges(before, {
        txs: { [M]: invalidated(A) },
        coins: { [out(F, 0)]: freed, [out(G, 0)]: freed, [out(M, 0)]: { mintHeight: conflicting } }
      });
    });

    it('invalidates a mempool tx that conflicts with a later input of the mined tx', async () => {
      await seedMempoolTx(M, [[F, 0], [H, 0]]);
      const before = await snapshot();
      // A's first input (G:1) is unspent; only its second conflicts
      await prune([spendOp(A, G, 1), spendOp(A, F, 0)]);
      await expectChanges(before, {
        txs: { [M]: invalidated(A) },
        coins: { [out(F, 0)]: freed, [out(H, 0)]: freed, [out(M, 0)]: { mintHeight: conflicting } }
      });
    });

    it('invalidates every mempool tx that conflicts with any input of the same mined tx', async () => {
      await seedMempoolTx(M, [[F, 0]]);
      await seedMempoolTx(M2, [[G, 0], [H, 1]]);
      const before = await snapshot();
      await prune([spendOp(A, F, 0), spendOp(A, G, 0)]);
      await expectChanges(before, {
        txs: { [M]: invalidated(A), [M2]: invalidated(A) },
        coins: {
          [out(F, 0)]: freed,
          [out(G, 0)]: freed,
          [out(H, 1)]: freed,
          [out(M, 0)]: { mintHeight: conflicting },
          [out(M2, 0)]: { mintHeight: conflicting }
        }
      });
    });

    it('ignores coins that are unspent or already spent in a block', async () => {
      await CoinStorage.collection.updateOne({ chain, network, mintTxid: G, mintIndex: 0 }, { $set: { spentTxid: H, spentHeight: 3 } });
      const before = await snapshot();
      await pruneExpectingNoInvalidation([spendOp(A, F, 0), spendOp(A, G, 0)]);
      await expectChanges(before);
    });

    it('ignores pending spends of the same outpoint on another chain or network', async () => {
      for (const where of [{ chain: 'BCH', network }, { chain, network: 'testnet' }]) {
        await seedTx(M, pending, where);
        await seedCoin({ ...where, mintTxid: F, mintIndex: 0, mintHeight: 1, spentTxid: M, spentHeight: pending });
      }
      const before = await snapshot();
      await pruneExpectingNoInvalidation([spendOp(A, F, 0)]);
      await expectChanges(before);
    });

    it('invalidates the pending spender when a later tx in the same batch spends the outpoint too', async () => {
      // the same outpoint spent by two txs in one mempool batch: A, then M, which already spends it
      await seedMempoolTx(M, [[F, 0]]);
      const before = await snapshot();
      await prune([spendOp(A, F, 0, pending), spendOp(M, F, 0, pending)]);
      await expectChanges(before, {
        txs: { [M]: invalidated(A) },
        coins: { [out(F, 0)]: freed, [out(M, 0)]: { mintHeight: conflicting } }
      });
    });

    it('rejects, without writing anything, when the coin query fails', async () => {
      await seedMempoolTx(M, [[F, 0]]);
      const before = await snapshot();
      const collection = CoinStorage.collection;
      sandbox.stub(CoinStorage, 'collection').get(() => collection);
      const boom = new Error('coin query failed');
      const failing: any = { hint: () => failing, project: () => failing, toArray: () => Promise.reject(boom), next: () => Promise.reject(boom) };
      sandbox.stub(collection, 'find').returns(failing);
      const err = await prune([spendOp(A, F, 0)]).then(() => null, e => e);
      expect(err).to.equal(boom);
      sandbox.restore();
      await expectChanges(before);
    });

    it('ignores a pending spend of another output of the same tx', async () => {
      await seedMempoolTx(M, [[F, 1]]);
      const before = await snapshot();
      await pruneExpectingNoInvalidation([spendOp(A, F, 0)]);
      await expectChanges(before);
    });
  });

  describe('queries', () => {
    const FUNDING = 1500;
    const fundingTxid = (i: number) => txid(0x10000 + i);

    /** pins one CoinStorage Collection and records the query of every find on it, and the hint of its cursor */
    function recordCoinFinds() {
      const collection = CoinStorage.collection;
      sandbox.stub(CoinStorage, 'collection').get(() => collection);
      const realFind = collection.find.bind(collection);
      const hints: any[] = [];
      const find = sandbox.stub(collection, 'find').callsFake((query, options) => {
        const cursor = realFind(query, options);
        const hint = cursor.hint.bind(cursor);
        hints.push(undefined);
        const index = hints.length - 1;
        cursor.hint = (spec: any) => {
          hints[index] = spec;
          return hint(spec);
        };
        return cursor;
      });
      return { find, hints };
    }

    beforeEach(async () => {
      await CoinStorage.collection.insertMany(
        Array.from({ length: FUNDING }, (_, i) => ({
          chain,
          network,
          mintTxid: fundingTxid(i),
          mintIndex: 0,
          mintHeight: 1,
          spentTxid: '',
          spentHeight: unspent
        })) as any
      );
      await TransactionStorage.collection.insertMany(
        Array.from({ length: FUNDING }, (_, i) => ({ chain, network, txid: fundingTxid(i), blockHeight: 1 })) as any
      );
    });

    it('looks up a batch\'s pending spends in one query per 1000 spent txids, not one per tx', async () => {
      // M conflicts in both queries' txids and must be replaced by its first spender; M2 only in the second
      await seedMempoolTx(M, [[fundingTxid(5), 0], [fundingTxid(1200), 0]]);
      await seedMempoolTx(M2, [[fundingTxid(1400), 0]]);
      // one mined tx per funding output, plus a spend of another output of an already-listed txid, which must
      // not add to the lookups
      const spendOps = Array.from({ length: FUNDING }, (_, i) => spendOp(txid(0x20000 + i), fundingTxid(i), 0));
      spendOps.push(spendOp(txid(0x20000), fundingTxid(0), 1));
      const before = await snapshot();
      const { find, hints } = recordCoinFinds();
      const invalidateTx = sandbox.spy(TransactionStorage, '_invalidateTx');
      await prune(spendOps);
      const lookups = find.getCalls().map(call => call.args[0].mintTxid.$in.length);
      expect(lookups).to.deep.equal([1000, 500]);
      // pinned to the outpoint index; Mongo 3.6 otherwise may scan every coin on the chain
      expect(hints).to.deep.equal([{ mintTxid: 1, mintIndex: 1 }, { mintTxid: 1, mintIndex: 1 }]);
      expect(invalidateTx.callCount).to.equal(2);
      sandbox.restore();
      await expectChanges(before, {
        txs: { [M]: invalidated(txid(0x20000 + 5)), [M2]: invalidated(txid(0x20000 + 1400)) },
        coins: {
          [out(fundingTxid(5), 0)]: freed,
          [out(fundingTxid(1200), 0)]: freed,
          [out(fundingTxid(1400), 0)]: freed,
          [out(M, 0)]: { mintHeight: conflicting },
          [out(M2, 0)]: { mintHeight: conflicting }
        }
      });
    });

    it('runs a single query for exactly 1000 spent txids', async () => {
      const { find } = recordCoinFinds();
      await pruneExpectingNoInvalidation(Array.from({ length: 1000 }, (_, i) => spendOp(txid(0x20000 + i), fundingTxid(i), 0)));
      expect(find.getCalls().map(call => call.args[0].mintTxid.$in.length)).to.deep.equal([1000]);
    });
  });

  describe('through batchImport', () => {
    const privateKey = new BitcoreLib.PrivateKey('L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy');
    const address = privateKey.toAddress().toString();
    const script = BitcoreLib.Script.buildPublicKeyHashOut(privateKey.toAddress()).toHex();
    const utxo = (tx: BitcoinTransaction, outputIndex: number) => ({
      txId: tx.hash,
      outputIndex,
      address,
      script,
      satoshis: tx.outputs[outputIndex].satoshis
    });
    const externalUtxo = (n: number) => ({ txId: txid(0xe000 + n), outputIndex: 0, address, script, satoshis: 100000 });
    const sign = (tx: any) => tx.sign(privateKey) as BitcoinTransaction;

    async function importTxs(txs: BitcoinTransaction[], height: number) {
      await TransactionStorage.batchImport({ txs, height, chain, network, initialSyncComplete: true, ...(height < 0 && { mempoolTime: new Date() }) });
    }

    const txState = async (tx: BitcoinTransaction) =>
      TransactionStorage.collection.findOne({ chain, network, txid: tx.hash }, { projection: { _id: 0, blockHeight: 1, replacedByTxid: 1 } });
    const coinState = async (tx: BitcoinTransaction, mintIndex: number) =>
      CoinStorage.collection.findOne({ chain, network, mintTxid: tx.hash, mintIndex }, { projection: { _id: 0, mintHeight: 1, spentTxid: 1, spentHeight: 1 } });

    // funding: two mined txs with two outputs each
    let fundF: BitcoinTransaction;
    let fundG: BitcoinTransaction;
    // a mempool tx spending both of fundF's outputs
    let mempoolM: BitcoinTransaction;

    beforeEach(async () => {
      fundF = sign(new BitcoreLib.Transaction().from(externalUtxo(1)).to(address, 40000).to(address, 40000));
      fundG = sign(new BitcoreLib.Transaction().from(externalUtxo(2)).to(address, 40000).to(address, 40000));
      await importTxs([fundF, fundG], 1);
      mempoolM = sign(new BitcoreLib.Transaction().from([utxo(fundF, 0), utxo(fundF, 1)]).to(address, 70000));
      await importTxs([mempoolM], pending);
      expect(await txState(mempoolM)).to.deep.equal({ blockHeight: pending });
    });

    it('invalidates a mempool tx when a block spends its first input', async () => {
      const minedA = sign(new BitcoreLib.Transaction().from([utxo(fundF, 0)]).to(address, 30000));
      await importTxs([minedA], 2);
      expect(await txState(mempoolM)).to.deep.equal({ blockHeight: conflicting, replacedByTxid: minedA.hash });
      expect(await coinState(mempoolM, 0)).to.deep.include({ mintHeight: conflicting });
      expect(await coinState(fundF, 0)).to.deep.equal({ mintHeight: 1, spentTxid: minedA.hash, spentHeight: 2 });
      expect(await coinState(fundF, 1)).to.deep.equal({ mintHeight: 1, spentTxid: '', spentHeight: unspent });
    });

    it('invalidates a mempool tx when a block spends a later input of it', async () => {
      // minedA's first input is unrelated; its second is the mempool tx's second input
      const minedA = sign(new BitcoreLib.Transaction().from([utxo(fundG, 0), utxo(fundF, 1)]).to(address, 70000));
      expect(minedA.inputs.map(input => input.toObject().prevTxId)).to.deep.equal([fundG.hash, fundF.hash]);
      await importTxs([minedA], 2);
      expect(await txState(mempoolM)).to.deep.equal({ blockHeight: conflicting, replacedByTxid: minedA.hash });
      expect(await coinState(mempoolM, 0)).to.deep.include({ mintHeight: conflicting });
      expect(await coinState(fundF, 0)).to.deep.equal({ mintHeight: 1, spentTxid: '', spentHeight: unspent });
      expect(await coinState(fundF, 1)).to.deep.equal({ mintHeight: 1, spentTxid: minedA.hash, spentHeight: 2 });
    });

    it('invalidates a mempool tx replaced by another mempool tx (RBF)', async () => {
      const replacementR = sign(new BitcoreLib.Transaction().from([utxo(fundF, 0)]).to(address, 30000));
      await importTxs([replacementR], pending);
      expect(await txState(mempoolM)).to.deep.equal({ blockHeight: conflicting, replacedByTxid: replacementR.hash });
      expect(await txState(replacementR)).to.deep.equal({ blockHeight: pending });
      expect(await coinState(fundF, 0)).to.deep.equal({ mintHeight: 1, spentTxid: replacementR.hash, spentHeight: pending });
      expect(await coinState(fundF, 1)).to.deep.equal({ mintHeight: 1, spentTxid: '', spentHeight: unspent });
    });

    it('invalidates each replacement in turn when it is itself replaced (RBF chain)', async () => {
      const replacementR = sign(new BitcoreLib.Transaction().from([utxo(fundF, 0)]).to(address, 30000));
      await importTxs([replacementR], pending);
      const replacementR2 = sign(new BitcoreLib.Transaction().from([utxo(fundF, 0)]).to(address, 29000));
      await importTxs([replacementR2], pending);
      expect(await txState(mempoolM)).to.deep.equal({ blockHeight: conflicting, replacedByTxid: replacementR.hash });
      expect(await txState(replacementR)).to.deep.equal({ blockHeight: conflicting, replacedByTxid: replacementR2.hash });
      expect(await txState(replacementR2)).to.deep.equal({ blockHeight: pending });
      expect(await coinState(fundF, 0)).to.deep.equal({ mintHeight: 1, spentTxid: replacementR2.hash, spentHeight: pending });
    });

    it('leaves a mempool tx pending when it is imported into the mempool again', async () => {
      const invalidateTx = sandbox.spy(TransactionStorage, '_invalidateTx');
      await importTxs([mempoolM], pending);
      expect(invalidateTx.callCount).to.equal(0);
      expect(await txState(mempoolM)).to.deep.equal({ blockHeight: pending });
      expect(await coinState(fundF, 0)).to.deep.equal({ mintHeight: 1, spentTxid: mempoolM.hash, spentHeight: pending });
      expect(await coinState(fundF, 1)).to.deep.equal({ mintHeight: 1, spentTxid: mempoolM.hash, spentHeight: pending });
    });

    it('confirms a mempool tx when it is mined, without invalidating anything', async () => {
      await importTxs([mempoolM], 2);
      expect(await txState(mempoolM)).to.deep.equal({ blockHeight: 2 });
      expect(await coinState(fundF, 0)).to.deep.equal({ mintHeight: 1, spentTxid: mempoolM.hash, spentHeight: 2 });
      expect(await coinState(fundF, 1)).to.deep.equal({ mintHeight: 1, spentTxid: mempoolM.hash, spentHeight: 2 });
      expect(await coinState(mempoolM, 0)).to.deep.include({ mintHeight: 2 });
    });

    it('leaves the mempool tx pending when a block spends unrelated coins', async () => {
      const minedA = sign(new BitcoreLib.Transaction().from([utxo(fundG, 0), utxo(fundG, 1)]).to(address, 70000));
      await importTxs([minedA], 2);
      expect(await txState(mempoolM)).to.deep.equal({ blockHeight: pending });
      expect(await coinState(fundF, 0)).to.deep.equal({ mintHeight: 1, spentTxid: mempoolM.hash, spentHeight: pending });
    });
  });
});
