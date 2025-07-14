export const FEE_MINIMUMS = {
  ETH: {
    priority: 1
  },
  MATIC: {
    priority: 30 * 1e9 // gwei
  },
  OP: {
    priority: 1
  },
  ARB: {
    priority: 0 // transactions are processed FIFO, no priority fee is necessary for Arbitrum transactions
  },
  BASE: {
    priority: 1
  },
  SOL: {
    priority: 0
  }
};
