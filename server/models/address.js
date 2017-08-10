const mongoose = require('mongoose');
const Input    = require('./input');
const Output   = require('./output');

const Schema   = mongoose.Schema;

const AddressSchema = new Schema({
  address:  String,
  inputs:   [Input.schema],
  outputs:  [Output.schema],
});

const Address = mongoose.model('Address', AddressSchema);

module.exports = Address;
