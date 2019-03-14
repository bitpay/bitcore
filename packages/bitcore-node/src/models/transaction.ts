import { CoinStorage } from './coin';
import { WalletAddressStorage } from './walletAddress';
import { partition } from '../utils/partition';
import { ObjectID } from 'bson';
import { TransformOptions } from '../types/TransformOptions';
import { LoggifyClass } from '../decorators/Loggify';
import { Bitcoin } from '../types/namespaces/Bitcoin';
import { BaseModel, MongoBound } from './base';
import logger from '../logger';
import { StreamingFindOptions, Storage, StorageService } from '../services/storage';
import * as lodash from 'lodash';
import { TransactionJSON } from '../types/Transaction';
import { SpentHeightIndicators } from '../types/Coin';
import { Config } from '../services/config';
import { EventStorage } from './events';

const Chain = require('../chain');

export type ITransaction = {
  txid: string;
  chain: string;
  network: string;
  blockHeight?: number;
  blockHash?: string;
  blockTime?: Date;
  blockTimeNormalized?: Date;
  coinbase: boolean;
  fee: number;
  size: number;
  locktime: number;
  inputCount: number;
  outputCount: number;
  value: number;
  wallets: ObjectID[];
};

export type MintOp = {
  updateOne: {
    filter: {
      mintTxid: string;
      mintIndex: number;
      chain: string;
      network: string;
    };
    update: {
      $set: {
        chain: string;
        network: string;
        address: string;
        mintHeight: number;
        coinbase: boolean;
        value: number;
        script: Buffer;
        spentTxid?: string;
        spentHeight?: SpentHeightIndicators;
        wallets?: Array<ObjectID>;
      };
      $setOnInsert: {
        spentHeight: SpentHeightIndicators;
        wallets: Array<ObjectID>;
      };
    };
    upsert: true;
    forceServerObjectId: true;
  };
};

export type SpendOp = {
  updateOne: {
    filter: {
      mintTxid: string;
      mintIndex: number;
      spentHeight: { $lt: SpentHeightIndicators };
      chain: string;
      network: string;
    };
    update: { $set: { spentTxid: string; spentHeight: number } };
  };
};

@LoggifyClass
export class TransactionModel extends BaseModel<ITransaction> {
  constructor(storage?: StorageService) {
    super('transactions', storage);
  }

  allowedPaging = [
    { key: 'blockHash' as 'blockHash', type: 'string' as 'string' },
    { key: 'blockHeight' as 'blockHeight', type: 'number' as 'number' },
    { key: 'blockTimeNormalized' as 'blockTimeNormalized', type: 'date' as 'date' },
    { key: 'txid' as 'txid', type: 'string' as 'string' }
  ];

  onConnect() {
    this.collection.createIndex({ txid: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, blockHeight: 1 }, { background: true });
    this.collection.createIndex({ blockHash: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, blockTimeNormalized: 1 }, { background: true });
    this.collection.createIndex(
      { wallets: 1, blockTimeNormalized: 1 },
      { background: true, partialFilterExpression: { 'wallets.0': { $exists: true } } }
    );
    this.collection.createIndex(
      { wallets: 1, blockHeight: 1 },
      { background: true, partialFilterExpression: { 'wallets.0': { $exists: true } } }
    );
  }

  async batchImport(params: {
    txs: Array<Bitcoin.Transaction>;
    height: number;
    mempoolTime?: Date;
    blockTime?: Date;
    blockHash?: string;
    blockTimeNormalized?: Date;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
    initialSyncComplete: boolean;
  }) {
    const mintOps = await this.getMintOps(params);
    const spendOps = this.getSpendOps({ ...params, mintOps });
    await this.pruneMempool({ ...params, mintOps, spendOps });

    logger.debug('Minting Coins', mintOps.length);
    if (mintOps.length) {
      await Promise.all(
        partition(mintOps, mintOps.length / Config.get().maxPoolSize).map(mintBatch =>
          CoinStorage.collection.bulkWrite(mintBatch, { ordered: false })
        )
      );
    }

    logger.debug('Spending Coins', spendOps.length);
    if (spendOps.length) {
      await Promise.all(
        partition(spendOps, spendOps.length / Config.get().maxPoolSize).map(spendBatch =>
          CoinStorage.collection.bulkWrite(spendBatch, { ordered: false })
        )
      );
    }

    if (mintOps) {
      const txOps = await this.addTransactions({ ...params, mintOps });
      logger.debug('Writing Transactions', txOps.length);
      await Promise.all(
        partition(txOps, txOps.length / Config.get().maxPoolSize).map(txBatch =>
          this.collection.bulkWrite(txBatch, { ordered: false })
        )
      );

      // Create events for mempool txs
      if (params.height < SpentHeightIndicators.minimum) {
        for (let op of txOps) {
          const filter = op.updateOne.filter;
          const tx = { ...op.updateOne.update.$set, ...filter };
          await EventStorage.signalTx(tx);
          await mintOps
            .filter(coinOp => coinOp.updateOne.filter.mintTxid === filter.txid)
            .map(coinOp => {
              const address = coinOp.updateOne.update.$set.address;
              const coin = { ...coinOp.updateOne.update.$set, ...coinOp.updateOne.filter };
              return () => EventStorage.signalAddressCoin({ address, coin }) as any;
            })
            .reduce((promises, promise) => promises.then(promise), Promise.resolve());
        }
      }
    }
  }

