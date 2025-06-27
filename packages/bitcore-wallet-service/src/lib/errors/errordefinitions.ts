import { ClientError } from './clienterror';


interface Errors<T> {
  AD_ALREADY_EXISTS: T;
  BAD_SIGNATURES: T;
  BALANCE_BELOW_RESERVE: T;
  COPAYER_DATA_MISMATCH: T;
  COPAYER_IN_WALLET: T;
  COPAYER_REGISTERED: T;
  COPAYER_VOTED: T;
  DUST_AMOUNT: T;
  MORE_THAT_ONE_OUTPUT: T;
  INCORRECT_ADDRESS_NETWORK: T;
  ONLY_CASHADDR: T;
  INSUFFICIENT_FUNDS: T;
  INSUFFICIENT_FUNDS_FOR_FEE: T;
  INVALID_ADDRESS: T;
  INVALID_CHANGE_ADDRESS: T;
  KEY_IN_COPAYER: T;
  LOCKED_FUNDS: T;
  // Polygon Errors
  INSUFFICIENT_MATIC_FEE: T;
  LOCKED_MATIC_FEE: T;
  // Ethereum Errors
  INSUFFICIENT_ETH_FEE: T;
  LOCKED_ETH_FEE: T;
  // Arbitrum Errors
  INSUFFICIENT_ARB_FEE: T;
  LOCKED_ARB_FEE: T;
  // Base Errors
  INSUFFICIENT_BASE_FEE: T;
  LOCKED_BASE_FEE: T;
  // Optimisim Errors
  INSUFFICIENT_OP_FEE: T;
  LOCKED_OP_FEE: T;
  HISTORY_LIMIT_EXCEEDED: T;
  MAIN_ADDRESS_GAP_REACHED: T;
  MULTI_TX_UNSUPPORTED: T;
  NETWORK_SUSPENDED: T;
  NOT_AUTHORIZED: T;
  SCRIPT_OP_RETURN: T;
  SCRIPT_OP_RETURN_AMOUNT: T;
  SCRIPT_TYPE: T;
  TOO_MANY_KEYS: T;
  TX_ALREADY_BROADCASTED: T;
  TX_CANNOT_CREATE: T;
  TX_CANNOT_REMOVE: T;
  TX_MAX_SIZE_EXCEEDED: T;
  TX_NOT_ACCEPTED: T;
  TX_NOT_FOUND: T;
  TX_NOT_PENDING: T;
  TX_NONCE_CONFLICT: T;
  UNAVAILABLE_UTXOS: T;
  NO_INPUT_PATHS: T;
  UPGRADE_NEEDED: T;
  WALLET_ALREADY_EXISTS: T;
  WALLET_FULL: T;
  WALLET_BUSY: T;
  WALLET_NOT_COMPLETE: T;
  WALLET_NOT_FOUND: T;
  WALLET_NEED_SCAN: T;
  WRONG_SIGNING_METHOD: T;
  TSS_SESSION_NOT_FOUND: T;
  TSS_INVALID_PASSWORD: T;
  TSS_ROUND_ALREADY_DONE: T;
  TSS_ROUND_TOO_EARLY: T;
  TSS_GENERIC_ERROR: T;
  TSS_PUBKEY_MISSING: T;
  TSS_INVALID_MESSAGE: T;
  TSS_INVALID_MESSAGE_SIG: T;
  TSS_ROUND_MESSAGE_EXISTS: T;
  TSS_NON_PARTICIPANT: T;
  TSS_MAX_PARTICIPANTS_REACHED: T;
  TSS_BWS_JOIN_SECRET_NOT_FOUND: T;
  TSS_NO_FINAL_SIGNATURE: T;
  TSS_INVALID_FINAL_SIGNATURE: T;
};

