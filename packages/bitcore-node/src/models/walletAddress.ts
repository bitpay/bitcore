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
      for (const address of addresses) {
        await Promise.all([
          WalletAddressModel.collection.updateOne(
            { wallet: wallet._id, address },
            { $set: { wallet: wallet._id, address: address, chain, network } },
            { upsert: true }
          ),
          CoinModel.collection.updateMany({ chain, network, address }, { $addToSet: { wallets: wallet._id } })
        ]);
      }

      let coinStream = CoinModel.collection
        .find({ wallets: wallet._id })
        .project({ spentTxid: 1, mintTxid: 1 })
        .addCursorFlag('noCursorTimeout', true);
      let txids = {};
      coinStream.on('data', (coin: ICoin) => {
        if (!txids[coin.mintTxid]) {
          TransactionModel.collection.update(
            { txid: coin.mintTxid, network, chain },
            { $addToSet: { wallets: wallet._id } }
          );
        }
        txids[coin.mintTxid] = true;
        if (!txids[coin.spentTxid]) {
          TransactionModel.collection.update(
            { txid: coin.spentTxid, network, chain },
            { $addToSet: { wallets: wallet._id } }
          );
        }
        txids[coin.spentTxid] = true;
      });
      coinStream.on('end', async () => {
        resolve();
      });
    });
  }
}

export let WalletAddressModel = new WalletAddress();
