'use strict';

function format(arg) {
  return '\'' + arg
    .replace('{0}', '\' + arguments[0] + \'')
    .replace('{1}', '\' + arguments[1] + \'')
    .replace('{2}', '\' + arguments[2] + \'') + '\'';
}

module.exports = [{
  name: 'PaymentProtocol',
  message: format('Internal Error on bitcore-payment-protocol Module {0}')
}];
