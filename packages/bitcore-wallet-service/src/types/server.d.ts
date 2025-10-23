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

export interface GetBalanceObj { 
  totalAmount: number;
  lockedAmount: number;
  totalConfirmedAmount: number;
  lockedConfirmedAmount: number;
  availableAmount: number;
  availableConfirmedAmount: number;
}