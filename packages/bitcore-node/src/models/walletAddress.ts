import { CoinStorage, ICoin } from './coin';
import { TransformOptions } from '../types/TransformOptions';
import { ObjectID } from 'mongodb';
import { BaseModel } from './base';
import { IWallet } from './wallet';
import { TransactionStorage } from './transaction';
import { StorageService } from '../services/storage';

export type IWalletAddress = {
  wallet: ObjectID;
  address: string;
  chain: string;
  network: string;
  processed: boolean;
};

export class WalletAddressModel extends BaseModel<IWalletAddress> {
  constructor(storage?: StorageService) {
    super('walletaddresses', storage);
  }

  allowedPaging = [];

  onConnect() {
    this.collection.createIndex({ address: 1, wallet: 1 }, { background: true });
    this.collection.createIndex({ wallet: 1 }, { background: true });
  }

  _apiTransform(walletAddress: { address: string }, options: TransformOptions) {
    let transform = { address: walletAddress.address };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }

  async updateCoins(params: { wallet: IWallet; addresses: string[] }) {
    const { wallet, addresses } = params;
    const { chain, network } = wallet;

    const unprocessedAddresses: Array<string> = [];
    return new Promise(async resolve => {
      for (let address of addresses) {
        const updatedAddress = await this.collection.findOneAndUpdate({ 
          wallet: wallet._id, address: address, chain, network
        }, { $setOnInsert: { wallet: wallet._id, address: address, chain, network }}, { returnOriginal: false, upsert: true });
        if (!updatedAddress.value!.processed) {
          unprocessedAddresses.push(address); 
          await CoinStorage.collection.updateMany(
            { chain, network, address },
            { $addToSet: { wallets: wallet._id } }
          );
        }
      }

      let coinStream = CoinStorage.collection
        .find({ wallets: wallet._id, 'wallets.0': { $exists: true } })
        .project({ spentTxid: 1, mintTxid: 1, address: 1 })
        .addCursorFlag('noCursorTimeout', true);
      let txids = {};
      coinStream.on('data', (coin: ICoin) => {
        coinStream.pause();
        if (!unprocessedAddresses.includes(coin.address)){
          return coinStream.resume();
        }
        if (!txids[coin.mintTxid]) {
          TransactionStorage.collection.updateMany(
            { txid: coin.mintTxid, network, chain },
            { $addToSet: { wallets: wallet._id } }
          );
        }
        txids[coin.mintTxid] = true;
        if (coin.spentTxid && !txids[coin.spentTxid]) {
          TransactionStorage.collection.updateMany(
            { txid: coin.spentTxid, network, chain },
            { $addToSet: { wallets: wallet._id } }
          );
        }
        txids[coin.spentTxid] = true;
        return coinStream.resume();
      });
      coinStream.on('end', async () => {
        for (const address of unprocessedAddresses){
          await this.collection.updateOne({ address, wallet: wallet._id }, { $set: {processed: true }});
        }
        resolve();
      });
    });
  }
}

export let WalletAddressStorage = new WalletAddressModel();
