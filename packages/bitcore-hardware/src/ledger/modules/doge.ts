import { UtxoChainType } from 'src/types/chains.js';
import BitcoinLegacyModule from './btc-legacy.js';
import type * as HwTransport from '@ledgerhq/hw-transport';

export default class DogeModule extends BitcoinLegacyModule {
  derivationPath = "84'/0'/0'";
  chain: UtxoChainType = 'DOGE';
  
  constructor(transport: HwTransport.default) {
    super(transport);
  }
}
