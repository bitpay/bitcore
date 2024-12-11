import { MongoBound } from '../../../../models/base';
import { TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';
import { IEVMTransaction } from '../types';
import { BaseEVMStateProvider } from './csp';

export class PopulateEffectsTransform extends TransformWithEventPipe {
  constructor() {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransaction>, _, done) {
    // Add effects to old db entries
    const EVM = new BaseEVMStateProvider(tx.chain);
    tx = EVM.populateEffects(tx);
    this.push(tx);
    return done();
  }
}
