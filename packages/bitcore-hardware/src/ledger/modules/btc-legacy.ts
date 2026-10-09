import { createRequire } from 'module';
import { BaseModule } from 'src/types/base.js';
import { UtxoChainType } from 'src/types/chains.js';
import type BTC from '@ledgerhq/hw-app-btc';
import type * as HwTransport from '@ledgerhq/hw-transport';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const Btc = require('@ledgerhq/hw-app-btc').default;

/**
 * The DMK does not support non bitcoin utxo chains until 2027.
 * For now, non bitcoin utxo chains will extend this implentation instead.
 */
export default class BitcoinLegacyModule implements BaseModule {
  btc: BTC.default;
  chain: UtxoChainType = 'BTC';
  derivationPath = "84'/0'/0'";
  
  constructor(transport: HwTransport.default) {
    const TICKER_TO_NAMES = new Map([
      ['DOGE', 'dogecoin'],
      ['BCH', 'bitcoin-cash'],
      ['LTC', 'litecoin'],
      ['BTC', 'bitcoin'],
    ]);
    const currency = TICKER_TO_NAMES.get(this.chain) || 'bitcoin';
    this.btc = new Btc({ transport, currency });
  }

  async getPublicKey() {
    const result = await this.btc.getWalletPublicKey(this.derivationPath);
    return result.publicKey;
  }

  async sign() {
    return '';
  }

  async getAddress() {
    return '';
  }
}
