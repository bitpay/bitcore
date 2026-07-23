export interface GetAddressesOpts {
  /** Limit the resultset. Return all addresses by default. */
  limit?: number;
  /** Skip this number of addresses in resultset. Useful for paging. */
  skip?: number;
  /** Reverse the order of returned addresses. */
  reverse?: boolean;
  /** Filter by specific addresses. */
  addresses?: string[];
  /** Filter out change addresses. */
  noChange?: boolean;
}

export interface UpgradeCheckOpts {
  chain?: string;
  network?: string;
  n?: number;
  usePurpose48?: boolean;
  addressType?: string;
  maxTxpVersion?: number | string;
  version?: number | string;
  signingMethod?: string;
  supportBchSchnorr?: boolean;
}

export interface GetSendMaxInfoOpts {
  /**
   * Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy') as defined in Defaults.FEE_LEVELS.
   * @default 'normal'
   */
  feeLevel?: string;
  /**
   * Specify the fee per KB for this TX (in satoshi).
   */
  feePerKb?: number;
  /**
   * Do not use UTXOs of unconfirmed transactions as inputs
   */
  excludeUnconfirmedUtxos?: boolean;
  /**
   * Return the list of UTXOs that would be included in the tx.
   */
  returnInputs?: boolean;
  /**
   * Use fee estimation for paypro
   */
  usePayPro?: boolean;
  /**
   * Specify the sender ETH address.
   */
  from?: string;
  /**
   * SOL only: Specify the number of signatures
   */
  numSignatures?: number;
}

export interface NumberFormatOpts {
  /** Specify format of numbers to return that could potentially be large or otherwise tx-building numbers */
  numberFormat?: 'hex' | 'number' | 'string';
}