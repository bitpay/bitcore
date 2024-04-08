// list of supported chains: https://docs.moralis.io/supported-chains?list
const moralisChains = {
  ETH: {
    mainnet: '0x1',
    testnet: 'sepolia',
    sepolia: '0xaa36a7',
    goerli: '0x5',
    holesky: '0x4268'
  },
  MATIC: {
    mainnet: '0x89',
    testnet: 'mumbai',
    mumbai: '0x13881',    
  },
  ARB: {
    mainnet: '0xa4b1',
    testnet: 'sepolia',
    sepolia: '0x66eee'
  },
  OP: {
    mainnet: '0x1',
  },
  BASE: {
    mainnet: '0x2105',
    testnet: 'sepolia',
    sepolia: '0x14a34',
    goerli: '0x14a33'
  },
}

export default moralisChains;