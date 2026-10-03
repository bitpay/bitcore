import { UtxoChainType } from 'src/types/chains.js';
import BitcoinModule from './btc.js';
import type * as SignerKitBtc from '@ledgerhq/device-signer-kit-bitcoin';

export default class BitcoinCashModule extends BitcoinModule {
  derivationPath = "84'/0'/0'";
  chain: UtxoChainType = 'BCH';
  
  constructor(signer: SignerKitBtc.SignerBtc) {
    super(signer);
  }
}
