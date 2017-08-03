const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Input = new Schema({
  utxo: String,
  vout: Number,
  address: String,
  amount: Number,
  wallets: { type: [Schema.Types.ObjectId] },
});

const Input = mongoose.model('Input', Input);

module.exports = Input;