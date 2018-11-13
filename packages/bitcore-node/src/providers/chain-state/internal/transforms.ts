import { CoinModel } from '../../../models/coin';
import { Transform } from 'stream';
import { IWallet } from '../../../models/wallet';

export class ListTransactionsStream extends Transform {
  constructor(private wallet: IWallet) {
    super({ objectMode: true });
  }

  async _transform(transaction, _, done) {
    const [ inputs, outputs ] = await Promise.all([
      CoinModel.collection
        .find(
          {
            chain: transaction.chain,
            network: transaction.network,
            spentTxid: transaction.txid
          },
          { batchSize: 10000 }
        )
        .project({ address: 1, wallets: 1, value: 1, mintIndex: 1})
        .addCursorFlag('noCursorTimeout', true)
        .toArray(),
      CoinModel.collection
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
        .toArray()
    ]);
    
    const wallet = this.wallet._id!.toString();
    const sending = inputs.some((input) => {
      return input.wallets.some((inputWallet) => {
        return inputWallet.equals(wallet);
      });
    });

    if (sending) {
      outputs.forEach((output) => {
        const sendingToOurself = output.wallets.some((outputWallet) => {
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
      outputs.forEach((output) => {
        const weReceived = output.wallets.some((outputWallet) => {
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
