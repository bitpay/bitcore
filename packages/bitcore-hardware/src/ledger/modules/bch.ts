import { UtxoChainType } from 'src/types/chains.js';
import BitcoinLegacyModule from './btc-legacy.js';
import type { AddressFormat } from '@ledgerhq/hw-app-btc/getWalletPublicKey';
import type * as HwTransport from '@ledgerhq/hw-transport';

export default class BitcoinCashModule extends BitcoinLegacyModule {
  chain: UtxoChainType = 'BCH';
  derivationPath = "44'/145'/0'";
  addressFormat: AddressFormat = 'legacy';
  
  constructor(transport: HwTransport.default) {
    super(transport);
  }
}
