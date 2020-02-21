import { ObjectID } from 'mongodb';
import { WalletAddressStorage } from '../models/walletAddress';
import { StorageService } from '../services/storage';
import { TransformOptions } from '../types/TransformOptions';
import { BaseModel } from './base';

export interface IWallet {
  _id?: ObjectID;
  chain: string;
  network: string;
  name: string;
  singleAddress: boolean;
  pubKey: string;
  path: string;
}

export class WalletModel extends BaseModel<IWallet> {
  constructor(storage?: StorageService) {
    super('wallets', storage);
  }
  allowedPaging = [];

  onConnect() {
    this.collection.createIndex({ pubKey: 1 }, { background: true });
  }

  _apiTransform(wallet: IWallet, options?: TransformOptions) {
    let transform = { name: wallet.name, pubKey: wallet.pubKey };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
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
