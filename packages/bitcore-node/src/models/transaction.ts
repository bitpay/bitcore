import { CoinModel, ICoin } from './coin';
import { WalletAddressModel } from './walletAddress';
import { partition } from '../utils/partition';
import { ObjectID } from 'bson';
import { TransformOptions } from '../types/TransformOptions';
import { LoggifyClass } from '../decorators/Loggify';
import { Bitcoin } from '../types/namespaces/Bitcoin';
import { BaseModel } from './base';
import logger from '../logger';
import config from '../config';

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
  wallets: ObjectID[];
};

@LoggifyClass
export class Transaction extends BaseModel<ITransaction> {
  constructor() {
    super('transactions');
  }

  allowedPaging = [{ key: 'blockHeight' as 'blockHeight', type: 'number' as 'number' }];

  onConnect() {
    this.collection.createIndex({ txid: 1 });
    this.collection.createIndex({ chain: 1, network: 1, blockHeight: 1 });
    this.collection.createIndex({ blockHash: 1 });
    this.collection.createIndex({ chain: 1, network: 1, blockTimeNormalized: 1 });
    this.collection.createIndex({ wallets: 1 }, { sparse: true });
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
  }) {
    let mintOps = await this.getMintOps(params);
    logger.debug('Minting Coins', mintOps.length);
    if (mintOps.length) {
      mintOps = partition(mintOps, mintOps.length / config.maxPoolSize);
      mintOps = mintOps.map((mintBatch: Array<any>) => CoinModel.collection.bulkWrite(mintBatch, { ordered: false }));
      await Promise.all(mintOps);
    }

    let spendOps = this.getSpendOps(params);
    logger.debug('Spending Coins', spendOps.length);
    if (spendOps.length) {
      spendOps = partition(spendOps, spendOps.length / config.maxPoolSize);
      spendOps = spendOps.map((spendBatch: Array<any>) =>
        CoinModel.collection.bulkWrite(spendBatch, { ordered: false })
      );
      await Promise.all(spendOps);
    }

    let txOps = await this.addTransactions(params);
    logger.debug('Writing Transactions', txOps.length);
    const txBatches = partition(txOps, txOps.length / config.maxPoolSize);
    const txs = txBatches.map((txBatch: Array<any>) => this.collection.bulkWrite(txBatch, { ordered: false }));
    await Promise.all(txs);
  }

  async addTransactions(params: {
    txs: Array<Bitcoin.Transaction>;
    height: number;
    blockTime?: Date;
    blockHash?: string;
    blockTimeNormalized?: Date;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
  }) {
    let { blockHash, blockTime, blockTimeNormalized, chain, height, network, txs } = params;
    let txids = txs.map(tx => tx._hash);

    type TaggedCoin = ICoin & { _id: string };
    let mintWallets = await CoinModel.collection
      .aggregate<TaggedCoin>([
        { $match: { mintTxid: { $in: txids }, chain, network } },
        { $unwind: '$wallets' },
        { $group: { _id: '$mintTxid', wallets: { $addToSet: '$wallets' } } }
      ])
      .toArray();

    let spentWallets = await CoinModel.collection
      .aggregate<TaggedCoin>([
        { $match: { spentTxid: { $in: txids }, chain, network } },
        { $unwind: '$wallets' },
        { $group: { _id: '$spentTxid', wallets: { $addToSet: '$wallets' } } }
      ])
      .toArray();

    let txOps = txs.map((tx, index) => {
      let wallets = new Array<ObjectID>();
      for (let wallet of mintWallets.concat(spentWallets).filter(wallet => wallet._id === txids[index])) {
        for (let walletMatch of wallet.wallets) {
          if (!wallets.find(wallet => wallet.toHexString() === walletMatch.toHexString())) {
            wallets.push(walletMatch);
          }
        }
      }

      return {
        updateOne: {
          filter: { txid: txids[index], chain, network },
          update: {
            $set: {
              chain,
              network,
              blockHeight: height,
              blockHash,
              blockTime,
              blockTimeNormalized,
              coinbase: tx.isCoinbase(),
              size: tx.toBuffer().length,
              locktime: tx.nLockTime,
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

  async getMintOps(params: {
    txs: Array<Bitcoin.Transaction>;
    height: number;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
  }): Promise<any> {
    let { chain, height, network, txs, parentChain, forkHeight } = params;
    let mintOps = new Array<any>();
    let parentChainCoins = new Array<ICoin>();
    if (parentChain && forkHeight && height < forkHeight) {
      parentChainCoins = await CoinModel.collection
        .find({
          chain: parentChain,
          network,
          mintHeight: height,
          spentHeight: { $gt: -2, $lt: forkHeight }
        })
        .toArray();
    }
    for (let tx of txs) {
      tx._hash = tx.hash;
      let txid = tx._hash;
      let isCoinbase = tx.isCoinbase();
      for (let [index, output] of tx.outputs.entries()) {
        let parentChainCoin = parentChainCoins.find(
          (parentChainCoin: ICoin) => parentChainCoin.mintTxid === txid && parentChainCoin.mintIndex === index
        );
        if (parentChainCoin) {
          continue;
        }
        let address = '';
        let scriptBuffer = output.script && output.script.toBuffer();
        if (scriptBuffer) {
          address = output.script.toAddress(network).toString(true);
          if (address === 'false' && output.script.classify() === 'Pay to public key') {
            let hash = Chain[chain].lib.crypto.Hash.sha256ripemd160(output.script.chunks[0].buf);
            address = Chain[chain].lib.Address(hash, network).toString(true);
          }
        }

        mintOps.push({
          updateOne: {
            filter: { mintTxid: txid, mintIndex: index, spentHeight: { $lt: 0 }, chain, network },
            update: {
              $set: {
                chain,
                network,
                mintHeight: height,
                coinbase: isCoinbase,
                value: output.satoshis,
                address,
                script: scriptBuffer,
                spentHeight: -2,
                wallets: []
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        });
      }
    }
    let mintOpsAddresses = mintOps.map(mintOp => mintOp.updateOne.update.$set.address);
    let wallets = await WalletAddressModel.collection
      .find({ address: { $in: mintOpsAddresses }, chain, network }, { batchSize: 100 })
      .toArray();
    if (wallets.length) {
      mintOps = mintOps.map(mintOp => {
        let transformedWallets = wallets
          .filter(wallet => wallet.address === mintOp.updateOne.update.$set.address)
          .map(wallet => wallet.wallet);
        mintOp.updateOne.update.$set.wallets = transformedWallets;
        return mintOp;
      });
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
  }): Array<any> {
    let { chain, network, height, txs, parentChain, forkHeight } = params;
    let spendOps: any[] = [];
    if (parentChain && forkHeight && height < forkHeight) {
      return spendOps;
    }
    for (let tx of txs) {
      if (tx.isCoinbase()) {
        continue;
      }
      let txid = tx._hash;
      for (let input of tx.inputs) {
        let inputObj = input.toObject();
        const updateQuery: any = {
          updateOne: {
            filter: {
              mintTxid: inputObj.prevTxId,
              mintIndex: inputObj.outputIndex,
              spentHeight: { $lt: 0 },
              chain,
              network
            },
            update: { $set: { spentTxid: txid, spentHeight: height } }
          }
        };
        if (config.pruneSpentScripts && height > 0) {
          updateQuery.updateOne.update.$unset = { script: null };
        }
        spendOps.push(updateQuery);
      }
    }
    return spendOps;
  }

  getTransactions(params: { query: any }) {
    let query = params.query;
    return this.collection.find(query);
  }

  _apiTransform(tx: ITransaction, options: TransformOptions) {
    let transform = {
      txid: tx.txid,
      network: tx.network,
      blockHeight: tx.blockHeight,
      blockHash: tx.blockHash,
      blockTime: tx.blockTime,
      blockTimeNormalized: tx.blockTimeNormalized,
      coinbase: tx.coinbase,
      size: tx.size,
      fee: tx.fee
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }
}
export let TransactionModel = new Transaction();