const errors: Errors<string> = {
  AD_ALREADY_EXISTS: 'Ad already exists',
  BAD_SIGNATURES: 'Bad signatures',
  BALANCE_BELOW_RESERVE: 'Balance below reserve limit',
  COPAYER_DATA_MISMATCH: 'Copayer data mismatch',
  COPAYER_IN_WALLET: 'Copayer already in wallet',
  COPAYER_REGISTERED: 'Copayer ID already registered on server',
  COPAYER_VOTED: 'Copayer already voted on this transaction proposal',
  DUST_AMOUNT: 'Amount below dust threshold',
  MORE_THAT_ONE_OUTPUT: 'This wallet supports transactions with only one output',
  INCORRECT_ADDRESS_NETWORK: 'Incorrect address network',
  ONLY_CASHADDR: 'Only cashaddr wo prefix is allowed for outputs',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
  INSUFFICIENT_FUNDS_FOR_FEE: 'Insufficient funds for fee',
  INSUFFICIENT_MATIC_FEE: 'Your linked POLYGON wallet does not have enough MATIC for fee',
  LOCKED_MATIC_FEE: 'Your linked POLYGON wallet does not have enough MATIC for fee',
  INSUFFICIENT_ETH_FEE: 'Your linked ETH wallet does not have enough ETH for fee',
  LOCKED_ETH_FEE: 'Your linked ETH wallet does not have enough ETH for fee',
  INSUFFICIENT_ARB_FEE: 'Your linked ARB wallet does not have enough ETH for fee',
  LOCKED_ARB_FEE: 'Your linked ARB wallet does not have enough ETH for fee',
  INSUFFICIENT_BASE_FEE: 'Your linked BASE wallet does not have enough ETH for fee',
  LOCKED_BASE_FEE: 'Your linked BASE wallet does not have enough ETH for fee',
  INSUFFICIENT_OP_FEE: 'Your linked OP wallet does not have enough ETH for fee',
  LOCKED_OP_FEE: 'Your linked OP wallet does not have enough ETH for fee',
  INVALID_ADDRESS: 'Invalid address',
  INVALID_CHANGE_ADDRESS: 'Invalid change address',
  KEY_IN_COPAYER: 'Key already registered',
  LOCKED_FUNDS: 'Funds are locked by pending transaction proposals',
  HISTORY_LIMIT_EXCEEDED: 'Requested page limit is above allowed maximum',
  MAIN_ADDRESS_GAP_REACHED: 'Maximum number of consecutive addresses without activity reached',
  MULTI_TX_UNSUPPORTED: 'Desired chain does not support multi transaction proposals',
  NETWORK_SUSPENDED: '$network operations are currently suspended. Please check status.bitpay.com for further updates.',
  NOT_AUTHORIZED: 'Not authorized',
  SCRIPT_OP_RETURN: 'The only supported script is OP_RETURN',
  SCRIPT_OP_RETURN_AMOUNT: 'The amount of an output with OP_RETURN script must be 0',
  SCRIPT_TYPE: 'Script must be a valid data type',
  TOO_MANY_KEYS: 'Too many keys registered',
  TX_ALREADY_BROADCASTED: 'The transaction proposal is already broadcasted',
  TX_CANNOT_CREATE: 'Cannot create TX proposal during backoff time',
  TX_CANNOT_REMOVE: 'Cannot remove this tx proposal during locktime',
  TX_MAX_SIZE_EXCEEDED: 'TX exceeds maximum allowed size',
  TX_NOT_ACCEPTED: 'The transaction proposal is not accepted',
  TX_NOT_FOUND: 'Transaction proposal not found',
  TX_NOT_PENDING: 'The transaction proposal is not pending',
  TX_NONCE_CONFLICT: 'Unsigned TX proposal(s) with lower or conflicting nonces exist. Please sign or reject them first.',
  UNAVAILABLE_UTXOS: 'Unavailable unspent outputs',
  NO_INPUT_PATHS: 'Derivation paths were not provided for the inputs',
  UPGRADE_NEEDED: 'Client app needs to be upgraded',
  WALLET_ALREADY_EXISTS: 'Wallet already exists',
  WALLET_FULL: 'Wallet full',
  WALLET_BUSY: 'Wallet is busy, try later',
  WALLET_NOT_COMPLETE: 'Wallet is not complete',
  WALLET_NOT_FOUND: 'Wallet not found',
  WALLET_NEED_SCAN: 'Wallet needs addresses scan',
  WRONG_SIGNING_METHOD: 'Wrong signed method for coin/network',
  TSS_SESSION_NOT_FOUND: 'Session not found',
  TSS_INVALID_PASSWORD: 'Invalid password',
  TSS_ROUND_ALREADY_DONE: 'Your message is for a round that has already finished',
  TSS_ROUND_TOO_EARLY: 'Other participants must finish the current round first',
  TSS_GENERIC_ERROR: 'An unexpected error occurred',
  TSS_PUBKEY_MISSING: 'Pubkey missing',
  TSS_INVALID_MESSAGE: 'Invalid message',
  TSS_INVALID_MESSAGE_SIG: 'Invalid message signature',
  TSS_ROUND_MESSAGE_EXISTS: 'You have already sent a message for this round',
  TSS_NON_PARTICIPANT: 'You are not a participant in this session',
  TSS_MAX_PARTICIPANTS_REACHED: 'Maximum number of participants reached',
  TSS_BWS_JOIN_SECRET_NOT_FOUND: 'BWS join secret not found',
  TSS_NO_FINAL_SIGNATURE: 'No signature provided',
  TSS_INVALID_FINAL_SIGNATURE: 'Invalid signature provided',
};

const errorsObject = { codes: {} };

for (const [code, msg] of Object.entries(errors)) {
  errorsObject[code] = new ClientError(code, msg);
  errorsObject.codes[code] = code;
}

export const Errors = errorsObject as Errors<ClientError> & { codes: Errors<string> };
