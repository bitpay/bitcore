export const SOL_ERROR_MESSAGES = {
  ATA_NOT_INITIALIZED: 'ATA not initialized on mint for provided account. Initialize ATA first.',
  INVALID_MINT_PARAMETER: 'SolanaError: Invalid parameter (mint)',
  UNSPECIFIED_INVALID_PARAMETER: 'SolanaError: Invalid parameter (unspecified)',
  NON_BASE58_PARAM: 'SolanaError: Provided parameters includes non-base58 string.',
  TOKEN_ACCOUNT_NOT_FOUND: 'SolanaError: Account could not be found corresponding to provided address',
  PROVIDED_TOKEN_ADDRESS_IS_SOL: 'SolanaError: Provided address is a SOL address but should be a token address',
  SOL_ACCT_NOT_FOUND: 'Provided address does not correspond to an account on the Solana blockchain',
  ATA_ADD_SENT_INSTEAD_OF_SOL_ADD: 'SolanaError: Request object exceeds 127 bytes. This may be caused by the provided address belonging to an Associated Token Account instead of a Solana account.',
};