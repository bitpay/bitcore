import { MongoBound } from '../../../../models/base';
import { TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';
import { IEVMTransaction } from '../types';
import { BaseEVMStateProvider } from './csp';

export class PopulateEffectsTransform extends TransformWithEventPipe {
  constructor(private evm: BaseEVMStateProvider) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransaction>, _, done) {
    // Add effects to old db entries
    tx = this.evm.populateEffects(tx);
    this.push(tx);
    return done();
  }
}
