export type UtxoChainType = 'BTC' | 'BCH' | 'DOGE' | 'LTC';
export type EvmChainType = 'ETH';
export type SolChainType = 'SOL';
export type ChainType = UtxoChainType | EvmChainType | SolChainType;
export type TransportChainType = 'BCH' | 'DOGE' | 'LTC';
export type DmkChainType = 'BTC' | 'ETH' | 'SOL';

export const UTXO_CHAINS = ['BTC', 'BCH', 'DOGE', 'LTC'];
export const EVM_CHAINS = ['ETH'];
export const SOL_CHAINS = ['SOL'];
export const CHAINS = UTXO_CHAINS.concat(EVM_CHAINS).concat(SOL_CHAINS);
export const TRANSPORT_CHAINS = ['BCH', 'DOGE', 'LTC'];
export const DMK_CHAINS = ['BTC', 'ETH', 'SOL'];
