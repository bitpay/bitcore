import { CoinModel, ICoin } from './coin';
import { WalletAddressModel } from './walletAddress';
import { partition } from '../utils/partition';
import { ObjectId } from 'mongodb';
import { TransformOptions } from '../types/TransformOptions';
import { LoggifyClass } from '../decorators/Loggify';
import { Bitcoin } from '../types/namespaces/Bitcoin';
import { BaseModel } from './base';
import logger from '../logger';
import config from '../config';
import { BulkWriteOpResultObject } from 'mongodb';

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
  wallets: ObjectId[];
};

@LoggifyClass
export class Transaction extends BaseModel<ITransaction> {
  constructor() {
    super('transactions');
  }

  allowedPaging = [{ key: 'blockHeight' as 'blockHeight', type: 'number' as 'number' }];

  onConnect() {
    this.collection.createIndex({ txid: 1 });
    this.collection.createIndex({ blockHeight: 1, chain: 1, network: 1 });
    this.collection.createIndex({ blockHash: 1 });
    this.collection.createIndex({ blockTimeNormalized: 1, chain: 1, network: 1 });
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
    initialSyncComplete: boolean;
    mintOps?: Array<any>;
  }) {
    let mintOps = await this.getMintOps(params);
    logger.debug('Minting Coins', mintOps.length);
   
    params.mintOps = mintOps || [];
    let spendOps = this.getSpendOps(params);
    logger.debug('Spending Coins', spendOps.length);
    if (mintOps.length) {
      mintOps = partition(mintOps, mintOps.length / config.maxPoolSize);
      mintOps = mintOps.map((mintBatch: Array<any>) => CoinModel.collection.bulkWrite(mintBatch, { ordered: false }));
    }
    if (spendOps.length) {
      spendOps = partition(spendOps, spendOps.length / config.maxPoolSize);
      spendOps = spendOps.map((spendBatch: Array<any>) =>
        CoinModel.collection.bulkWrite(spendBatch, { ordered: false })
      );
    }
    const coinOps = mintOps.concat(spendOps);
    await Promise.all(coinOps);

    let txs: Promise<BulkWriteOpResultObject>[] = [];
    if (mintOps) {
      let txOps = await this.addTransactions(params);
      logger.debug('Writing Transactions', txOps.length);
      const txBatches = partition(txOps, txOps.length / config.maxPoolSize);
      txs = txBatches.map((txBatch: Array<any>) => this.collection.bulkWrite(txBatch, { ordered: false, j: false, w: 0 }));
    }

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
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    mintOps?: Array<any>;
  }) {
    let { blockHash, blockTime, blockTimeNormalized, chain, height, network, txs, initialSyncComplete } = params;
    let txids = txs.map(tx => tx._hash) as Array<string>;

    type TaggedCoin = ICoin & { _id: string };
    let mintedTxWallets;
    let spentTxWallets;

    if (initialSyncComplete) {
      mintedTxWallets = await CoinModel.collection
        .aggregate<TaggedCoin>([
          { $match: { mintTxid: { $in: txids }, chain, network } },
          { $unwind: '$wallets' },
          { $group: { _id: '$mintTxid', wallets: { $addToSet: '$wallets' } } }
        ])
        .toArray();

      spentTxWallets = await CoinModel.collection
        .aggregate<TaggedCoin>([
       { $match: { spentTxid: { $in: txids }, chain, network } },
          { $unwind: '$wallets' },
          { $group: { _id: '$spentTxid', wallets: { $addToSet: '$wallets' } } }
        ])
        .toArray();
    }

    let txInputs: { [txid: string]: number } = {};
    let megaOr = new Array<any>();
    for (let tx of txs) {
      //console.log('Finding inputs for ', tx._hash);
      const spentInputQueries = tx.inputs.map(input => {
        const txInput = input.toObject();
        if (txInput) {
          return {
            mintTxid: txInput.prevTxId,
            mintIndex: txInput.outputIndex
          };
        }
        return;
      });
      megaOr = megaOr.concat(spentInputQueries);
    }
    //console.log('Mega OR Len', megaOr.length);
    const coinInputs = await CoinModel.collection
      .aggregate<{ _id: string; total: number }>([
        { $match: { $or: megaOr } },
        { $group: { _id: '$spentTxid', total: { $sum: '$value' } } }
      ])
      .toArray();
    //console.log('Aggregate finished');

    for (let input of coinInputs) {
      //console.log(input._id, input.total);
      txInputs[input._id] = input.total;
    }

    let txOps = new Array<any>();
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      let wallets = new Array<ObjectId>();
      if (initialSyncComplete) {
        const walletTxGroups = mintedTxWallets.concat(spentTxWallets);
        for (let wallet of walletTxGroups.filter(walletTxGroup => walletTxGroup._id === txids[i])) {
          for (let walletMatch of wallet.wallets) {
            if (!wallets.find(wallet => wallet.toHexString() === walletMatch.toHexString())) {
              wallets.push(walletMatch);
            }
          }
        }
      }

      const totalOut = tx.outputAmount;
      const sumInput = txInputs[txids[i]] || 0;
      const fee = sumInput - totalOut;
      txOps.push({
        updateOne: {
          filter: { txid: txids[i], chain, network },
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
              fee,
              wallets
            }
          },
          upsert: true,
          forceServerObjectId: true
        }
      });
    }
    //console.log('Returning txops', txOps.length);
    return txOps;
  }

  async getMintOps(params: {
    txs: Array<Bitcoin.Transaction>;
    height: number;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    mintOps?: Array<any>;
  }): Promise<any> {
    let { chain, height, network, txs, parentChain, forkHeight, initialSyncComplete } = params;
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

    if (initialSyncComplete) {
      let mintOpsAddresses = mintOps.map(mintOp => mintOp.updateOne.update.$set.address);
      let walletAddresses = await WalletAddressModel.collection
        .find({ address: { $in: mintOpsAddresses }, chain, network }, { batchSize: 100 })
        .toArray();
      if (walletAddresses.length) {
        mintOps = mintOps.map(mintOp => {
          let transformedWallets = walletAddresses
            .filter(walletAddress => walletAddress.address === mintOp.updateOne.update.$set.address)
            .map(walletAddress => walletAddress.wallet);
          mintOp.updateOne.update.$set.wallets = transformedWallets;
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
    mintOps?: Array<any>;
  }): Array<any> {
    let { chain, network, height, txs, parentChain, forkHeight, mintOps=[] } = params;
    let spendOps: any[] = [];
    if (parentChain && forkHeight && height < forkHeight) {
      return spendOps;
    }
    let mintMap = {};
    for (let mintOp of mintOps) {
      mintMap[mintOp.updateOne.filter.mintTxid] = mintMap[mintOp.updateOne.filter.mintIndex] || {};
      mintMap[mintOp.updateOne.filter.mintTxid][mintOp.updateOne.filter.mintIndex] = mintOp;
    }
    for (let tx of txs) {
      if (tx.isCoinbase()) {
        continue;
      }
      let txid = tx._hash;
      for (let input of tx.inputs) {
        let inputObj = input.toObject();
        let sameBlockSpend = mintMap[inputObj.prevTxId] && mintMap[inputObj.prevTxId][inputObj.outputIndex];
        if (sameBlockSpend){
          sameBlockSpend.updateOne.update.$set.spentHeight = height;
          sameBlockSpend.updateOne.update.$set.spentTxid = txid;
          if (config.pruneSpentScripts && height > 0) {
            delete sameBlockSpend.updateOne.update.$set.script;
          }
          continue;
        }
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
    return this.collection.find(query).addCursorFlag('noCursorTimeout', true);
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
