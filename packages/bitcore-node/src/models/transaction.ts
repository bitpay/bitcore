import { Schema, Document, model, DocumentQuery } from "mongoose";
import { CoinModel, CoinQuery, ICoinModel } from "./coin";
import { WalletAddressModel } from "./walletAddress";
import { BitcoinTransactionType } from "../types/Transaction";
import { partition } from "../utils/partition";
import { ObjectID } from "bson";
import { TransformOptions } from "../types/TransformOptions";
import { ChainNetwork } from "../types/ChainNetwork";
import { TransformableModel } from "../types/TransformableModel";
import logger from "../logger";
import { LoggifyObject } from "../decorators/Loggify";
const config = require("../config");
const Chain = require("../chain");

export interface ITransaction {
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
}
export type TransactionQuery = {[key in keyof ITransaction]?: any}&
  Partial<DocumentQuery<ITransaction, Document>>;

type ITransactionDoc = ITransaction & Document;
type ITransactionModelDoc = ITransactionDoc & TransformableModel<ITransactionDoc>;

type BatchImportMethodParams = {
  txs: Array<BitcoinTransactionType>;
  height: number;
  blockTime?: Date;
  blockHash?: string;
  blockTimeNormalized?: Date;
  parentChain?: string;
  forkHeight?: number;
} & ChainNetwork;

type CoinWalletAggregate = ICoinModel & { wallets: ObjectID[] };

export interface ITransactionModel extends ITransactionModelDoc {
  batchImport: (params: BatchImportMethodParams) => Promise<any>;
  getTransactions: (params: { query: TransactionQuery }) => any;
  getMintOps: (params: BatchImportMethodParams) => Promise<any>;
  getSpendOps: (params: BatchImportMethodParams) => Array<any>;
  addTransactions: (params: BatchImportMethodParams) => Promise<any>;
}

const TransactionSchema = new Schema({
  txid: String,
  chain: String,
  network: String,
  blockHeight: Number,
  blockHash: String,
  blockTime: Date,
  blockTimeNormalized: Date,
  coinbase: Boolean,
  fee: Number,
  size: Number,
  locktime: Number,
  wallets: { type: [Schema.Types.ObjectId] }
});

TransactionSchema.index({ txid: 1 });
TransactionSchema.index({ chain: 1, network: 1, blockHeight: 1 });
TransactionSchema.index({ blockHash: 1 });
TransactionSchema.index({ chain: 1, network: 1, blockTimeNormalized: 1 });
TransactionSchema.index({ wallets: 1 }, { sparse: true });

TransactionSchema.statics.batchImport = async function(
  params: BatchImportMethodParams
) {
  return new Promise(async resolve => {
    let mintOps = await TransactionModel.getMintOps(params);
    logger.debug('Minting Coins', mintOps.length);
    if (mintOps.length) {
      mintOps = partition(mintOps, 100);
      mintOps = mintOps.map((mintBatch: Array<CoinQuery>) =>
        CoinModel.collection.bulkWrite(mintBatch, { ordered: false })
      );
      await Promise.all(mintOps);
    }

    let spendOps = TransactionModel.getSpendOps(params);
    logger.debug('Spending Coins', spendOps.length);
    if (spendOps.length) {
      spendOps = partition(spendOps, 100);
      spendOps = spendOps.map((spendBatch: Array<CoinQuery>) =>
        CoinModel.collection.bulkWrite(spendBatch, { ordered: false })
      );
      await Promise.all(spendOps);
    }

    let txOps = await TransactionModel.addTransactions(params);
    logger.debug('Writing Transactions', txOps.length);
    txOps = partition(txOps, 100);
    txOps = txOps.map((txBatch: Array<CoinQuery>) =>
      TransactionModel.collection.bulkWrite(txBatch, { ordered: false })
    );
    await Promise.all(txOps);
    resolve();
  });
};

