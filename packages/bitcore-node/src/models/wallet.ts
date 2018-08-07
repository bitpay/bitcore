import { WalletAddressModel } from '../models/walletAddress';
import { BaseModel, MongoBound } from './base';
import { TransformOptions } from '../types/TransformOptions';

export type IWallet = {
  chain: string;
  network: string;
  name: string;
  singleAddress: boolean;
  pubKey: string;
  path: string;
};

export class Wallet extends BaseModel<IWallet> {
  constructor() {
    super('wallets');
  }
  allowedPaging = [];

  onConnect() {
    this.collection.createIndex({ pubKey: 1 });
  }

  _apiTransform(wallet: IWallet, options: TransformOptions) {
    let transform = { name: wallet.name, pubKey: wallet.pubKey };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }

  async updateCoins(wallet: MongoBound<IWallet>) {
    let addressModels = await WalletAddressModel.collection.find({ wallet: wallet._id }).toArray();
    let addresses = addressModels.map(model => model.address);
    return WalletAddressModel.updateCoins({ wallet, addresses });
  }
}

export let WalletModel = new Wallet();
