export const AAVE_VERSIONS = ['v2', 'v3'] as const;
export type AaveVersion = typeof AAVE_VERSIONS[number];

interface AaveAccountDataCommon {
  currentLiquidationThreshold: string;
  ltv: string;
  healthFactor: string;
}

export interface AaveV2AccountData extends AaveAccountDataCommon {
  totalCollateralETH: string;
  totalDebtETH: string;
  availableBorrowsETH: string;
}

export interface AaveV3AccountData extends AaveAccountDataCommon {
  totalCollateralBase: string;
  totalDebtBase: string;
  availableBorrowsBase: string;
}

export type AaveAccountData = AaveV2AccountData | AaveV3AccountData;

export interface AaveReserveData {
  currentVariableBorrowRate: string;
}

export interface AaveReserveTokensAddresses {
  variableDebtTokenAddress: string;
}

/**
 * Aave Pool contract addresses by version, chain, and network.
 * Source: https://aave.com/docs/resources/addresses
 */
export const AAVE_POOL_CONTRACT_ADDRESS: Record<'v2' | 'v3', Record<string, Record<string, string>>> = {
  v3: {
    ETH: {
      mainnet: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      sepolia: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951'
    },
    MATIC: {
      mainnet: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
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
      mainnet: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'
    },
    MATIC: {
      mainnet: '0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf'
    }
  }
};

export function getAavePoolAddress(chain: string, network: string, version: AaveVersion): string | undefined {
  const normalizedChain = chain.toUpperCase();
  const normalizedNetwork = network.toLowerCase();
  return AAVE_POOL_CONTRACT_ADDRESS[version]?.[normalizedChain]?.[normalizedNetwork];
}

export function isAaveVersion(value: string): value is AaveVersion {
  return (AAVE_VERSIONS as readonly string[]).includes(value);
}