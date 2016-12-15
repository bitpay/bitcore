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
  name: 'WALLET_ALREADY_EXISTS',
  message: 'wallet already exists'
}, {
  name: 'COPAYER_IN_WALLET',
  message: 'copayer in wallet'
}, {
  name: 'WALLET_FULL',
  message: 'wallet is full'
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
  name: 'DUST_AMOUNT',
  message: 'Amount below dust threshold'
}, {
  name: 'COPAYER_VOTED',
  message: 'Copayer already voted on this transaction proposal'
}, {
  name: 'NOT_AUTHORIZED',
  message: 'not authorized'
}, {
  name: 'UNAVAILABLE_UTXOS',
  message: 'Unavailable unspent outputs'
}, {
  name: 'TX_NOT_FOUND',
  message: 'transaction proposal not found'
}];

module.exports = errorSpec;
