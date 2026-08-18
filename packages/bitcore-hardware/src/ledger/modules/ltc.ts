import { UtxoChain } from 'src/types/chains.js';
import BitcoinModule from './btc.js';
import type * as SignerKitBtc from '@ledgerhq/device-signer-kit-bitcoin';

export default class LitecoinModule extends BitcoinModule {
  derivationPath = "84'/2'/0'";
  chain: UtxoChain = 'LTC';
  
  constructor(signer: SignerKitBtc.SignerBtc) {
    super(signer);
  }
}
