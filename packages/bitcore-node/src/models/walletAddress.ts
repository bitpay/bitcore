import { Schema, Document, model, DocumentQuery } from "mongoose";
import { CoinModel, ICoinModel } from "./coin";
import { TransformOptions } from "../types/TransformOptions";
import { partition } from "../utils/partition";
import {IWalletModel} from "./wallet";
import {TransactionModel} from "./transaction";
import { TransformableModel } from "../types/TransformableModel";
import { LoggifyObject } from "../decorators/Loggify";


interface IWalletAddress {
  wallet: Schema.Types.ObjectId;
  address: string;
  chain: string;
  network: string;
}

export type IWalletAddressQuery = { [key in keyof IWalletAddress]?: any } &
  DocumentQuery<IWalletAddress, Document>;

type IWalletAddressDoc = IWalletAddress & Document;
type IWalletAddressDocModel = IWalletAddressDoc & TransformableModel<IWalletAddressDoc>;

export type UpdateCoinsParams = {
  wallet: IWalletModel;
  addresses: string[];
};

interface IWalletAddressModel extends IWalletAddressDocModel{
  updateCoins: (params: UpdateCoinsParams) => Promise<any>;
}

const WalletAddressSchema = new Schema({
  wallet: Schema.Types.ObjectId,
  address: String,
  chain: String,
  network: String
});

WalletAddressSchema.index({ address: 1, wallet: 1 });

WalletAddressSchema.statics._apiTransform = function(
  walletAddress:{ address: string },
  options: TransformOptions
) {
  let transform = {
    address: walletAddress.address
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

WalletAddressSchema.statics.updateCoins = async function(
  params: UpdateCoinsParams
) {
  const { wallet, addresses } = params;
  const { chain, network } = wallet;
  let walletUpdates = addresses.map((address: string) => {
    return {
      updateOne: {
        filter: { wallet: wallet._id, address: address },
        update: { wallet: wallet._id, address: address, chain, network },
        upsert: true
      }
    };
  });

  let walletUpdateBatches = partition(walletUpdates, 500);
  let coinUpdates = addresses.map((address: string) => {
    return {
      updateMany: {
        filter: { chain, network, address },
        update: {
          $addToSet: { wallets: wallet._id }
        }
      }
    };
  });
  let coinUpdateBatches = partition(coinUpdates, 500);

  return new Promise(async resolve => {
    await Promise.all(
      walletUpdateBatches.map(walletUpdateBatch => {
        return WalletAddressModel.collection.bulkWrite(walletUpdateBatch, { ordered: false });
      })
    );

    await Promise.all(
      coinUpdateBatches.map(coinUpdateBatch => {
        return CoinModel.collection.bulkWrite(coinUpdateBatch, {
          ordered: false
        });
      })
    );
    let coinCursor = CoinModel.find(
      { wallets: wallet._id },
      { spentTxid: 1, mintTxid: 1 }
    ).cursor();

    coinCursor.on("data", function(data: ICoinModel) {
      
      const Transaction = TransactionModel;
      coinCursor.pause();
      Transaction.update(
        { chain, network, txid: { $in: [data.spentTxid, data.mintTxid] } },
        {
          $addToSet: { wallets: wallet._id }
        },
        { multi: true },
        function() {
          // TODO Error handling if update fails?
          coinCursor.resume();
        }
      );
    });

    coinCursor.on("end", function() {
      resolve();
    });
  });
};

LoggifyObject(WalletAddressSchema.statics, 'WalletAddressSchema');
export let WalletAddressModel: IWalletAddressModel = model<IWalletAddressDoc, IWalletAddressModel>("WalletAddress", WalletAddressSchema);