TransactionSchema.statics.addTransactions = async function(
  params: BatchImportMethodParams
) {
  let {
    blockHash,
    blockTime,
    blockTimeNormalized,
    chain,
    height,
    network,
    txs
  } = params;
  return new Promise(async (resolve, reject) => {
    let txids = txs.map(tx => tx._hash);
    let mintWallets: CoinWalletAggregate[];
    let spentWallets: CoinWalletAggregate[];
    try {
      mintWallets = await CoinModel.collection
        .aggregate([
          {
            $match: { mintTxid: { $in: txids }, chain, network }
          },
          { $unwind: "$wallets" },
          { $group: { _id: "$mintTxid", wallets: { $addToSet: "$wallets" } } }
        ])
        .toArray();
      spentWallets = await CoinModel.collection
        .aggregate([
          {
            $match: { spentTxid: { $in: txids }, chain, network }
          },
          { $unwind: "$wallets" },
          { $group: { _id: "$spentTxid", wallets: { $addToSet: "$wallets" } } }
        ])
        .toArray();
    } catch (e) {
      reject(e);
    }

    let txOps = txs.map((tx, index) => {
      let wallets = new Array<ObjectID>();
      for (let wallet of mintWallets
        .concat(spentWallets)
        .filter(wallet => wallet._id === txids[index])) {
        for (let walletMatch of wallet.wallets) {
          if (
            !wallets.find(
              wallet => wallet.toHexString() === walletMatch.toHexString()
            )
          ) {
            wallets.push(walletMatch);
          }
        }
      }

      return {
        updateOne: {
          filter: {
            txid: txids[index],
            chain,
            network
          },
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
    resolve(txOps);
  });
};

TransactionSchema.statics.getMintOps = async function(
  params: BatchImportMethodParams
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let { chain, height, network, txs, parentChain, forkHeight } = params;
    let mintOps = [] as Array<any>;
    let parentChainCoins = [];
    if (parentChain && forkHeight && height < forkHeight) {
      parentChainCoins = await CoinModel.find({
        chain: parentChain,
        network,
        mintHeight: height,
        spentHeight: { $gt: -2, $lt: forkHeight }
      }).lean();
    }
    for (let tx of txs) {
      tx._hash = tx.hash;
      let txid = tx._hash;
      let isCoinbase = tx.isCoinbase();
      for (let [index, output] of tx.outputs.entries()) {
        let parentChainCoin = parentChainCoins.find(
          (parentChainCoin: ICoinModel) =>
          parentChainCoin.mintTxid === txid &&
          parentChainCoin.mintIndex === index
        );
        if (parentChainCoin) {
          continue;
        }
        let address = "";
        let scriptBuffer = output.script && output.script.toBuffer();
        if (scriptBuffer) {
          address = output.script.toAddress(network).toString();
          if (
            address === "false" &&
            output.script.classify() === "Pay to public key"
          ) {
            let hash = Chain[chain].lib.crypto.Hash.sha256ripemd160(
              output.script.chunks[0].buf
            );
            address = Chain[chain].lib.Address(hash, network).toString();
          }
        }

        mintOps.push({
          updateOne: {
            filter: {
              mintTxid: txid,
              mintIndex: index,
              spentHeight: { $lt: 0 },
              chain,
              network
            },
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
    let mintOpsAddresses = mintOps.map(
      mintOp => mintOp.updateOne.update.$set.address
    );
    try {
      let wallets = await WalletAddressModel.collection
        .find(
          { address: { $in: mintOpsAddresses }, chain, network },
          { batchSize: 100 }
        )
        .toArray();
      if (wallets.length) {
        mintOps = mintOps.map(mintOp => {
          let transformedWallets = wallets
            .filter(
              wallet => wallet.address === mintOp.updateOne.update.$set.address
            )
            .map(wallet => wallet.wallet);

          Object.assign(mintOp, {
            updateOne: { update: { $set: { wallets: transformedWallets } } }
          });
          return mintOp;
        });
      }
      resolve(mintOps);
    } catch (e) {
      reject(e);
    }
  });
};

TransactionSchema.statics.getSpendOps = function(
  params: BatchImportMethodParams
): Array<any> {
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
      const updateQuery = {
        updateOne: {
          filter: {
            mintTxid: inputObj.prevTxId,
            mintIndex: inputObj.outputIndex,
            spentHeight: { $lt: 0 },
            chain,
            network
          },
          update: {
            $set: {
              spentTxid: txid,
              spentHeight: height
            }
          }
        }
      };
      if (config.pruneSpentScripts && height > 0) {
        Object.assign(updateQuery, {
          updateOne: { update: { $unset: { script: null } } }
        });
      }
      spendOps.push(updateQuery);
    }
  }
  return spendOps;
};

TransactionSchema.statics.getTransactions = function(params: {
  query: TransactionQuery;
}) {
  let query = params.query;
  return TransactionModel.collection.aggregate([
    { $match: query },
    {
      $lookup: {
        from: "coins",
        localField: "txid",
        foreignField: "spentTxid",
        as: "inputs"
      }
    },
    {
      $lookup: {
        from: "coins",
        localField: "txid",
        foreignField: "mintTxid",
        as: "outputs"
      }
    }
  ]);
};

TransactionSchema.statics._apiTransform = function(
  tx: ITransactionModel,
  options: TransformOptions
) {
  let transform = {
    txid: tx.txid,
    network: tx.network,
    blockHeight: tx.blockHeight,
    blockHash: tx.blockHash,
    blockTime: tx.blockTime,
    blockTimeNormalized: tx.blockTimeNormalized,
    coinbase: tx.coinbase,
    fee: tx.fee
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

LoggifyObject(TransactionSchema.statics, 'TransactionSchema');
export let TransactionModel: ITransactionModel = model<
  ITransactionDoc,
  ITransactionModel
  >("Transaction", TransactionSchema);
