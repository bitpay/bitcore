import { ICoin } from '../models/coin';
import { Transform } from 'stream';
import { TransactionModel, ITransaction } from '../models/transaction';
import { MongoBound } from '../models/base';
import { IWallet } from '../models/wallet';
import through2 from 'through2';

export class ListTransactionsStream extends Transform {
  constructor(private wallet: MongoBound<IWallet>) {
    super({
      objectMode: true
    });
  }

  writeTxToStream(coin: ICoin) {
    if (coin.spentTxid) {
      console.log('Spending', coin.value);
      this.push(
        JSON.stringify({
          txid: coin.spentTxid,
          category: 'send',
          satoshis: -coin.value,
          height: coin.spentHeight,
          address: coin.address,
          outputIndex: coin.mintIndex
        }) + '\n'
      );
    }

    if (coin.mintTxid) {
      console.log('Minting', coin.value);
      this.push(
        JSON.stringify({
          txid: coin.mintTxid,
          category: 'receive',
          satoshis: coin.value,
          height: coin.mintHeight,
          address: coin.address,
          outputIndex: coin.mintIndex
        }) + '\n'
      );
    }
  }

  async _flush(done) {
    // write all the wallet fees at the end
    console.log('Flushing');
    TransactionModel.collection.find({ wallets: this.wallet._id }).pipe(
      through2(
        { objectMode: true },
        (tx: ITransaction, _, inner) => {
          console.log('Fee', tx.fee);
          inner(
            null,
            JSON.stringify({
              txid: tx.txid,
              category: 'fee',
              satoshis: -tx.fee,
              height: tx.blockHeight
            }) + '\n'
          );
        },
        () => done()
      )
    );
  }

  _transform(coin: ICoin, _, done) {
    console.log('writing coin', coin.mintTxid);
    this.writeTxToStream(coin);
    done();
  }
}
