const { CoinModel } = require('../../../models/coin');
const {Transform} = require('stream');
const util = require('util');

function ListTransactionsStream(wallet) {
  this.wallet = wallet;
  Transform.call(this, { objectMode: true });
}
util.inherits(ListTransactionsStream, Transform);
ListTransactionsStream.prototype._transform = function (transaction, enc, done) {
  var self = this;
  return Promise.all([
    CoinModel.collection.find({
      chain: transaction.chain,
      network: transaction.network,
      spentTxid: transaction.txid
    }, { batchSize: 100 }).toArray(),
    CoinModel.collection.find({
      chain: transaction.chain,
      network: transaction.network,
      mintTxid: transaction.txid
    }, { batchSize: 100 }).toArray()])
    .then(([inputs, outputs]) => {

      transaction.inputs = inputs;
      transaction.outputs = outputs;
      var wallet = this.wallet._id;
      var totalInputs = transaction.inputs.reduce((total, input) => { return total + input.value; }, 0);
      var totalOutputs = transaction.outputs.reduce((total, output) => { return total + output.value; }, 0);
      var fee = totalInputs - totalOutputs;

      for(let input of transaction.inputs) {
        if (input.wallets.includes(wallet)) {
          self.push(JSON.stringify({
            txid: transaction.txid,
            category: 'send',
            satoshis: -input.value,
            height: transaction.blockHeight,
            address: input.address,
            outputIndex: input.vout,
            blockTime: transaction.blockTimeNormalized
          }) + '\n');

          if (fee > 0) {
            self.push(JSON.stringify({
              txid: transaction.txid,
              category: 'fee',
              satoshis: -fee,
              height: transaction.blockHeight,
              blockTime: transaction.blockTimeNormalized
            }) + '\n');
          }
        }
      }
      for(let output of transaction.outputs) {
        if (output.wallets.includes(output)) {
          self.push(JSON.stringify({
            txid: transaction.txid,
            category: 'receive',
            satoshis: output.value,
            height: transaction.blockHeight,
            address: output.address,
            outputIndex: output.vout,
            blockTime: transaction.blockTimeNormalized
          }) + '\n');
        }
      }
    })
    .then(() => done())
    .catch((err) => done(err));
};
module.exports = ListTransactionsStream;
