import { BlockModel } from '../models/block';
import { Transform } from 'stream';
import { TransactionModel } from '../models/transaction';
import { CoinModel } from '../models/coin';
import { Storage } from '../services/storage';

class CleanupTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  async _transform(block, _, done) {
    const self = this;
    const txs = await TransactionModel.collection.find({ blockHash: block.hash }).toArray();
    for (let tx of txs) {
      let mints = await CoinModel.collection.find({ mintTxid: tx.txid }).toArray();
      for (let mint of mints) {
        if (mint.mintHeight != block.height && block.height > mint.mintHeight) {
          self.push(mint);
        }
      }
    }
    done();
  }
}

Storage.start({})
  .then(() => {
    let cursor = BlockModel.collection.find({}).sort({height: -1});
    cursor.addCursorFlag('noCursorTimeout', true);
    cursor.pipe(new CleanupTransform())
      .on('data', console.log)
      .on('end', () => console.log('done'));
  })
  .catch(e => {
    console.error('fatal', e);
  });
