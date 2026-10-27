import { MongoBound } from '../../../../models/base';
import { TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';
import { IEVMTransaction } from '../types';
import { BaseEVMStateProvider } from './csp';

export class PopulateReceiptTransform extends TransformWithEventPipe {
  constructor(private evm: BaseEVMStateProvider) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransaction>, _, done) {
    try {
      tx = await this.evm.populateReceipt(tx);
    } catch (err) {
      if (this.evm.chain === 'ARC' && (tx.blockHeight ?? -1) >= 0) return done(err);
    }
    this.push(tx);
    return done();
  }
}
