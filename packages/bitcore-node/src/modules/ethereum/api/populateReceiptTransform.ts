import { Transform } from 'stream';
import { MongoBound } from '../../../models/base';
import { IEthTransaction } from '../types';
import { ETH } from './csp';

export class PopulateReceiptTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEthTransaction>, _, done) {
    try {
      tx = await ETH.populateReceipt(tx);
    } catch (e) {}
    this.push(tx);
    return done();
  }
}
