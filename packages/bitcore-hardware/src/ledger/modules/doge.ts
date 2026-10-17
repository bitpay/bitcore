import { BitcoinCashModule } from './index.js';
import type { AddressFormat } from '@ledgerhq/hw-app-btc/getWalletPublicKey';
import type * as HwTransport from '@ledgerhq/hw-transport';

export default class DogeModule extends BitcoinCashModule {
  derivationPath = "44'/3'/0'";
  addressFormat: AddressFormat = 'legacy';
  
  constructor(transport: HwTransport.default) {
    super(transport, 'DOGE');
  }
}
