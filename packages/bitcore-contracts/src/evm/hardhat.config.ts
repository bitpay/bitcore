import hardhatToolboxMochaEthersPlugin from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import { configVariable, defineConfig } from 'hardhat/config';

// src/evm/package.json makes this folder the Hardhat project root, so the default
// paths (contracts/, test/, ignition/, artifacts/, cache/, types/) are relative to it.
export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: '0.8.34'
      },
      production: {
        version: '0.8.34',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    }
  },
  networks: {
    hardhatMainnet: {
      type: 'edr-simulated',
      chainType: 'l1'
    },
    hardhatOp: {
      type: 'edr-simulated',
      chainType: 'op'
    },
    // `npx hardhat node`, or a local geth/anvil dev node
    localhost: {
      type: 'http',
      chainType: 'l1',
      url: process.env.HARDHAT_URL || 'http://127.0.0.1:8545'
    },
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('SEPOLIA_RPC_URL'),
      accounts: [configVariable('SEPOLIA_PRIVATE_KEY')]
    }
  }
});
