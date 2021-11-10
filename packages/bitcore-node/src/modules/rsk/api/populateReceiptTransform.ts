import { Transform } from 'stream';
import { MongoBound } from '../../../models/base';
import { IRskTransaction } from '../types';
import { RSK } from './csp';

export class PopulateReceiptTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IRskTransaction>, _, done) {
    try {
      tx = await RSK.populateReceipt(tx);
    } catch (e) {}
    this.push(tx);
    return done();
  }
}
