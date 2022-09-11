var errorSpec = [
  {
    name: 'INVALID_BACKUP',
    message: 'Invalid Backup.'
  },
  {
    name: 'OBSOLETE_BACKUP',
    message: 'Wallet backup is obsolete.'
  },
  {
    name: 'WALLET_DOES_NOT_EXIST',
    message: 'Wallet does not exist.'
  },
  {
    name: 'MISSING_PRIVATE_KEY',
    message: 'Missing private keys to sign.'
  },
  {
    name: 'ENCRYPTED_PRIVATE_KEY',
    message: 'Private key is encrypted, cannot sign transaction.'
  },
  {
    name: 'SERVER_COMPROMISED',
    message: 'Server response could not be verified.'
  },
  {
    name: 'COULD_NOT_BUILD_TRANSACTION',
    message: 'Could not build the transaction.'
  },
  {
    name: 'INSUFFICIENT_FUNDS',
    message: 'Insufficient funds.'
  },
  {
    name: 'CONNECTION_ERROR',
    message: 'Wallet service connection error.'
  },
  {
    name: 'MAINTENANCE_ERROR',
    message: 'Wallet service is under maintenance.'
  },
  {
    name: 'NOT_FOUND',
    message: 'Wallet service not found.'
  },
  {
    name: 'ECONNRESET_ERROR',
    message: 'ECONNRESET, body: {0}'
  },
  {
    name: 'WALLET_ALREADY_EXISTS',
    message: 'Wallet already exists.'
  },
  {
    name: 'COPAYER_IN_WALLET',
    message: 'Copayer in wallet.'
  },
  {
    name: 'WALLET_FULL',
    message: 'Wallet is full.'
  },
  {
    name: 'WALLET_NOT_FOUND',
    message: 'Wallet not found.'
  },
  {
    name: 'INSUFFICIENT_FUNDS_FOR_FEE',
    message: 'Insufficient funds for fee.'
  },
  {
    name: 'INSUFFICIENT_ETH_FEE',
    message: 'Your linked ETH wallet does not have enough ETH for fee.'
  },
  {
    name: 'LOCKED_FUNDS',
    message: 'Locked funds.'
  },
  {
    name: 'LOCKED_ETH_FEE',
    message: 'Your ETH linked wallet funds are locked by pending spend proposals.'
  },
  {
    name: 'DUST_AMOUNT',
    message: 'Amount below dust threshold.'
  },
  {
    name: 'COPAYER_VOTED',
    message: 'Copayer already voted on this transaction proposal.'
  },
  {
    name: 'NOT_AUTHORIZED',
    message: 'Not authorized.'
  },
  {
    name: 'UNAVAILABLE_UTXOS',
    message: 'Unavailable unspent outputs.'
  },
  {
    name: 'TX_NOT_FOUND',
    message: 'Transaction proposal not found.'
  },
  {
    name: 'MAIN_ADDRESS_GAP_REACHED',
    message: 'Maximum number of consecutive addresses without activity reached.'
  },
  {
    name: 'COPAYER_REGISTERED',
    message: 'Copayer already register on server.'
  },
  {
    name: 'INPUT_NOT_FOUND',
    message:
      "We could not find one or more inputs for your transaction on the blockchain. Make sure you're not trying to use unconfirmed change."
  },
  {
    name: 'UNCONFIRMED_INPUTS_NOT_ACCEPTED',
    message: 'Can not pay this invoice using unconfirmed inputs.'
  },
  {
    name: 'INVOICE_NOT_AVAILABLE',
    message: 'The invoice is no available.'
  },
  {
    name: 'INVOICE_EXPIRED',
    message: 'The invoice is no longer receiving payments.'
  },
  {
    name: 'UNABLE_TO_PARSE_PAYMENT',
    message: 'We were unable to parse your payment. Please try again or contact your wallet provider.'
  },
  {
    name: 'NO_TRASACTION',
    message: 'Your request did not include a transaction. Please try again or contact your wallet provider.'
  },
  {
    name: 'INVALID_TX_FORMAT',
    message:
      'Your transaction was an in an invalid format, it must be a hexadecimal string. Contact your wallet provider.'
  },
  {
    name: 'UNABLE_TO_PARSE_TX',
    message: 'We were unable to parse the transaction you sent. Please try again or contact your wallet provider.'
  },
  {
    name: 'WRONG_ADDRESS',
    message: 'The transaction you sent does not have any output to the address on the invoice'
  },
  {
    name: 'WRONG_AMOUNT',
    message: 'The amount on the transaction does not match the amount requested. This payment will not be accepted.'
  },
  {
    name: 'NOT_ENOUGH_FEE',
    message: 'Transaction fee is below the current minimum threshold.'
  },
  {
    name: 'BTC_NOT_BCH',
    message: 'This invoice is priced in BTC, not BCH. Please try with a BTC wallet instead.'
  },
  {
    name: 'REQUEST_TIMEOUT',
    message: 'The PayPro request has timed out. Please connect to the internet or try again later.'
  },
  {
    name: 'INVALID_REQUEST',
    message: 'The PayPro request was invalid. Please try again later.'
  }
];
module.exports = errorSpec;
