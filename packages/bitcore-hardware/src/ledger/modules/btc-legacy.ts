import { createRequire } from 'module';
import { Psbt, networks } from 'bitcoinjs-lib';
import { BaseModule } from 'src/types/base.js';
import { UtxoChainType } from 'src/types/chains.js';
import { EveryUtxoType, TransactionType } from '../../types/txTypes.js';
import Util from '../../util.js';
import type { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import type BTC from '@ledgerhq/hw-app-btc';
import type { AddressFormat } from '@ledgerhq/hw-app-btc/getWalletPublicKey';
import type * as HwTransport from '@ledgerhq/hw-transport';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const Btc: typeof BTC.default = require('@ledgerhq/hw-app-btc').default;

/**
 * The DMK does not support non bitcoin utxo chains until 2027.
 * For now, non bitcoin utxo chains will extend this implentation instead.
 */
export default class BitcoinLegacyModule implements BaseModule {
  btc: BTC.default;
  chain: UtxoChainType = 'BTC';
  derivationPath = "84'/0'/0'";
  addressFormat: AddressFormat = 'bech32';
  lib: BitcoreLib;
  
  constructor(transport: HwTransport.default) {
    this.lib = Util.libs[this.chain];
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

  async sign(params: { tx: string; utxos: EveryUtxoType[] })
  async sign(params: { tx: TransactionType; utxos?: EveryUtxoType[] }) {
    const { tx, utxos } = params;
    const bitcoreTx = Util.buildTransaction(tx, utxos, this.chain);

    const psbt = new Psbt({ network: networks.bitcoin });
    const xpub = this.lib.HDPublicKey(
      await this.btc.getWalletXpub({ path: this.derivationPath, xpubVersion: 0x0488b21e })
    );
    
    const map = new Map();
    const pubkey = xpub.deriveChild(0).deriveChild(0).publicKey.toBuffer();
    const key = this.lib.crypto.Hash.sha256ripemd160(pubkey).toString('hex');
    map.set(key,
      {
        pubkey,
        path: `${this.derivationPath}/${0}/${0}`
          .split('/')
          // eslint-disable-next-line no-bitwise
          .map((p) => (p.endsWith("'") ? (parseInt(p, 10) + 0x80000000) >>> 0 : parseInt(p, 10)))
      });
    
    for (const input of bitcoreTx.inputs) {
      psbt.addInput({
        hash: input.prevTxId,
        index: input.outputIndex,
        sequence: input.sequenceNumber,
        witnessUtxo: {
          script: input.output.script.toBuffer(),
          value: input.output.satoshis,
        },
      });
    }

    for (const output of bitcoreTx.outputs) {
      psbt.addOutput({
        script: output.script.toBuffer(),
        value: output.satoshis,
      });
    }
    
    const result = await this.btc.signPsbtBuffer(psbt.toBuffer(), {
      finalizePsbt: true,
      accountPath: this.derivationPath,
      addressFormat: this.addressFormat,
      knownAddressDerivations: map,
    });
    return result.tx;
  }

  async getAddress() {
    const result = await this.btc.getWalletPublicKey(this.derivationPath + '/0/0', { format: this.addressFormat });
    return result.bitcoinAddress;
  }
}
