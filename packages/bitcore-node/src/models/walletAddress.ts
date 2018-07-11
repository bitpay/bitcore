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

    let walletUpdateBatches = partition(walletUpdates, 500);
    let coinUpdateBatches = partition(coinUpdates, 500);

    return new Promise(async resolve => {
      await Promise.all(
        walletUpdateBatches.map(walletUpdateBatch => {
          return WalletAddressModel.collection.bulkWrite(walletUpdateBatch, { ordered: false });
        })
      );

      await Promise.all(
        coinUpdateBatches.map(coinUpdateBatch => {
          return CoinModel.collection.bulkWrite(coinUpdateBatch, { ordered: false });
        })
      );
      let coinCursor = CoinModel.collection.find({ wallets: wallet._id }).project({ spentTxid: 1, mintTxid: 1 });

      coinCursor.on('data', function(data: ICoin) {
        coinCursor.pause();
        TransactionModel.collection.update(
          { chain, network, txid: { $in: [data.spentTxid, data.mintTxid] } },
          { $addToSet: { wallets: wallet._id } },
          { multi: true },
          function() {
            // TODO Error handling if update fails?
            coinCursor.resume();
          }
        );
      });

      coinCursor.on('end', function() {
        resolve();
      });
    });
  }
}

export let WalletAddressModel = new WalletAddress();
