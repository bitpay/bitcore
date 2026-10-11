import { UtxoChainType } from 'src/types/chains.js';
import BitcoinLegacyModule from './btc-legacy.js';
import type { AddressFormat } from '@ledgerhq/hw-app-btc/getWalletPublicKey';
import type * as HwTransport from '@ledgerhq/hw-transport';

export default class LitecoinModule extends BitcoinLegacyModule {
  chain: UtxoChainType = 'LTC';
  derivationPath = "44'/2'/0'";
  addressFormat: AddressFormat = 'legacy';
  
  constructor(transport: HwTransport.default) {
    super(transport);
  }
}
