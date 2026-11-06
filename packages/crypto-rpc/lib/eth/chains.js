// feeHistory: estimate the gas price and priority fee from eth_feeHistory instead of reading the transactions of
// the last blocks
export const chainConfig = {
  ETH: {
    priorityFee: 1 // in gwei
  },
  MATIC: {
    priorityFee: 30,
    feeHistory: true
  },
  OP: {
    priorityFee: 1,
    feeHistory: true
  },
  ARB: {
    priorityFee: 0, // transactions are processed FIFO, no priorityFee fee is necessary for Arbitrum transactions
    feeHistory: true
  },
  BASE: {
    priorityFee: 1,
    feeHistory: true
  },
  ARC: {
    priorityFee: 2.5,
    feeHistory: true
  }
};
