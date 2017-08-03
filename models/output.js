const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Output = new Schema({
  address: String,
  amount: Number,
  vout: Number,
  wallets: { type: [Schema.Types.ObjectId] },
});

const Output = mongoose.model('Output', Output);

module.exports = Output;