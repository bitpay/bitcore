'use strict';

var errorSpec = [{
  name: 'INVALID_BACKUP',
  message: 'Invalid Backup.'
}, {
  name: 'WALLET_DOES_NOT_EXIST',
  message: 'Wallet does not exist.'
}, {
  name: 'MISSING_PRIVATE_KEY',
  message: 'Missing private keys to sign.'
}, {
  name: 'ENCRYPTED_PRIVATE_KEY',
  message: 'Private key is encrypted, cannot sign transaction.'
}, {
  name: 'SERVER_COMPROMISED',
  message: 'Server response could not be verified.'
}, {
  name: 'COULD_NOT_BUILD_TRANSACTION',
  message: 'Could not build the transaction.'
}, {
  name: 'INSUFFICIENT_FUNDS',
  message: 'Insufficient funds.'
}, {
  name: 'CONNECTION_ERROR',
  message: 'Wallet service connection error.'
}, {
  name: 'NOT_FOUND',
  message: 'Wallet service not found.'
}, {
  name: 'ECONNRESET_ERROR',
  message: 'ECONNRESET, body: {0}'
}, {
  name: 'WALLET_ALREADY_EXISTS',
  message: 'Wallet already exists.'
}, {
  name: 'COPAYER_IN_WALLET',
  message: 'Copayer in wallet.'
}, {
  name: 'WALLET_FULL',
  message: 'Wallet is full.'
}, {
  name: 'WALLET_NOT_FOUND',
  message: 'Wallet not found.'
}, {
  name: 'INSUFFICIENT_FUNDS_FOR_FEE',
  message: 'Insufficient funds for fee.'
}, {
  name: 'LOCKED_FUNDS',
  message: 'Locked funds.'
}, {
  name: 'DUST_AMOUNT',
  message: 'Amount below dust threshold.'
}, {
  name: 'COPAYER_VOTED',
  message: 'Copayer already voted on this transaction proposal.'
}, {
  name: 'NOT_AUTHORIZED',
  message: 'Not authorized.'
}, {
  name: 'UNAVAILABLE_UTXOS',
  message: 'Unavailable unspent outputs.'
}, {
  name: 'TX_NOT_FOUND',
  message: 'Transaction proposal not found.'
}, {
  name: 'MAIN_ADDRESS_GAP_REACHED',
  message: 'Maximum number of consecutive addresses without activity reached.'
}, {
  name: 'COPAYER_REGISTERED',
  message: 'Copayer already register on server.'
}
];

module.exports = errorSpec;
