import { BlockModel } from '../models/block';
import { TransactionModel } from '../models/transaction';
import { CoinModel } from '../models/coin';
import { Storage } from '../services/storage';

Storage.start({})
  .then(() => {
    BlockModel.collection
      .find({})
      .sort({ height: -1 })
      .stream({
        transform: async block => {
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
        }
      });
  })
  .catch(e => {
    console.error('fatal', e);
  });
