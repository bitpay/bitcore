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