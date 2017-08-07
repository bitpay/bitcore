const mongoose = require('mongoose');

const Schema   = mongoose.Schema;

const OutputSchema = new Schema({
  address: String,
  script:  String,
  value:   Number,
  type:    String,
});

const Output = mongoose.model('Output', OutputSchema);

module.exports = Output;
