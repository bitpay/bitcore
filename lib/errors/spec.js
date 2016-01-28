'use strict';

var errorSpec = [{
  name: 'INVALID_BACKUP',
  message: 'Invalid Backup'
}, {
  name: 'WALLET_DOES_NOT_EXIST',
  message: 'Wallet does not exist. Need to recreate'
}, {
  name: 'MISSING_PRIVATE_KEY',
  message: 'Missing private keys to sign'
}, {
  name: 'ENCRYPTED_PRIVATE_KEY',
  message: 'Private key is encrypted, cannot sign'
}, {
  name: 'SERVER_COMPROMISED',
  message: 'Server response could not be verified'
}, {
  name: 'COULD_NOT_BUILD_TRANSACTION',
  message: 'Could not build transaction'
}, {
  name: 'INSUFFICIENT_FUNDS',
  message: 'Insufficient funds'
}, {
  name: 'CONNECTION_ERROR',
  message: 'connection error'
}, {
  name: 'NOT_FOUND',
  message: 'not found'
}, {
  name: 'ECONNRESET_ERROR',
  message: 'ECONNRESET, body: {0}'
}, {
  name: 'BAD_RESPONSE_CODE',
  message: 'bad response code, code: {0}, body: {1}'
}, {
  name: 'WALLET_ALREADY_EXISTS',
  message: 'the wallet already exists'
}, {
  name: 'COPAYER_IN_WALLET',
  message: 'copayer in wallet'
}, {
  name: 'WALLET_FULL',
  message: 'wallet if full'
}, {
  name: 'WALLET_NOT_FOUND',
  message: 'wallet not found'
}, {
  name: 'INSUFFICIENT_FUNDS_FOR_FEE',
  message: 'insufficient funds for fee'
}, {
  name: 'LOCKED_FUNDS',
  message: 'locked funds'
}, {
  name: 'COPAYER_VOTED',
  message: 'Copayer already voted on this transaction proposal'
}, {
  name: 'NOT_AUTHORIZED',
  message: 'Copayer not found'
}, {
  name: 'UNAVAILABLE_UTXOS',
  message: 'Unavailable unspent outputs'
}, ];

module.exports = errorSpec;
