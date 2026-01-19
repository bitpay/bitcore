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
    } catch {/* ignore error */}
    this.push(tx);
    return done();
  }
}
