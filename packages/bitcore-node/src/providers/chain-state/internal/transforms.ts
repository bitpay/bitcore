import { CoinModel } from '../../../models/coin';
import { Transform } from 'stream';
import { IWallet } from '../../../models/wallet';

export class ListTransactionsStream extends Transform {
  constructor(private wallet: IWallet) {
    super({ objectMode: true });
  }

  async _transform(transaction, _, done) {
    var self = this;
    transaction.inputs = await CoinModel.collection
      .find(
        {
          chain: transaction.chain,
          network: transaction.network,
          spentTxid: transaction.txid
        },
        { batchSize: 100 }
      )
      .addCursorFlag('noCursorTimeout', true)
      .toArray();
    transaction.outputs = await CoinModel.collection
      .find(
        {
          chain: transaction.chain,
          network: transaction.network,
          mintTxid: transaction.txid
        },
        { batchSize: 100 }
      )
      .addCursorFlag('noCursorTimeout', true)
      .toArray();

    var wallet = this.wallet._id!.toString();
    var totalInputs = transaction.inputs.reduce((total, input) => {
      return total + input.value;
    }, 0);
    var totalOutputs = transaction.outputs.reduce((total, output) => {
      return total + output.value;
    }, 0);
    var fee = totalInputs - totalOutputs;
    var sending = transaction.inputs.some(function(input) {
      var contains = false;
      input.wallets.forEach(function(inputWallet) {
        if (inputWallet.equals(wallet)) {
          contains = true;
        }
      });
      return contains;
    });

    if (sending) {
      transaction.outputs.forEach(function(output) {
        var sendingToOurself = false;
        output.wallets.forEach(function(outputWallet) {
          if (outputWallet.equals(wallet)) {
            sendingToOurself = true;
          }
        });
        if (!sendingToOurself) {
          self.push(
            JSON.stringify({
              id: transaction._id,
              txid: transaction.txid,
              fee: transaction.fee,
              size: transaction.size,
              category: 'send',
              satoshis: -output.value,
              height: transaction.blockHeight,
              address: output.address,
              outputIndex: output.vout,
              blockTime: transaction.blockTimeNormalized
            }) + '\n'
          );
        } else {
          self.push(
            JSON.stringify({
              id: transaction._id,
              txid: transaction.txid,
              fee: transaction.fee,
              size: transaction.size,
              category: 'move',
              satoshis: -output.value,
              height: transaction.blockHeight,
              address: output.address,
              outputIndex: output.vout,
              blockTime: transaction.blockTimeNormalized
            }) + '\n'
          );
        }
      });
      if (fee > 0) {
        self.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            category: 'fee',
            satoshis: -fee,
            height: transaction.blockHeight,
            blockTime: transaction.blockTimeNormalized
          }) + '\n'
        );
      }
      return done();
    } else {
      transaction.outputs.forEach(function(output) {
        var weReceived = false;
        output.wallets.forEach(function(outputWallet) {
          if (outputWallet.equals(wallet)) {
            weReceived = true;
          }
        });
        if (weReceived) {
          self.push(
            JSON.stringify({
              id: transaction._id,
              txid: transaction.txid,
              fee: transaction.fee,
              size: transaction.size,
              category: 'receive',
              satoshis: output.value,
              height: transaction.blockHeight,
              address: output.address,
              outputIndex: output.vout,
              blockTime: transaction.blockTimeNormalized
            }) + '\n'
          );
        }
      });
    }
    done();
  }
}
