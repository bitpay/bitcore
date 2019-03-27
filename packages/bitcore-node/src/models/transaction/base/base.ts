import { BaseModel, MongoBound } from '../../base';
import { StorageService, Storage } from '../../../services/storage';
import { ITransaction } from '../../../types/Transaction';
import { TransformOptions } from '../../../types/TransformOptions';
import { EthTransactionStorage } from '../eth/ethTransaction';
import { BtcTransactionStorage } from '..';

export class TransactionModel<T extends ITransaction> extends BaseModel<T> {
  constructor(storage: StorageService = Storage) {
    super('transactions', storage);
  }

  allowedPaging = [
    { key: 'blockHash' as 'blockHash', type: 'string' as 'string' },
    { key: 'blockHeight' as 'blockHeight', type: 'number' as 'number' },
    { key: 'blockTimeNormalized' as 'blockTimeNormalized', type: 'date' as 'date' },
    { key: 'txid' as 'txid', type: 'string' as 'string' }
  ];

  onConnect() {
    this.collection.createIndex({ txid: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, blockHeight: 1 }, { background: true });
    this.collection.createIndex({ blockHash: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, blockTimeNormalized: 1 }, { background: true });
    this.collection.createIndex(
      { wallets: 1, blockTimeNormalized: 1 },
      { background: true, partialFilterExpression: { 'wallets.0': { $exists: true } } }
    );
    this.collection.createIndex(
      { wallets: 1, blockHeight: 1 },
      { background: true, partialFilterExpression: { 'wallets.0': { $exists: true } } }
    );
  }

  _apiTransform(tx: Partial<MongoBound<T>>, options?: TransformOptions) {
    switch (tx.chain) {
      case 'ETH':
        return EthTransactionStorage._apiTransform(tx, options);
      case 'BTC':
        return BtcTransactionStorage._apiTransform(tx, options);
      default:
        return BtcTransactionStorage._apiTransform(tx, options);
    }
  }
}
export let TransactionStorage = new TransactionModel<ITransaction>();
