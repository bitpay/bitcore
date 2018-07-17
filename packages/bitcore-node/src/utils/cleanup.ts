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
    console.log(`Finding transactions for block ${block.hash}`);
    const txs = await TransactionModel.collection.find({ blockHash: block.hash }).toArray();
    for (let tx of txs) {
      console.log(`Finding coins for tx ${tx.txid}`);
      let mints = await CoinModel.collection.find({ mintTxid: tx.txid }).toArray();
      for (let mint of mints) {
        if (mint.mintHeight != block.height && block.height > mint.mintHeight) {
          console.log(mint);
        }
      }
    }
    done();
  }
}

Storage.start({})
  .then(() => {
    let cursor = BlockModel.collection.find({});
    cursor.addCursorFlag('noCursorTimeout', true);
    cursor.pipe(new CleanupTransform());
    cursor.on('data', console.log);
    cursor.on('end', () => console.log('done'));
  })
  .catch(e => {
    console.error('fatal', e);
  });
