import { CoinModel, ICoin } from './coin';
import { TransformOptions } from '../types/TransformOptions';
import { ObjectID } from 'mongodb';
import { BaseModel } from './base';
import { IWallet } from './wallet';
import { TransactionModel } from './transaction';

export type IWalletAddress = {
  wallet: ObjectID;
  address: string;
  chain: string;
  network: string;
};

export class WalletAddress extends BaseModel<IWalletAddress> {
  constructor() {
    super('walletaddresses');
  }

  allowedPaging = [];

  onConnect() {
    this.collection.createIndex({ address: 1, wallet: 1 }, { background: true });
  }

  _apiTransform(walletAddress: { address: string }, options: TransformOptions) {
    let transform = { address: walletAddress.address };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }

  getUpdateCoinsObj(params: { wallet: IWallet; address: string }) {
    const { wallet, address } = params;
    const { chain, network } = wallet;

    return {
      updateMany: {
        filter: { chain, network, address },
        update: {
          $addToSet: { wallets: wallet._id }
        }
      }
    };
  }

  getUpdateWalletAddressObj(params: { wallet: IWallet; address: string }) {
    const { wallet, address } = params;
    const { chain, network } = wallet;

    return {
      updateOne: {
        filter: { wallet: wallet._id, address: address },
        update: { wallet: wallet._id, address: address, chain, network },
        upsert: true
      }
    };
  }

  async updateCoins(params: { wallet: IWallet; addresses: string[] }) {
    const { wallet, addresses } = params;
    const { chain, network } = wallet;

    return new Promise(async resolve => {
      let batch = new Array<string>();
      const AddAddresses = addresses => {
        return WalletAddressModel.collection.updateMany(
          { wallet: wallet._id, address: { $in: addresses } },
          { $set: { wallet: wallet._id, chain, network } },
          { upsert: true }
        );
      };
      const UpdateCoins = addresses => {
        return CoinModel.collection.updateMany(
          { chain, network, address: { $in: addresses } },
          { $addToSet: { wallets: wallet._id } }
        );
      };

      const ProcessBatch = batch => {
        return Promise.all([ AddAddresses(batch), UpdateCoins(batch)]);
      };

      for (const address of addresses) {
        batch.push(address);
        if (batch.length > 10000) {
          await ProcessBatch(batch);
          batch = new Array<string>();
        }
      }
      if (batch.length > 0) {
        await ProcessBatch(batch);
        batch = new Array<string>();
      }

      let coinStream = CoinModel.collection
        .find({ wallets: wallet._id, 'wallets.0': { $exists: true } })
        .project({ spentTxid: 1, mintTxid: 1 })
        .addCursorFlag('noCursorTimeout', true);
      let txids = {};
      coinStream.on('data', (coin: ICoin) => {
        coinStream.pause();
        if (!txids[coin.mintTxid]) {
          TransactionModel.collection.updateMany(
            { txid: coin.mintTxid, network, chain },
            { $addToSet: { wallets: wallet._id } }
          );
        }
        txids[coin.mintTxid] = true;
        if (coin.spentTxid && !txids[coin.spentTxid]) {
          TransactionModel.collection.updateMany(
            { txid: coin.spentTxid, network, chain },
            { $addToSet: { wallets: wallet._id } }
          );
        }
        txids[coin.spentTxid] = true;
        coinStream.resume();
      });
      coinStream.on('end', async () => {
        resolve();
      });
    });
  }
}

export let WalletAddressModel = new WalletAddress();
