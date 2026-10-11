import { UtxoChainType } from 'src/types/chains.js';
import BitcoinLegacyModule from './btc-legacy.js';
import type { AddressFormat } from '@ledgerhq/hw-app-btc/getWalletPublicKey';
import type * as HwTransport from '@ledgerhq/hw-transport';

export default class DogeModule extends BitcoinLegacyModule {
  chain: UtxoChainType = 'DOGE';
  derivationPath = "44'/3'/0'";
  addressFormat: AddressFormat = 'legacy';
  
  constructor(transport: HwTransport.default) {
    super(transport);
  }
}
