import { Transform } from 'stream';
import { MongoBound } from '../../../models/base';
import { IEthTransaction } from '../types';
import { ETH } from './csp';

export class PopulateReceiptTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEthTransaction>, _, done) {
    tx = await ETH.populateReceipt(tx);
    this.push(tx);
    return done();
  }
}
