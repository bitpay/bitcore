import { CoinStorage, ICoin } from './coin';
import { TransformOptions } from '../types/TransformOptions';
import { ObjectID } from 'mongodb';
import { BaseModel } from './base';
import { IWallet } from './wallet';
import { TransactionStorage } from './transaction';
import { StorageService } from '../services/storage';
import { partition } from '../utils/partition';
import { Readable, Transform, Writable } from 'stream';

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
    this.collection.createIndex({ chain: 1, network: 1, address: 1, wallet: 1 }, { background: true, unique: true });
    this.collection.createIndex({ chain: 1, network: 1, wallet: 1, address: 1 }, { background: true, unique: true });
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

    class AddressInputStream extends Readable {
      addressBatches: string[][];
      index: number;
      constructor() {
        super({ objectMode: true});
        this.addressBatches = partition(addresses, 1000);
        this.index = 0;
      }
      _read() {
        if (this.index < this.addressBatches.length) {
          this.push(this.addressBatches[this.index]);
          this.index++;
        }
        else {
          this.push(null);
        }
      }
    }

    class FilterExistingAddressesStream extends Transform {
      constructor() {
        super({objectMode: true});
      }
      async _transform(addressBatch, _, callback) {
        let exists = (await WalletAddressStorage.collection.find({ wallet: wallet._id, address: { $in: addressBatch } }).toArray())
          .filter(walletAddress => walletAddress.processed)
          .map(walletAddress => walletAddress.address);
        callback(null, addressBatch.filter(address => {
          return !exists.includes(address);
        }));
      }
    }

    class AddNewAddressesStream extends Transform {
      constructor() {
        super({objectMode: true});
      }
      async _transform(addressBatch, _, callback) {
        if (!addressBatch.length) {
          return callback();
        }
        await WalletAddressStorage.collection.bulkWrite(addressBatch.map(address => {
          return {
            updateOne: {
              filter: { chain, network, wallet: wallet._id, address },
              update: { $setOnInsert: { chain, network, wallet: wallet._id, address }},
              upsert: true
            }
          }
        })), { ordered: false};
        callback(null, addressBatch);
      }
    }

    class UpdateCoinsStream extends Transform {
      constructor() {
        super({objectMode: true});
      }
      async _transform(addressBatch, _, callback) {
        if (!addressBatch.length) {
          return callback();
        }
        await WalletAddressStorage.collection.bulkWrite(addressBatch.map(address => {
          return {
            updateMany: {
              filter: { chain, network, address },
              update: { $addToSet: { wallets: wallet._id } }
            }
          };
        }), { ordered: false });
        callback(null, addressBatch);
      }
    }

    class UpdatedTxidsStream extends Transform {
      txids: { [key: string]: boolean };
      constructor() {
        super({ objectMode: true });
        this.txids = {};
      }
      async _transform(addressBatch, _, callback) {
        if (!addressBatch.length) {
          return callback();
        }
        const coinStream = CoinStorage.collection.find({chain, network, address: {$in: addressBatch}});
        coinStream.on('data', (coin: ICoin) => {
          if (!this.txids[coin.mintTxid]){
            this.txids[coin.mintTxid] = true;
            this.push({ txid: coin.mintTxid});
          }
          if (!this.txids[coin.spentTxid]) {
            this.txids[coin.spentTxid] = true;
            this.push({ txid: coin.spentTxid});
          }
        });
        coinStream.on('end', () => {
          callback(null, {addressBatch})
        });
      }
    }

    class TxUpdaterStream extends Transform {
      constructor() {
        super({ objectMode: true });
      }
      async _transform(data, _, callback) {
        const { txid, addressBatch } = data;
        if (addressBatch){
          return callback(null, addressBatch);
        }
        await TransactionStorage.collection.updateMany(
          { chain, network, txid },
          { $addToSet: { wallets: wallet._id } }
        );
        callback();
      }
    }

    class MarkProcessedStream extends Writable {
      constructor() {
        super({ objectMode: true });
      }
      async _write(addressBatch, _, callback) {
        if (!addressBatch.length) {
          return callback();
        }
        await WalletAddressStorage.collection.bulkWrite(addressBatch.map(address => {
          return {
            updateOne: {
              filter: { chain, network, address, wallet: wallet._id },
              update: { $set: { processed: true } }
            }
          }
        }));
        callback();
      }
    }

    const addressInputStream = new AddressInputStream();
    const filterExistingAddressesStream = new FilterExistingAddressesStream();
    const addNewAddressesStream = new AddNewAddressesStream();
    const updateCoinsStream = new UpdateCoinsStream();
    const updatedTxidsStream = new UpdatedTxidsStream();
    const txUpdaterStream = new TxUpdaterStream();
    const markProcessedStream = new MarkProcessedStream();

      return new Promise((resolve) => {
        markProcessedStream.on('unpipe', () => {
          return resolve();
        });
        addressInputStream
          .pipe(filterExistingAddressesStream)
          .pipe(addNewAddressesStream)
          .pipe(updateCoinsStream)
          .pipe(updatedTxidsStream)
          .pipe(txUpdaterStream)
          .pipe(markProcessedStream);
      });
  }
}

export let WalletAddressStorage = new WalletAddressModel();
