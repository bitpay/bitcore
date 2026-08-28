import {
  ARBERC20TxProvider,
  ARBTxProvider
} from './arb';
import {
  BASEERC20TxProvider,
  BASETxProvider
} from './base';
import { BCHTxProvider, BchCreateParams } from './bch';
import { BTCTxProvider, BtcApplySignatureParams, BtcCreateParams, BtcGetHashParams, BtcGetSighashParams, BtcSignParams, BtcTransformSignatureObjectParams } from './btc';
import { DOGETxProvider, DogeCreateParams } from './doge';
import { ERC20TxProvider, Erc20CreateParams } from './erc20';
import { ETHTxProvider, EthApplySignatureParams, EthCreateParams, EthGetHashParams, EthGetSignatureParams, EthSignParams, EthTransformSignatureObjectParams } from './eth';
import { ETHMULTISIGTxProvider } from './eth-multisig';
import { LTCTxProvider, LtcCreateParams } from './ltc';
import {
  MATICERC20TxProvider,
  MATICTxProvider
} from './matic';
import { MATICMULTISIGTxProvider, MaticMultisigCreateParams } from './matic-multisig';
import { OPERC20TxProvider, OPTxProvider } from './op';
import { SOLTxProvider, SolApplySignatureParams, SolCreateParams, SolGetHashParams, SolGetSighashParams, SolGetSignatureParams, SolSignParams } from './sol';
import { SPLTxProvider, SplCreateParams } from './spl';
import { XRPTxProvider, XrpApplySignatureParams, XrpCreateParams, XrpGetHashParams, XrpGetSighashParams, XrpSignParams, XrpTransformSignatureObjectParams } from './xrp';

const providers = {
  BTC: new BTCTxProvider(),
  BCH: new BCHTxProvider(),
  ETH: new ETHTxProvider(),
  ETHERC20: new ERC20TxProvider(),
  ETHMULTISIG: new ETHMULTISIGTxProvider(),
  XRP: new XRPTxProvider(),
  DOGE: new DOGETxProvider(),
  LTC: new LTCTxProvider(),
  MATIC: new MATICTxProvider(),
  MATICMULTISIG: new MATICMULTISIGTxProvider(),
  MATICERC20: new MATICERC20TxProvider(),
  ARB: new ARBTxProvider(),
  ARBERC20: new ARBERC20TxProvider(),
  BASE: new BASETxProvider(),
  BASEERC20: new BASEERC20TxProvider(),
  OP: new OPTxProvider(),
  OPERC20: new OPERC20TxProvider(),
  ARC: new ETHTxProvider('ARC'),
  ARCERC20: new ERC20TxProvider('ARC'),
  SOL: new SOLTxProvider(),
  SOLSPL: new SPLTxProvider(),
};

export class TransactionsProxy {
  get(params: DefaultParams) {
    const normalizedChain = params.chain.toUpperCase();
    return providers[normalizedChain];
  }

  create(params: BtcCreateParams & { chain: 'BTC' }): string;
  create(params: BchCreateParams & { chain: 'BCH' }): string;
  create(params: LtcCreateParams & { chain: 'LTC' }): string;
  create(params: DogeCreateParams & { chain: 'DOGE' }): string;
  create(params: MaticMultisigCreateParams & { chain: 'MATICMULTISIG' }): string;
  create(params: Erc20CreateParams & { chain: Erc20Chain }): string;
  create(params: EthCreateParams & { chain: Exclude<EvmChain, Erc20Chain> }): string;
  create(params: SolCreateParams & { chain: 'SOL' }): string;
  create(params: SplCreateParams & { chain: 'SOLSPL' }): string;
  create(params: XrpCreateParams & { chain: 'XRP' }): string;
  create(params: DefaultParams): string {
    return this.get(params).create(params);
  }

  sign(params: BtcSignParams & { chain: UtxoChain }): string;
  sign(params: EthSignParams & { chain: EvmChain }): string;
  sign(params: SolSignParams & { chain: SolChain }): string;
  sign(params: XrpSignParams & { chain: 'XRP' }): string;
  sign(params: DefaultParams): string {
    return this.get(params).sign(params);
  }

  getSignature(params: Record<string, any> & { chain: UtxoChain }): any; // not implemented
  getSignature(params: EthGetSignatureParams & { chain: EvmChain }): string;
  getSignature(params: SolGetSignatureParams & { chain: SolChain }): string;
  getSignature(params: XrpGetSighashParams & { chain: 'XRP' }): string;
  getSignature(params: DefaultParams): string {
    return this.get(params).getSignature(params);
  }

  applySignature(params: BtcApplySignatureParams & { chain: UtxoChain }): string;
  applySignature(params: EthApplySignatureParams & { chain: EvmChain }): string;
  applySignature(params: SolApplySignatureParams & { chain: SolChain }): string;
  applySignature(params: XrpApplySignatureParams & { chain: 'XRP' }): string;
  applySignature(params: DefaultParams): string {
    return this.get(params).applySignature(params);
  }

  getHash(params: BtcGetHashParams & { chain: UtxoChain }): string;
  getHash(params: EthGetHashParams & { chain: EvmChain }): string;
  getHash(params: SolGetHashParams & { chain: SolChain }): string;
  getHash(params: XrpGetHashParams & { chain: 'XRP' }): string;
  getHash(params: DefaultParams): string {
    return this.get(params).getHash(params);
  }

  transformSignatureObject(params: BtcTransformSignatureObjectParams & { chain: UtxoChain }): string;
  transformSignatureObject(params: EthTransformSignatureObjectParams & { chain: EvmChain }): string;
  // not implemented for solana
  transformSignatureObject(params: XrpTransformSignatureObjectParams & { chain: 'XRP' }): string;
  transformSignatureObject(params: DefaultParams): string {
    return this.get(params).transformSignatureObject(params);
  }

  getSighash(params: BtcGetSighashParams & { chain: UtxoChain }): string;
  getSighash(params: EthGetSignatureParams & { chain: EvmChain }): string;
  getSighash(params: SolGetSighashParams & { chain: SolChain }): string;
  getSighash(params: XrpGetSighashParams & { chain: 'XRP' }): string;
  getSighash(params: DefaultParams): string {
    return this.get(params).getSighash(params);
  }
}

type UtxoChain = 'BTC' | 'BCH' | 'LTC' | 'DOGE';
type Erc20Chain =
    'ETHERC20' | 'MATICERC20' | 'ARBERC20'
  | 'BASEERC20' | 'OPERC20' | 'ARCERC20';
type EvmChain = Erc20Chain |
    'ETH' |'ETHMULTISIG' | 'MATIC'
  | 'MATICMULTISIG' | 'ARB' | 'ARC'
  | 'OP' | 'OPERC20' | 'BASE';
type SolChain = 'SOL' | 'SOLSPL';
type Chain = UtxoChain | EvmChain | SolChain | 'XRP';

type DefaultParams = { chain: Chain };

export default new TransactionsProxy();
