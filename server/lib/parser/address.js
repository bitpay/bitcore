const AddressModel = require('../../models/address');
const InputModel  = require('../../models/input');
const OutputModel = require('../../models/output');
const config      = require('../../config');
const util        = require('../../lib/util');
const logger      = require('../logger');

function parse(entry, txs) {
  txs.forEach((tx) => {

    tx.outputs.forEach((output) => {
      const outputJSON = output.toJSON();
    });

    tx.inputs.forEach((input) => {
      const inputJSON = input.toJSON();
    });
  });
}

module.exports = {
  parse,
};
