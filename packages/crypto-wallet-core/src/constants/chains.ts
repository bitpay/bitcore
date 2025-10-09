
export const UTXO_CHAINS = ['btc', 'bch', 'doge', 'ltc'];
export const EVM_CHAINS = ['eth', 'matic', 'arb', 'base', 'op'];
export const SVM_CHAINS = ['sol'];
export const RIPPLE_CHAINS = ['xrp'];
export const CHAINS = [...UTXO_CHAINS, ...EVM_CHAINS, ...SVM_CHAINS, ...RIPPLE_CHAINS];

export const MULTISIG_CHAINS = UTXO_CHAINS;

export const EVM_CHAIN_DEFAULT_TESTNET = {
  ETH: 'sepolia',
  MATIC: 'amoy',
  ARB: 'sepolia',
  BASE: 'sepolia',
  OP: 'sepolia'
}

export const EVM_CHAIN_NETWORK_TO_CHAIN_ID = {
  // Mainnets
  ETH_mainnet: 1,
  MATIC_mainnet: 137,
  ARB_mainnet: 42161,
  BASE_mainnet: 8453,
  OP_mainnet: 10,
  // ETH testnets
  ETH_holesky: 17000,
  ETH_sepolia: 11155111,
  ETH_goerli: 5,
  ETH_kovan: 42,
  ETH_ropsten: 3,
  ETH_rinkeby: 4,
  // MATIC testnets
  MATIC_mumbai: 80001,
  MATIC_amoy: 80002,
  // ARB testnets
  ARB_sepolia: 421614,
  ARB_goerli: 421613,
  // BASE testnets
  BASE_sepolia: 84532,
  BASE_goerli: 84531,
  // OP testnets
  OP_sepolia: 11155420,
  OP_goerli: 28528,
  // Regtests
  ETH_regtest: 1337,
  MATIC_regtest: 13375,
  ARB_regtest: 442161,
  BASE_regtest: 88453,
  OP_regtest: 111554201
}

const reverseObject = <K extends string, V extends number | string>(obj: Record<K, V>, split = false): Record<V, K> => {
  const reversed = {} as Record<V, K>;
  const entries = Object.entries(obj) as [K, V][];
  for (const [key, value] of entries) {
    const _key = split ? key.split('_')[0] as K : key;
    reversed[value] = _key;
  }
  return reversed;
};

export const EVM_CHAIN_ID_TO_CHAIN_NETWORK = reverseObject(EVM_CHAIN_NETWORK_TO_CHAIN_ID);

export const EVM_CHAIN_ID_TO_CHAIN = reverseObject(EVM_CHAIN_NETWORK_TO_CHAIN_ID, true);