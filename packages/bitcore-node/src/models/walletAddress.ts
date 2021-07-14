import { ObjectID } from 'mongodb';
import { Readable, Transform, Writable } from 'stream';
import { StorageService } from '../services/storage';
import { TransformOptions } from '../types/TransformOptions';
import { partition } from '../utils/partition';
import { BaseModel } from './base';
import { CoinStorage, ICoin } from './coin';
import { TransactionStorage } from './transaction';
import { IWallet } from './wallet';

export interface IWalletAddress {
  wallet: ObjectID;
  address: string;
  chain: string;
  network: string;
  processed: boolean;
}

export class WalletAddressModel extends BaseModel<IWalletAddress> {
  constructor(storage?: StorageService) {
    super('walletaddresses', storage);
  }

  allowedPaging = [];

  onConnect() {
    this.collection.createIndex({ chain: 1, network: 1, address: 1, wallet: 1 }, { background: true, unique: true });
    this.collection.createIndex({ chain: 1, network: 1, wallet: 1, address: 1 }, { background: true, unique: true });
  }

  _apiTransform(walletAddress: { address: string }, options?: TransformOptions) {
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
        super({ objectMode: true });
        this.addressBatches = partition(addresses, 1000);
        this.index = 0;
      }
      _read() {
        if (this.index < this.addressBatches.length) {
          this.push(this.addressBatches[this.index]);
          this.index++;
        } else {
          this.push(null);
        }
      }
    }

    class FilterExistingAddressesStream extends Transform {
      constructor() {
        super({ objectMode: true });
      }
      async _transform(addressBatch, _, callback) {
        try {
          let exists = (
            await WalletAddressStorage.collection
              .find({ chain, network, wallet: wallet._id, address: { $in: addressBatch } })
              .project({ address: 1, processed: 1 })
              .toArray()
          )
            .filter(walletAddress => walletAddress.processed)
            .map(walletAddress => walletAddress.address);
          this.push(
            addressBatch.filter(address => {
              return !exists.includes(address);
            })
          );
          callback();
        } catch (err) {
          callback(err);
        }
      }
    }

    class AddNewAddressesStream extends Transform {
      constructor() {
        super({ objectMode: true });
      }
      async _transform(addressBatch, _, callback) {
        if (!addressBatch.length) {
          return callback();
        }
        try {
          await WalletAddressStorage.collection.bulkWrite(
            addressBatch.map(address => {
              return {
                insertOne: {
                  document: { chain, network, wallet: wallet._id, address, processed: false }
                }
              };
            })
          ),
            { ordered: false };
        } catch (err) {
          // Ignore duplicate keys, they may be half processed
          if (err.code !== 11000) {
            return callback(err);
          }
        }
        this.push(addressBatch);
        callback();
      }
    }

    class UpdateCoinsStream extends Transform {
      constructor() {
        super({ objectMode: true });
      }
      async _transform(addressBatch, _, callback) {
        if (!addressBatch.length) {
          return callback();
        }
        try {
          await CoinStorage.collection.bulkWrite(
            addressBatch.map(address => {
              return {
                updateMany: {
                  filter: { chain, network, address },
                  update: { $addToSet: { wallets: wallet._id } }
                }
              };
            }),
            { ordered: false }
          );
          this.push(addressBatch);
          callback();
        } catch (err) {
          callback(err);
        }
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
        const coinStream = CoinStorage.collection
          .find({ chain, network, address: { $in: addressBatch } })
          .project({ mintTxid: 1, spentTxid: 1 });
        coinStream.on('data', (coin: ICoin) => {
          if (!this.txids[coin.mintTxid]) {
            this.txids[coin.mintTxid] = true;
            this.push({ txid: coin.mintTxid });
          }
          if (!this.txids[coin.spentTxid]) {
            this.txids[coin.spentTxid] = true;
            this.push({ txid: coin.spentTxid });
          }
        });
        let errored = false;
        coinStream.on('error', err => {
          errored = true;
          coinStream.destroy(err);
          callback(err);
        });
        coinStream.on('end', () => {
          if (errored) {
            return;
          }
          this.push({ addressBatch });
          callback();
        });
      }
    }

    class TxUpdaterStream extends Transform {
      constructor() {
        super({ objectMode: true });
      }
      async _transform(data, _, callback) {
        const { txid, addressBatch } = data;
        if (addressBatch) {
          this.push(addressBatch);
          return callback();
        }
        try {
          await TransactionStorage.collection.updateMany(
            { chain, network, txid },
            { $addToSet: { wallets: wallet._id } }
          );
          callback();
        } catch (err) {
          callback(err);
        }
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
        try {
          await WalletAddressStorage.collection.bulkWrite(
            addressBatch.map(address => {
              return {
                updateOne: {
                  filter: { chain, network, address, wallet: wallet._id },
                  update: { $set: { processed: true } }
                }
              };
            }),
            { ordered: false }
          );
          callback();
        } catch (err) {
          callback(err);
        }
      }
    }

    const addressInputStream = new AddressInputStream();
    const filterExistingAddressesStream = new FilterExistingAddressesStream();
    const addNewAddressesStream = new AddNewAddressesStream();
    const updateCoinsStream = new UpdateCoinsStream();
    const updatedTxidsStream = new UpdatedTxidsStream();
    const txUpdaterStream = new TxUpdaterStream();
    const markProcessedStream = new MarkProcessedStream();

    const handleStreamError = (stream: Transform | Writable, reject) => {
      stream.on('error', err => {
        stream.destroy();
        return reject(err);
      });
    };
    return new Promise((resolve, reject) => {
      markProcessedStream.on('unpipe', () => {
        return resolve();
      });

      handleStreamError(filterExistingAddressesStream, reject);
      handleStreamError(addNewAddressesStream, reject);
      handleStreamError(updateCoinsStream, reject);
      handleStreamError(updatedTxidsStream, reject);
      handleStreamError(txUpdaterStream, reject);
      handleStreamError(markProcessedStream, reject);

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
