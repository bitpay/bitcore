export const chainConfig = {
  ETH: {
    priorityFee: 1 // in gwei
  },
  MATIC: {
    priorityFee: 30
  },
  OP: {
    priorityFee: 1
  },
  ARB: {
    priorityFee: 0 // transactions are processed FIFO, no priorityFee fee is necessary for Arbitrum transactions
  },
  BASE: {
    priorityFee: 1
  }
};