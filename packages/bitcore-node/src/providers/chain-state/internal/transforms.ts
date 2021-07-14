import { Transform } from 'stream';
import { CoinStorage } from '../../../models/coin';
import { IWallet } from '../../../models/wallet';

export class ListTransactionsStream extends Transform {
  constructor(public wallet: IWallet) {
    super({ objectMode: true });
  }

  async _transform(transaction, _, done) {
    const sending = !!(await CoinStorage.collection.countDocuments({
      wallets: this.wallet._id,
      'wallets.0': { $exists: true },
      spentTxid: transaction.txid
    }));

    const wallet = this.wallet._id!.toString();

    if (sending) {
      const outputs = await CoinStorage.collection
        .find(
          {
            chain: transaction.chain,
            network: transaction.network,
            mintTxid: transaction.txid
          },
          { batchSize: 10000 }
        )
        .project({ address: 1, wallets: 1, value: 1, mintIndex: 1 })
        .addCursorFlag('noCursorTimeout', true)
        .toArray();
      outputs.forEach(output => {
        const sendingToOurself = output.wallets.some(outputWallet => {
          return outputWallet.equals(wallet);
        });
        if (!sendingToOurself) {
          this.push(
            JSON.stringify({
              id: transaction._id,
              txid: transaction.txid,
              fee: transaction.fee,
              size: transaction.size,
              category: 'send',
              satoshis: -output.value,
              height: transaction.blockHeight,
              address: output.address,
              outputIndex: output.mintIndex,
              blockTime: transaction.blockTimeNormalized
            }) + '\n'
          );
        } else {
          this.push(
            JSON.stringify({
              id: transaction._id,
              txid: transaction.txid,
              fee: transaction.fee,
              size: transaction.size,
              category: 'move',
              satoshis: -output.value,
              height: transaction.blockHeight,
              address: output.address,
              outputIndex: output.mintIndex,
              blockTime: transaction.blockTimeNormalized
            }) + '\n'
          );
        }
      });
      if (transaction.fee > 0) {
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            category: 'fee',
            satoshis: -transaction.fee,
            height: transaction.blockHeight,
            blockTime: transaction.blockTimeNormalized
          }) + '\n'
        );
      }
      return done();
    } else {
      const outputs = await CoinStorage.collection
        .find({
          wallets: this.wallet._id,
          'wallets.0': { $exists: true },
          mintTxid: transaction.txid
        })
        .project({ address: 1, wallets: 1, value: 1, mintIndex: 1 })
        .addCursorFlag('noCursorTimeout', true)
        .toArray();
      outputs.forEach(output => {
        const weReceived = output.wallets.some(outputWallet => {
          return outputWallet.equals(wallet);
        });
        if (weReceived) {
          this.push(
            JSON.stringify({
              id: transaction._id,
              txid: transaction.txid,
              fee: transaction.fee,
              size: transaction.size,
              category: 'receive',
              satoshis: output.value,
              height: transaction.blockHeight,
              address: output.address,
              outputIndex: output.mintIndex,
              blockTime: transaction.blockTimeNormalized
            }) + '\n'
          );
        }
      });
    }
    done();
  }
}
