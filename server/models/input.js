const mongoose = require('mongoose');

const Schema   = mongoose.Schema;

const InputSchema = new Schema({
  prevout:  { type: Object, default: {} },
  script:   { type: String, default: '' },
  witness:  { type: String, default: '' },
  sequence: { type: Number, default: 0 },
  address:  { type: String, default: '' },
});

InputSchema.index({ address: 1 });

const Input = mongoose.model('Input', InputSchema);

module.exports = Input;
