const mongoose = require('mongoose');
const Input    = require('./input');
const Output   = require('./output');

const Schema   = mongoose.Schema;

const AddressSchema = new Schema({
  address: { type: String, default: '' },
  inputs:  [Input.schema],
  outputs: [Output.schema],
});

const Address = mongoose.model('Address', AddressSchema);

module.exports = Address;
