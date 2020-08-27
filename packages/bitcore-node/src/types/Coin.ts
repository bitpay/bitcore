export interface CoinJSON {
  _id: string;
  network: string;
  chain: string;
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  coinbase: boolean;
  value: number;
  address: string;
  script: string;
  spentTxid: string;
  spentHeight: number;
  confirmations?: number;
  sequenceNumber?: number;
}

export interface CoinListingJSON {
  inputs: CoinJSON[];
  outputs: CoinJSON[];
}

/**
 * Number values less than 0 which indicate the spent state of a coin.
 */
export const enum SpentHeightIndicators {
  /**
   * The value below which numbers are simply used as indicators.
   */
  minimum = 0,
  /**
   * The coin is spent by a transaction currently in the mempool but not yet
   * included in a block.
   */
  pending = -1,
  /**
   * The coin is unspent, and no transactions spending it have been seen.
   */
  unspent = -2,
  /**
   * The coin was minted by a transaction which can no longer confirm.
   */
  conflicting = -3,

  /**
   * An internal error occurred. (The database appears to be inconsistent.)
   */
  error = -4
}
