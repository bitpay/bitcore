import { Schema, Document, model, DocumentQuery } from "mongoose";
import { TransformOptions } from "../types/TransformOptions";
import { WalletAddressModel } from "../models/walletAddress";
import { ChainNetwork } from "../types/ChainNetwork";
import { LoggifyObject } from "../decorators/Loggify";
import { TransformableModel } from "../types/TransformableModel";

export interface IWallet extends ChainNetwork {
  name: string;
  singleAddress: boolean;
  pubKey: string;
  path: string;
}
export type WalletQuery = { [key in keyof IWallet]?: any } &
  DocumentQuery<IWallet, Document>;

export type IWalletDoc = IWallet & Document;
export type IWalletModelDoc = IWallet & TransformableModel<IWalletDoc>;
export interface IWalletModel extends IWalletModelDoc {
  _id: Schema.Types.ObjectId
  updateCoins: (wallet: IWalletModelDoc) => any;
}

const WalletSchema = new Schema({
  name: String,
  chain: String,
  network: String,
  singleAddress: Boolean,
  pubKey: String,
  path: String
});

WalletSchema.index({ pubKey: 1 });

WalletSchema.statics._apiTransform = function(
  wallet: IWalletModelDoc,
  options: TransformOptions
) {
  let transform = {
    name: wallet.name,
    pubKey: wallet.pubKey
  };
  if (options && options.object) {
    return transform;
  }
  return JSON.stringify(transform);
};

WalletSchema.statics.updateCoins = async function(wallet: IWalletModel) {
  let addressModels = await WalletAddressModel.find({ wallet: wallet._id });
  let addresses = addressModels.map((model) => model.address);
  return WalletAddressModel.updateCoins({ wallet, addresses });
};

LoggifyObject(WalletSchema.statics, 'WalletSchema');
export let WalletModel: IWalletModel = model<IWalletDoc, IWalletModel>(
  "Wallet",
  WalletSchema
);
