import { CoinStorage } from './coin';
import { TransformOptions } from '../types/TransformOptions';
import { ObjectID } from 'mongodb';
import { BaseModel } from './base';
import { IWallet } from './wallet';
import { TransactionStorage } from './transaction';
import { StorageService } from '../services/storage';
import { Writable } from 'stream';

export type IWalletAddress = {
  wallet: ObjectID;
  address: string;
  chain: string;
  network: string;
};

export class WalletAddressModel extends BaseModel<IWalletAddress> {
  constructor(storage?: StorageService) {
    super('walletaddresses', storage);
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

  async updateCoins(params: { wallet: IWallet; addresses: string[] }) {
    const { wallet, addresses } = params;
    const { chain, network } = wallet;

    const addAddresses = addresses => {
      return WalletAddressStorage.collection.updateMany(
        { wallet: wallet._id, address: { $in: addresses } },
        { $set: { wallet: wallet._id, chain, network } },
        { upsert: true }
      );
    };
    const tagCoins = addresses => {
      return CoinStorage.collection.updateMany(
        { chain, network, address: { $in: addresses } },
        { $addToSet: { wallets: wallet._id } }
      );
    };

    const processBatch = batch => {
      return Promise.all([addAddresses(batch), tagCoins(batch)]);
    };

    class TxUpdaterStream extends Writable {
      txids: { [key:string] : boolean};
      constructor() {
        super({ objectMode: true });
        this.txids = {};
      }
      async _write(coin, _, callback) {
        let ops: Promise<any>[] = [];
        if (!this.txids[coin.mintTxid]) {
          ops.push(TransactionStorage.collection.updateMany(
            { txid: coin.mintTxid, network, chain },
            { $addToSet: { wallets: wallet._id } }
          ));
        }
        this.txids[coin.mintTxid] = true;
        if (coin.spentTxid && !this.txids[coin.spentTxid]) {
          ops.push(TransactionStorage.collection.updateMany(
            { txid: coin.spentTxid, network, chain },
            { $addToSet: { wallets: wallet._id } }
          ))
        }
        this.txids[coin.spentTxid] = true;
        await Promise.all(ops);
        callback();
      }
    }

    return new Promise(async resolve => {
      let batch = new Array<string>();
      
      for (const address of addresses) {
        batch.push(address);
        if (batch.length > 10000) {
          await processBatch(batch);
          batch = new Array<string>();
        }
      }
      if (batch.length > 0) {
        await processBatch(batch);
        batch = new Array<string>();
      }

      const txUpdaterStream = new TxUpdaterStream();

      let coinStream = CoinStorage.collection
        .find({ wallets: wallet._id, 'wallets.0': { $exists: true } })
        .project({ spentTxid: 1, mintTxid: 1 })
        .addCursorFlag('noCursorTimeout', true);

      coinStream.pipe(txUpdaterStream);
      coinStream.on('end', resolve);
    });
  }
}

export let WalletAddressStorage = new WalletAddressModel();
