'use strict';

var _ = require('lodash');

var ClientError = require('./clienterror');

var errors = {
  INVALID_BACKUP: 'Invalid Backup',
  WALLET_DOES_NOT_EXIST: 'Wallet does not exist. Need to recreate',
  MISSING_PRIVATE_KEY: 'Missing private keys to sign',
  ENCRYPTED_PRIVATE_KEY: 'Private key is encrypted, cannot sign',
  SERVER_COMPROMISED: 'Server response could not be verified',
  COULD_NOT_BUILD_TRANSACTION: 'Could not build transaction',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
};

var errorObjects = _.zipObject(_.map(errors, function(msg, code) {
  return [code, new ClientError(code, msg)];
}));

errorObjects.codes = _.mapValues(errors, function(v, k) {
  return k;
});

module.exports = errorObjects;
