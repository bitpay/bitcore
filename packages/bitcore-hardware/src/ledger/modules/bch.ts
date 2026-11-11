import { createRequire } from 'module';
import { UtxoChainType } from 'src/types/chains.js';
import { Module } from 'src/types/modules.js';
import { TransactionType } from '../../types/tx.js';
import Util from '../../util.js';
import type { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import type { EveryUtxoType } from '@bitpay-labs/crypto-wallet-core/ts_build/src/transactions/btc/index.js';
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
export default class BitcoinCashModule implements Module {
  btc: BTC.default;
  chain: UtxoChainType;
  derivationPath = "44'/145'/0'";
  addressFormat: AddressFormat;
  lib: BitcoreLib;
  
  constructor(transport: HwTransport.default, chain: UtxoChainType = 'BCH') {
    this.chain = chain;
    this.lib = Util.libs[this.chain];
    const TICKER_TO_NAMES = new Map([
      ['DOGE', 'dogecoin'],
      ['BCH', 'bitcoin-cash'],
      ['LTC', 'litecoin'],
      ['BTC', 'bitcoin'],
    ]);
    const currency = TICKER_TO_NAMES.get(this.chain) || 'bitcoin';
    this.btc = new Btc({ transport, currency });
    this.addressFormat = this.chain === 'BCH' ? 'cashaddr' : 'legacy';
  }

  /**
   * Sign a transaction spending from this module's first address (derivationPath/0/0).
   *
   * @param tx unsigned transaction
   * @param utxos utxos being spent
   * @param prevTxs raw hex of every transaction that created an input being spent.
   *   The legacy Ledger apps need the full previous transactions to verify input amounts.
   * @returns signed transaction hex
   */
  async sign(params: { tx: string; utxos: EveryUtxoType[]; prevTxs: string[] })
  async sign(params: {
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    prevTxs: string[];
  }) {
    const { tx, utxos, prevTxs } = params;
    const bitcoreTx = Util.buildTransaction(tx, utxos, this.chain);

    const isBch = this.chain === 'BCH';
    const additionals = isBch ? ['abc'] : [];
    const isSegwitSupported = this.chain === 'LTC';
    const { SIGHASH_ALL, SIGHASH_FORKID } = Util.libs.BCH.crypto.Signature;

    const prevTxsById = new Map<string, string>();
    for (const prevTx of prevTxs ?? []) {
      prevTxsById.set(new this.lib.Transaction(prevTx).id, prevTx);
    }

    const inputs = bitcoreTx.inputs.map(input => {
      const prevTxId = input.prevTxId.toString('hex');
      const prevTx = prevTxsById.get(prevTxId);
      if (!prevTx) {
        throw new Error(`Missing previous transaction ${prevTxId} required to sign input`);
      }
      return [
        this.btc.splitTransaction(prevTx, isSegwitSupported, false, additionals),
        input.outputIndex,
        null,
        input.sequenceNumber
      ] as [ReturnType<BTC.default['splitTransaction']>, number, null, number];
    });

    const unsignedTx = this.btc.splitTransaction(bitcoreTx.uncheckedSerialize(), false, false, additionals);
    const outputScriptHex = this.btc.serializeTransactionOutputs(unsignedTx).toString('hex');
    const keyPath = `${this.derivationPath}/0/0`;

    return this.btc.createPaymentTransaction({
      inputs,
      associatedKeysets: inputs.map(() => keyPath),
      outputScriptHex,
      lockTime: bitcoreTx.nLockTime,
      // eslint-disable-next-line no-bitwise
      sigHashType: isBch ? SIGHASH_ALL | SIGHASH_FORKID : SIGHASH_ALL,
      segwit: false,
      additionals
    });
  }

  async getAddress() {
    const { bitcoinAddress } = await this.btc.getWalletPublicKey(this.derivationPath + '/0/0', { format: this.addressFormat });
    return this.chain === 'BCH' ? 'bitcoincash:' + bitcoinAddress : bitcoinAddress;
  }
  
  async getPublicKey() {
    const { publicKey } = await this.btc.getWalletPublicKey(this.derivationPath + '/0/0');
    return this.lib.PublicKey.fromPoint(new this.lib.PublicKey(publicKey).point, true).toString();
  }
}
