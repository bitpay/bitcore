'use strict';

function format(arg) {
  return '\'' + arg
    .replace('{0}', '\' + arguments[0] + \'')
    .replace('{1}', '\' + arguments[1] + \'')
    .replace('{2}', '\' + arguments[2] + \'') + '\'';
}

module.exports = [{
  name: 'Mnemonic',
  message: format('Internal Error on Mnemonic {0}'),
  errors: [{
    'name': 'InvalidEntropy',
    'message': format('Entropy length must be an even multiple of 11 bits: {0}')
  }, {
    'name': 'UnknownWordlist',
    'message': format('Could not detect the used word list: {0}'),
  }, {
    'name': 'InvalidMnemonic',
    'message': format('Mnemonic string is invalid: {0}')
  }]
}];
