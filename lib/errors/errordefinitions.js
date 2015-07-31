'use strict';

var _ = require('lodash');

var ClientError = require('./clienterror');

var errors = {
  BADSIGNATURES: 'Bad signatures',
  BLOCKCHAINERROR: 'An error ocurred while trying to interact with the blockchain explorer',
  CDATAMISMATCH: 'Copayer data mismatch',
  CINWALLET: 'Copayer already in wallet',
  CREGISTERED: 'Copayer ID already registered on server',
  CVOTED: 'Copayer already voted on this transaction proposal',
  DUSTAMOUNT: 'Amount below dust threshold',
  INSUFFICIENTFUNDS: 'Insufficient funds',
  INSUFFICIENTFUNDSFORFEE: 'Insufficient funds for fee',
  INVALIDADDRESS: 'Invalid address',
  LOCKEDFUNDS: 'Funds are locked by pending transaction proposals',
  NOTALLOWEDTOCREATETX: 'Cannot create TX proposal during backoff time',
  NOTAUTHORIZED: 'Not authorized',
  TXALREADYBROADCASTED: 'The transaction proposal is already broadcasted',
  TXCANNOTREMOVE: 'Cannot remove this tx proposal during locktime',
  TXNOTACCEPTED: 'The transaction proposal is not accepted',
  TXNOTPENDING: 'The transaction proposal is not pending',
  UPGRADENEEDED: 'Client app needs to be upgraded',
  WEXISTS: 'Wallet already exists',
  WFULL: 'Wallet full',
  WNOTFULL: 'Replace only works on full wallets',
};

var errorObjects = _.zipObject(_.map(errors, function(msg, code) {
  return [code, new ClientError(code, msg)];
}));

errorObjects.codes = _.mapValues(errors, function(v, k) {
  return k;
});

module.exports = errorObjects;
