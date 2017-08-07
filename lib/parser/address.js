const AddressModel = require('../../models/address');
const InputModel  = require('../../models/input');
const OutputModel = require('../../models/output');
const config      = require('../../config');
const util        = require('../../lib/util');
const logger      = require('../logger');

function parse(entry, txs) {
  txs.forEach((tx) => {
    //const txJSON = tx.toJSON();

    tx.outputs.forEach((output) => {
      const outputJSON = output.toJSON();
      console.log(outputJSON);
      /*
      return new OutputModel({
        address: outputJSON.address,
        script:  outputJSON.script,
        value:   outputJSON.value,
      });*/
    });

    tx.inputs.forEach((input) => {
      const inputJSON = input.toJSON();
      console.log(inputJSON);
/*        return new InputModel({
          prevout:  inputJSON.prevout,
          script:   inputJSON.script,
          witness:  inputJSON.witness,
          sequence: inputJSON.sequence,
          address:  inputJSON.address,
        });
      })*/
    });
  });
}

module.exports = {
  parse,
};
