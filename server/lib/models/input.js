const mongoose = require('mongoose');

const Schema   = mongoose.Schema;

const InputSchema = new Schema({
  value:    { type: Number, default: 0 },
  prevout:  { type: Object, default: {} },
  script:   { type: String, default: '' },
  witness:  { type: String, default: '' },
  sequence: { type: Number, default: 0 },
  address:  { type: String, default: '' },
});

const Input = mongoose.model('Input', InputSchema);

module.exports = Input;
