const mongoose = require('mongoose');

const Schema   = mongoose.Schema;

const InputSchema = new Schema({
  prevout:  Object,
  script:   String,
  witness:  String,
  sequence: Number,
  address:  String,
});

const Input = mongoose.model('Input', InputSchema);

module.exports = Input;
