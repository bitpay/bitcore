import { Transform } from 'stream';
import { CoinStorage, type ICoin } from '../../../models/coin';
import { IWallet } from '../../../models/wallet';

type WalletOutput = Pick<ICoin, 'mintTxid' | 'mintIndex' | 'address' | 'wallets' | 'value'>;

export interface ListTransactionsStreamOptions {
  /** txs resolved together; each batch costs a fixed number of coin queries */
  batchSize?: number;
  /**
   * Most outputs a single batch lookup loads at once. A lookup that would exceed it falls back to
   * loading each tx's outputs separately, so memory stays bounded by the largest single tx.
   */
  maxBatchOutputs?: number;
}

const outputProjection = { _id: 0, mintTxid: 1, mintIndex: 1, address: 1, wallets: 1, value: 1 };

// large enough that a whole batch's coins come back in the first reply instead of paying getMore round trips
const cursorBatchSize = 10000;

/**
 * Turns a stream of wallet transactions into send/move/receive/fee rows.
 *
 * Transactions are buffered and resolved `batchSize` at a time so each batch costs a fixed
 * number of coin queries rather than two round trips per transaction.
 */
export class ListTransactionsStream extends Transform {
  static readonly DEFAULT_BATCH_SIZE = 100;
  static readonly DEFAULT_MAX_BATCH_OUTPUTS = 5000;

  private batch: any[] = [];
  private batchSize: number;
  private maxBatchOutputs: number;
  private waitingBatch?: () => void;

  constructor(public wallet: IWallet, options: ListTransactionsStreamOptions = {}) {
    super({ objectMode: true });
    this.batchSize = options.batchSize ?? ListTransactionsStream.DEFAULT_BATCH_SIZE;
    this.maxBatchOutputs = options.maxBatchOutputs ?? ListTransactionsStream.DEFAULT_MAX_BATCH_OUTPUTS;
    // a batch waiting on a consumer that goes away must not hang
    this.once('close', () => this.wakeBatch());
  }

  async _transform(transaction, _, done) {
    this.batch.push(transaction);
    if (this.batch.length < this.batchSize) {
      return done();
    }
    let error;
    try {
      await this.processBatch();
    } catch (err) {
      error = err;
    }
    done(error);
  }

  async _flush(done) {
    let error;
    try {
      await this.processBatch();
    } catch (err) {
      error = err;
    }
    done(error);
  }

  _read(size: number) {
    this.wakeBatch();
    super._read(size);
  }

  /** resumes a batch that is waiting in waitForConsumer (not Readable#resume, which this must not shadow) */
  private wakeBatch() {
    const wake = this.waitingBatch;
    this.waitingBatch = undefined;
    wake?.();
  }

  /** wait for the consumer between txs so a batch's rows don't pile up in the readable buffer */
  private async waitForConsumer() {
    if (this.destroyed || this.readableLength < this.readableHighWaterMark) {
      return;
    }
    await new Promise<void>(resolve => (this.waitingBatch = resolve));
  }

  private async processBatch() {
    const transactions = this.batch;
    this.batch = [];
    if (!transactions.length) {
      return;
    }

    const sendingTxids = await this.findSendingTxids(transactions.map(tx => tx.txid));
    const sending = transactions.filter(tx => sendingTxids.has(tx.txid));
    const receiving = transactions.filter(tx => !sendingTxids.has(tx.txid));
    // a null result means the lookup was over maxBatchOutputs; those txs are loaded one at a time below
    const [sendOutputs, receiveOutputs] = await Promise.all([
      this.findOutputs(sending, tx => this.allOutputsQuery(tx)),
      this.findOutputs(receiving, tx => this.walletOutputsQuery(tx))
    ]);

    const wallet = this.wallet._id!.toString();
    for (const transaction of transactions) {
      if (this.destroyed) {
        return;
      }
      if (sendingTxids.has(transaction.txid)) {
        const outputs = sendOutputs
          ? sendOutputs.get(transaction.txid) || []
          : await this.findTxOutputs(this.allOutputsQuery(transaction));
        for (const output of outputs) {
          const sendingToOurself = output.wallets.some(outputWallet => {
            return outputWallet.equals(wallet);
          });
          this.push(this.outputRow(transaction, sendingToOurself ? 'move' : 'send', -output.value, output));
        }
        if (transaction.fee > 0) {
          this.push(
            JSON.stringify({
              id: transaction._id,
              txid: transaction.txid,
              category: 'fee',
              satoshis: -transaction.fee,
              height: transaction.blockHeight,
              blockTime: transaction.blockTimeNormalized
            }) + '\n'
          );
        }
      } else {
        const outputs = receiveOutputs
          ? receiveOutputs.get(transaction.txid) || []
          : await this.findTxOutputs(this.walletOutputsQuery(transaction));
        for (const output of outputs) {
          const weReceived = output.wallets.some(outputWallet => {
            return outputWallet.equals(wallet);
          });
          if (weReceived) {
            this.push(this.outputRow(transaction, 'receive', output.value, output));
          }
        }
      }
      await this.waitForConsumer();
    }
  }

