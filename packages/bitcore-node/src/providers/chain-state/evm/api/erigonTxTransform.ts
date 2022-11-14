import { Transform } from 'stream';
import { MongoBound } from '../../../../models/base';
import { EVMTransactionStorage } from '../models/transaction';
import { IEVMTransactionLegacyProps } from '../types';

export class ErigonTxTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  /**
   * This takes a tx with the `internal` property and transforms it
   * to use `calls` instead
   * @param tx Transaction object
   * @param _ Encoding (discarded)
   * @param done Callback
   * @returns
   */
  async _transform(tx: MongoBound<IEVMTransactionLegacyProps>, _, done) {
    if (tx.internal && tx.internal.length > 0) {
      tx.calls = EVMTransactionStorage.transformInternalToCalls(tx.internal);
    }

    this.push(tx);
    return done();
  }
}