  async addTransactions(params: {
    txs: Array<Bitcoin.Transaction>;
    height: number;
    blockTime?: Date;
    blockHash?: string;
    blockTimeNormalized?: Date;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    mintOps: Array<MintOp>;
    mempoolTime?: Date;
  }) {
    let { blockHash, blockTime, blockTimeNormalized, chain, height, network, parentChain, forkHeight } = params;
    if (parentChain && forkHeight && height < forkHeight) {
      const parentTxs = await TransactionStorage.collection
        .find({ blockHeight: height, chain: parentChain, network })
        .toArray();
      return parentTxs.map(parentTx => {
        return {
          updateOne: {
            filter: { txid: parentTx.txid, chain, network },
            update: {
              $set: {
                chain,
                network,
                blockHeight: height,
                blockHash,
                blockTime,
                blockTimeNormalized,
                coinbase: parentTx.coinbase,
                fee: parentTx.fee,
                size: parentTx.size,
                locktime: parentTx.locktime,
                inputCount: parentTx.inputCount,
                outputCount: parentTx.outputCount,
                value: parentTx.value,
                wallets: []
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        };
      });
    } else {
      let spentQuery;
      if (height > 0) {
        spentQuery = { spentHeight: height, chain, network };
      } else {
        spentQuery = { spentTxid: { $in: params.txs.map(tx => tx._hash) }, chain, network };
      }
      const spent = await CoinStorage.collection
        .find(spentQuery)
        .project({ spentTxid: 1, value: 1, wallets: 1 })
        .toArray();
      type CoinGroup = { [txid: string]: { total: number; wallets: Array<ObjectID> } };
      const groupedMints = params.mintOps.reduce<CoinGroup>((agg, coinOp) => {
        const mintTxid = coinOp.updateOne.filter.mintTxid;
        const coin = coinOp.updateOne.update.$set;
        const { value, wallets = [] } = coin;
        if (!agg[mintTxid]) {
          agg[mintTxid] = {
            total: value,
            wallets: wallets || []
          };
        } else {
          agg[mintTxid].total += value;
          agg[mintTxid].wallets.push(...wallets);
        }
        return agg;
      }, {});

      const groupedSpends = spent.reduce<CoinGroup>((agg, coin) => {
        if (!agg[coin.spentTxid]) {
          agg[coin.spentTxid] = {
            total: coin.value,
            wallets: coin.wallets || []
          };
        } else {
          agg[coin.spentTxid].total += coin.value;
          agg[coin.spentTxid].wallets.push(...coin.wallets);
        }
        return agg;
      }, {});

      let txOps = params.txs.map(tx => {
        const txid = tx._hash!;
        const minted = groupedMints[txid] || {};
        const spent = groupedSpends[txid] || {};
        const mintedWallets = minted.wallets || [];
        const spentWallets = spent.wallets || [];
        const txWallets = mintedWallets.concat(spentWallets);
        const wallets = lodash.uniqBy(txWallets, wallet => wallet.toHexString());
        let fee = 0;
        if (groupedMints[txid] && groupedSpends[txid]) {
          // TODO: Fee is negative for mempool txs
          fee = groupedSpends[txid].total - groupedMints[txid].total;
          if (fee < 0) {
            logger.debug('negative fee', txid, groupedSpends[txid], groupedMints[txid]);
          }
        }

        return {
          updateOne: {
            filter: { txid, chain, network },
            update: {
              $set: {
                chain,
                network,
                blockHeight: height,
                blockHash,
                blockTime,
                blockTimeNormalized,
                coinbase: tx.isCoinbase(),
                fee,
                size: tx.toBuffer().length,
                locktime: tx.nLockTime,
                inputCount: tx.inputs.length,
                outputCount: tx.outputs.length,
                value: tx.outputAmount,
                wallets
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        };
      });
      return txOps;
    }
  }

  async getMintOps(params: {
    txs: Array<Bitcoin.Transaction>;
    height: number;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    mintOps?: Array<MintOp>;
  }) {
    let { chain, height, network, parentChain, forkHeight, initialSyncComplete } = params;
    let mintOps = new Array<MintOp>();
    let parentChainCoinsMap = new Map();
    if (parentChain && forkHeight && height < forkHeight) {
      let parentChainCoins = await CoinStorage.collection
        .find({
          chain: parentChain,
          network,
          mintHeight: height,
          $or: [{ spentHeight: { $lt: SpentHeightIndicators.minimum } }, { spentHeight: { $gte: forkHeight } }]
        })
        .project({ mintTxid: 1, mintIndex: 1 })
        .toArray();
      for (const parentChainCoin of parentChainCoins) {
        parentChainCoinsMap.set(`${parentChainCoin.mintTxid}:${parentChainCoin.mintIndex}`, true);
      }
    }
    for (let tx of params.txs) {
      tx._hash = tx.hash;
      let isCoinbase = tx.isCoinbase();
      for (let [index, output] of tx.outputs.entries()) {
        if (
          parentChain &&
          forkHeight &&
          height < forkHeight &&
          (!parentChainCoinsMap.size || !parentChainCoinsMap.get(`${tx._hash}:${index}`))
        ) {
          continue;
        }
        let address = '';
        if (output.script) {
          address = output.script.toAddress(network).toString(true);
          if (address === 'false' && output.script.classify() === 'Pay to public key') {
            let hash = Chain[chain].lib.crypto.Hash.sha256ripemd160(output.script.chunks[0].buf);
            address = Chain[chain].lib.Address(hash, network).toString(true);
          }
        }
        mintOps.push({
          updateOne: {
            filter: {
              mintTxid: tx._hash,
              mintIndex: index,
              chain,
              network
            },
            update: {
              $set: {
                chain,
                network,
                address,
                mintHeight: height,
                coinbase: isCoinbase,
                value: output.satoshis,
                script: output.script && output.script.toBuffer()
              },
              $setOnInsert: {
                spentHeight: SpentHeightIndicators.unspent,
                wallets: []
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        });
      }
    }

    const walletConfig = Config.for('api').wallets;
    if (initialSyncComplete || (walletConfig && walletConfig.allowCreationBeforeCompleteSync)) {
      let mintOpsAddresses = {};
      for (const mintOp of mintOps) {
        mintOpsAddresses[mintOp.updateOne.update.$set.address] = true;
      }
      mintOpsAddresses = Object.keys(mintOpsAddresses);
      let wallets = await WalletAddressStorage.collection
        .find({ address: { $in: mintOpsAddresses }, chain, network }, { batchSize: 100 })
        .project({ wallet: 1, address: 1 })
        .toArray();
      if (wallets.length) {
        mintOps = mintOps.map(mintOp => {
          let transformedWallets = wallets
            .filter(wallet => wallet.address === mintOp.updateOne.update.$set.address)
            .map(wallet => wallet.wallet);
          mintOp.updateOne.update.$set.wallets = transformedWallets;
          delete mintOp.updateOne.update.$setOnInsert.wallets;
          if (!Object.keys(mintOp.updateOne.update.$setOnInsert).length) {
            delete mintOp.updateOne.update.$setOnInsert;
          }
          return mintOp;
        });
      }
    }

    return mintOps;
  }

  getSpendOps(params: {
    txs: Array<Bitcoin.Transaction>;
    height: number;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
    mintOps?: Array<MintOp>;
    [rest: string]: any;
  }) {
    let { chain, network, height, parentChain, forkHeight } = params;
    let spendOps: SpendOp[] = [];
    if (parentChain && forkHeight && height < forkHeight) {
      return spendOps;
    }
    let mintMap = {} as Mapping<Mapping<MintOp>>;
    for (let mintOp of params.mintOps || []) {
      mintMap[mintOp.updateOne.filter.mintTxid] = mintMap[mintOp.updateOne.filter.mintIndex] || {};
      mintMap[mintOp.updateOne.filter.mintTxid][mintOp.updateOne.filter.mintIndex] = mintOp;
    }
    for (let tx of params.txs) {
      if (tx.isCoinbase()) {
        continue;
      }
      for (let input of tx.inputs) {
        let inputObj = input.toObject();
        let sameBlockSpend = mintMap[inputObj.prevTxId] && mintMap[inputObj.prevTxId][inputObj.outputIndex];
        if (sameBlockSpend) {
          sameBlockSpend.updateOne.update.$set.spentHeight = height;
          delete sameBlockSpend.updateOne.update.$setOnInsert.spentHeight;
          if (!Object.keys(sameBlockSpend.updateOne.update.$setOnInsert).length) {
            delete sameBlockSpend.updateOne.update.$setOnInsert;
          }
          sameBlockSpend.updateOne.update.$set.spentTxid = tx._hash;
          continue;
        }
        const updateQuery = {
          updateOne: {
            filter: {
              mintTxid: inputObj.prevTxId,
              mintIndex: inputObj.outputIndex,
              spentHeight: { $lt: SpentHeightIndicators.minimum },
              chain,
              network
            },
            update: { $set: { spentTxid: tx._hash || tx.hash, spentHeight: height } }
          }
        };
        spendOps.push(updateQuery);
      }
    }
    return spendOps;
  }

  async pruneMempool(params: {
    txs: Array<Bitcoin.Transaction>;
    height: number;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
    mintOps: Array<MintOp>;
    spendOps: Array<SpendOp>;
    initialSyncComplete: boolean;
    [rest: string]: any;
  }) {
    const { chain, network, spendOps, initialSyncComplete } = params;
    if (!initialSyncComplete || !spendOps.length) {
      return;
    }
    let prunedTxs = {};
    for (const spendOp of spendOps) {
      let coin = await CoinStorage.collection.findOne(
        {
          chain,
          network,
          spentHeight: SpentHeightIndicators.pending,
          mintTxid: spendOp.updateOne.filter.mintTxid,
          mintIndex: spendOp.updateOne.filter.mintIndex,
          spentTxid: { $ne: spendOp.updateOne.update.$set.spentTxid }
        },
        { projection: { spentTxid: 1 } }
      );
      if (coin) {
        prunedTxs[coin.spentTxid] = true;
      }
    }
    if (Object.keys(prunedTxs).length) {
      prunedTxs = Object.keys(prunedTxs);
      await Promise.all([
        this.collection.update(
          { txid: { $in: prunedTxs } },
          { $set: { blockHeight: SpentHeightIndicators.conflicting } },
          { w: 0, j: false, multi: true }
        ),
        CoinStorage.collection.update(
          { mintTxid: { $in: prunedTxs } },
          { $set: { mintHeight: SpentHeightIndicators.conflicting } },
          { w: 0, j: false, multi: true }
        )
      ]);
    }
    return;
  }

  getTransactions(params: { query: any; options: StreamingFindOptions<ITransaction> }) {
    let originalQuery = params.query;
    const { query, options } = Storage.getFindOptions(this, params.options);
    const finalQuery = Object.assign({}, originalQuery, query);
    return this.collection.find(finalQuery, options).addCursorFlag('noCursorTimeout', true);
  }

  _apiTransform(tx: Partial<MongoBound<ITransaction>>, options?: TransformOptions): TransactionJSON | string {
    const transaction: TransactionJSON = {
      _id: tx._id ? tx._id.toString() : '',
      txid: tx.txid || '',
      network: tx.network || '',
      chain: tx.chain || '',
      blockHeight: tx.blockHeight || -1,
      blockHash: tx.blockHash || '',
      blockTime: tx.blockTime ? tx.blockTime.toISOString() : '',
      blockTimeNormalized: tx.blockTimeNormalized ? tx.blockTimeNormalized.toISOString() : '',
      coinbase: tx.coinbase || false,
      locktime: tx.locktime || -1,
      inputCount: tx.inputCount || -1,
      outputCount: tx.outputCount || -1,
      size: tx.size || -1,
      fee: tx.fee || -1,
      value: tx.value || -1
    };
    if (options && options.object) {
      return transaction;
    }
    return JSON.stringify(transaction);
  }
}
export let TransactionStorage = new TransactionModel();
