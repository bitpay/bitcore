var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Coin = new Schema({
  network: String,
  mintTxid: String,
  mintIndex: Number,
  mintHeight: Number,
  coinbase: Boolean,
  value: Number,
  address: String,
  script: Buffer,
  wallets: {type: [Schema.Types.ObjectId]},
  spentTxid: String,
  spentHeight: Number
});

Coin.index({ mintTxid: 1, mintIndex: 1 });
Coin.index({ address: 1 });
Coin.index({ mintHeight: 1 }, { sparse: true });
Coin.index({ spentHeight: 1 });
Coin.index({ wallets: 1, spentHeight: 1 }, { sparse: true });
Coin.index({ spentTxid: 1 }, { sparse: true });

Coin.statics.getCoins = function(params){
  let {query} = params;
  Coin.collection.aggregate([
    { $match: query },
    {
      $project: {
        'txid': '$mintTxid',
        'vout': '$mintIndex',
        'address': 1,
        'script': 1,
        'value': 1,
        _id: 0
      }
    }
  ]);
};

Coin.statics.getBalance = function(params){
  let {query} = params;
  query = Object.assign(query, { spentHeight: { $lt: 0 }});
  return Coin.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        balance: { $sum: '$value' }
      }
    },
    { $project: { _id: false } }
  ]);
};

var Coin = module.exports = mongoose.model('Coin', Coin);