  /**
   * txids in which one of this wallet's coins was spent. distinct dedupes on the server, so a tx that spends
   * many wallet coins (a consolidation) comes back once rather than once per input.
   */
  private async findSendingTxids(txids: string[]): Promise<Set<string>> {
    const spentTxids: string[] = await CoinStorage.collection.distinct('spentTxid', {
      wallets: this.wallet._id,
      'wallets.0': { $exists: true },
      spentTxid: { $in: txids }
    });
    return new Set(spentTxids);
  }

  /** every output of a sending tx, scoped to its chain/network (txids can repeat across forks) */
  private allOutputsQuery(transaction) {
    return { chain: transaction.chain, network: transaction.network, mintTxid: transaction.txid };
  }

  /** only this wallet's outputs of a receiving tx */
  private walletOutputsQuery(transaction) {
    return { wallets: this.wallet._id, 'wallets.0': { $exists: true }, mintTxid: transaction.txid };
  }

  /**
   * Loads the outputs of `transactions` with one `$in` query per distinct query shape (in practice one,
   * since a request covers a single chain/network). Returns null if that would load more than
   * maxBatchOutputs outputs.
   */
  private async findOutputs(transactions: any[], queryFor: (tx) => any): Promise<Map<string, WalletOutput[]> | null> {
    const groups = new Map<string, { query: any; txids: string[] }>();
    for (const transaction of transactions) {
      const { mintTxid, ...rest } = queryFor(transaction);
      const key = JSON.stringify(rest);
      const group = groups.get(key) || { query: rest, txids: [] as string[] };
      group.txids.push(mintTxid);
      groups.set(key, group);
    }
    const results: WalletOutput[][] = await Promise.all(
      Array.from(groups.values()).map(({ query, txids }) =>
        CoinStorage.collection
          .find({ ...query, mintTxid: { $in: txids } }, { batchSize: cursorBatchSize })
          .project(outputProjection)
          .limit(this.maxBatchOutputs + 1)
          .toArray()
      )
    );
    const outputs = results.flat();
    return outputs.length > this.maxBatchOutputs ? null : groupByMintTxid(outputs);
  }

  private async findTxOutputs(query): Promise<WalletOutput[]> {
    const outputs: WalletOutput[] = await CoinStorage.collection
      .find(query, { batchSize: cursorBatchSize })
      .project(outputProjection)
      .toArray();
    return outputs.sort(byMintIndex);
  }

  private outputRow(transaction, category: string, satoshis: number, output: WalletOutput) {
    return (
      JSON.stringify({
        id: transaction._id,
        txid: transaction.txid,
        fee: transaction.fee,
        size: transaction.size,
        category,
        satoshis,
        height: transaction.blockHeight,
        address: output.address,
        outputIndex: output.mintIndex,
        blockTime: transaction.blockTimeNormalized
      }) + '\n'
    );
  }
}

function byMintIndex(a: WalletOutput, b: WalletOutput) {
  return a.mintIndex - b.mintIndex;
}

function groupByMintTxid(outputs: WalletOutput[]): Map<string, WalletOutput[]> {
  const byTxid = new Map<string, WalletOutput[]>();
  for (const output of outputs) {
    const group = byTxid.get(output.mintTxid) || [];
    group.push(output);
    byTxid.set(output.mintTxid, group);
  }
  for (const group of byTxid.values()) {
    group.sort(byMintIndex);
  }
  return byTxid;
}
