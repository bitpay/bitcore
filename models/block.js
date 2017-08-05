const mongoose = require('mongoose');

const Schema   = mongoose.Schema;

hash: '0000000000004bb2eda7530f52bf5566161b6d74e752afdaf9656e16c96928ae',
  height: undefined,
  version: 1,
  prevBlock: '00000000000020304684a71d9b8a736c5088d76fb4c6d864f04bcb75d2e20fe4',
  merkleRoot: '7c09ce1e6821d9daf04f7aa820a97449005e1a9fb98fedb6504707d08ac1b455',
  ts: 1302990080,
  bits: 453036989,
  nonce: 3214150888,

const BlockSchema = new Schema({
  hash: String,
  height: Number,
  version: Number,
  size: Number,
  prevBlock: String,
  merkleRoot: String,
  ts: Number,
  bits: Number,
  nonce: Number,
  tx: Array,
  difficulty: Number,
  chainwork: Number,
  nextBlockHash: String,
  reward: Number,
  network: String,
  poolInfo: Object,
  txCount: Number,
  rawBlock: String,
});

const Block = mongoose.model('Block', BlockSchema);

module.exports = Block;
