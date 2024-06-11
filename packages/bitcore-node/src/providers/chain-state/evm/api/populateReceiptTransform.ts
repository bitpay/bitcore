import { MongoBound } from '../../../../models/base';
import { IEVMTransaction } from '../types';
import { BaseEVMStateProvider } from './csp';
import { TransformWithEventPipe } from '../../../../utils/transformWithEventPipe';

export class PopulateReceiptTransform extends TransformWithEventPipe {
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
