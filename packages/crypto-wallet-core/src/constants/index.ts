import { EVM_CHAIN_ID_TO_CHAIN, EVM_CHAIN_NETWORK_TO_CHAIN_ID } from './chains';
import { FEE_MINIMUMS } from './feeMinimums';
import { TOKEN_OPTS as opts } from './tokens';
import { UNITS } from './units';
export let Constants = {
  ETH_TOKEN_OPTS: opts.ETH_TOKEN_OPTS,
  MATIC_TOKEN_OPTS: opts.MATIC_TOKEN_OPTS,
  ARB_TOKEN_OPTS: opts.ARB_TOKEN_OPTS,
  BASE_TOKEN_OPTS: opts.BASE_TOKEN_OPTS,
  OP_TOKEN_OPTS: opts.OP_TOKEN_OPTS,
  SOL_TOKEN_OPTS: opts.SOL_TOKEN_OPTS,
  UNITS,
  FEE_MINIMUMS,
  EVM_CHAIN_ID_TO_CHAIN,
  EVM_CHAIN_NETWORK_TO_CHAIN_ID
};
