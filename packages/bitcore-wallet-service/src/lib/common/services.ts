'use strict';

module.exports = {
  // Recommended whitelist of contracts as spenders for ERC20 tokens
  ERC20_SPENDER_APPROVAL_WHITELIST: [
    {
      address: '0x11111112542D85B3EF69AE05771c2dCCff4fAa26', // 1inch v3 Contract address
      contractName: '1inch v3',
      name: '1inch',
      url: 'https://app.1inch.io'
    },
    {
      address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3: Router Contract address
      contractName: 'Uniswap V3: Router',
      name: 'Uniswap',
      url: 'https://app.uniswap.org'
    },
    {
      address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2: Router 2 Contract address
      contractName: 'Uniswap V2: Router 2',
      name: 'Uniswap',
      url: 'https://app.uniswap.org'
    }
  ]
};
