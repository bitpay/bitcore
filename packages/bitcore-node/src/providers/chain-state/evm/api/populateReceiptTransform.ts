import { Transform } from 'stream';
import { MongoBound } from '../../../../models/base';
import { IEVMTransaction } from '../types';
import { BaseEVMStateProvider } from './csp';

export class PopulateReceiptTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransaction>, _, done) {
    try {
      const EVM = new BaseEVMStateProvider(tx.chain);
      tx = await EVM.populateReceipt(tx);
    } catch (e) {}
    this.push(tx);
    return done();
  }
}
