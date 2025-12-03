import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-ignition-ethers';

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    compilers: [
      { version: '0.4.24' },
      // add more here
    ]
  },
  ignition: {
    requiredConfirmations: 1
  },
  networks: {
    geth: {
      url: 'http://geth:8545',
      gas: 4700000,
      chainId: 1337
    },
    local: {
      url: process.env.HARDHAT_URL || 'http://localhost:8545',
      gas: 4700000,
      chainId: 1337
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
    modules: './ignition/modules'
  }
};
