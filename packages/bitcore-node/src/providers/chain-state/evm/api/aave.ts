export const AAVE_POOL_CONTRACT_ADDRESS: Record<'v2' | 'v3', Record<string, Record<string, string>>> = {
  v3: {
    ETH: {
      mainnet: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      sepolia: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951' // sepolia TODO: Update me with a test contract address
    },
    MATIC: {
      mainnet: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      mumbai: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' // mumbai TODO: Update me with a test contract address
    },
    BASE: {
      mainnet: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'
    },
    ARB: {
      mainnet: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    OP: {
      mainnet: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    }
  },
  v2: {
    ETH: {
      mainnet: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
      sepolia: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9' // sepolia TODO: Update me with a test contract address
    },
    MATIC: {
      mainnet: '0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf',
      amoy: '0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf' // amoy TODO: Update me with a test contract address
    }
  }
};

export function getAavePoolAddress(chain: string, network: string, version: 'v2' | 'v3'): string | undefined {
  const normalizedChain = chain.toUpperCase();
  const normalizedNetwork = network.toLowerCase();
  return AAVE_POOL_CONTRACT_ADDRESS[version]?.[normalizedChain]?.[normalizedNetwork];
}
