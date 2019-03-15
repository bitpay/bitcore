import { WalletAddressStorage } from '../models/walletAddress';
import { BaseModel } from './base';
import { ObjectID } from 'mongodb';
import { StorageService } from '../services/storage';

export type IWallet = {
  _id?: ObjectID;
  chain: string;
  network: string;
  name: string;
  singleAddress: boolean;
  pubKey: string;
  path: string;
};

export class WalletModel extends BaseModel<IWallet> {
  constructor(storage?: StorageService) {
    super('wallets', storage);
  }
  allowedPaging = [];

  onConnect() {
    this.collection.createIndex({ pubKey: 1 }, { background: true });
  }

  _apiTransform(wallet: IWallet, options?: TransformOptions) {
    return { name: wallet.name, pubKey: wallet.pubKey };
  }

  async updateCoins(wallet: IWallet) {
    let addressModels = await WalletAddressStorage.collection
      .find({ wallet: wallet._id })
      .addCursorFlag('noCursorTimeout', true)
      .toArray();
    let addresses = addressModels.map(model => model.address);
    return WalletAddressStorage.updateCoins({ wallet, addresses });
  }
}

export let WalletStorage = new WalletModel();
