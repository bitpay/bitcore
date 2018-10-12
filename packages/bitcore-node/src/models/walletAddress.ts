import { CoinModel, ICoin } from './coin';
import { TransformOptions } from '../types/TransformOptions';
import { partition } from '../utils/partition';
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
    this.collection.createIndex({ address: 1, wallet: 1 });
  }

  _apiTransform(walletAddress: { address: string }, options: TransformOptions) {
    let transform = { address: walletAddress.address };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }

  getUpdateCoinsObj(params: { wallet: IWallet; addresses: string[] }) {
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

    return {
      walletUpdates,
      coinUpdates
    };
  }

  async updateCoins(params: { wallet: IWallet; addresses: string[] }) {
    const { wallet } = params;
    const updates = WalletAddressModel.getUpdateCoinsObj(params);
    const { walletUpdates, coinUpdates } = updates;
    const { chain, network } = wallet;

    let walletUpdateBatches = partition(walletUpdates, 1000);
    let coinUpdateBatches = partition(coinUpdates, 1000);

    return new Promise(async resolve => {
      for (const walletUpdateBatch of walletUpdateBatches) {
        await WalletAddressModel.collection.bulkWrite(walletUpdateBatch, { ordered: false });
      }

      for (const coinUpdateBatch of coinUpdateBatches) {
        await CoinModel.collection.bulkWrite(coinUpdateBatch, { ordered: false });
      }

      let coinStream = CoinModel.collection.find({ wallets: wallet._id }).project({ spentTxid: 1, mintTxid: 1 }).addCursorFlag('noCursorTimeout', true);
      let txids = {};
      coinStream.on('data', (coin: ICoin) => {
        if (!txids[coin.mintTxid]) {
          TransactionModel.collection.update({ txid: coin.mintTxid, network, chain }, { $addToSet: { wallets: wallet._id }});
        }
        txids[coin.mintTxid] = true;
        if (!txids[coin.spentTxid]) {
          TransactionModel.collection.update({ txid: coin.spentTxid, network, chain }, { $addToSet: { wallets: wallet._id } });
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
