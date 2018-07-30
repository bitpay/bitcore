import { CoinModel } from '../models/coin';
import { Transform } from 'stream';
import { IWallet } from '../models/wallet';

class ListTransactionsStream extends Transform {
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
    var sending = _.some(transaction.inputs, function(input) {
      var contains = false;
      _.each(input.wallets, function(inputWallet) {
        if (inputWallet.equals(wallet)) {
          contains = true;
        }
      });
      return contains;
    });

    if (sending) {
      _.each(transaction.outputs, function(output) {
        var contains = false;
        _.each(output.wallets, function(outputWallet) {
          if (outputWallet.equals(wallet)) {
            contains = true;
          }
        });
        if (!contains) {
          self.push(
            JSON.stringify({
              txid: transaction.txid,
              category: 'send',
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
            txid: transaction.txid,
            category: 'fee',
            satoshis: -fee,
            height: transaction.blockHeight,
            blockTime: transaction.blockTimeNormalized
          }) + '\n'
        );
      }
      return done();
    }

    _.each(transaction.outputs, function(output) {
      var contains = false;
      _.each(output.wallets, function(outputWallet) {
        if (outputWallet.equals(wallet)) {
          contains = true;
        }
      });
      if (contains) {
        self.push(
          JSON.stringify({
            txid: transaction.txid,
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
    done();
  }
}

module.exports = ListTransactionsStream;
