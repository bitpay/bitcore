export type UtxoChainType = 'BTC' | 'BCH' | 'DOGE' | 'LTC';
export type EvmChainType = 'ETH';
export type SolChainType = 'SOL';
export type ChainType = UtxoChainType | EvmChainType | SolChainType;

export const utxoChains = ['BTC', 'BCH', 'DOGE', 'LTC'];
export const evmChains = ['ETH'];
export const solChains = ['SOL'];
export const chains = utxoChains.concat(evmChains).concat(solChains);
