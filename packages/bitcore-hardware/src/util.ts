import { BitcoreLib, BitcoreLibCash, BitcoreLibDoge, BitcoreLibLtc } from '@bitpay-labs/crypto-wallet-core';
import CWC from '@bitpay-labs/crypto-wallet-core';
import {
  Observable,
  lastValueFrom
} from 'rxjs';
import { EveryUtxoType, TransactionType } from 'src/types/tx.js';
import { UtxoChainType } from './types/chains.js';

class UtilClass {
  libs: Record<UtxoChainType, BitcoreLib> = {
    BTC: BitcoreLib,
    BCH: BitcoreLibCash,
    DOGE: BitcoreLibDoge,
    LTC: BitcoreLibLtc
  } as const;

  /**
   * Convert some kind of transaction and utxo data into a bitcore-lib transaction
   * 
   * @param tx transaction data, string or some object
   * @param utxos utxo data
   * @returns bitcore-lib transaction
   */
  buildTransaction(tx: TransactionType, utxos?: EveryUtxoType[], chain: UtxoChainType = 'BTC'): BitcoreLib.Transaction {
    const lib = this.libs[chain];
    const bitcoreTx = tx instanceof lib.Transaction ? tx : new lib.Transaction(tx);
    if (utxos) {
      const btcUtxos = utxos.map(utxo => CWC.Transactions.get({ chain }).standardizeUtxo(utxo, chain));
      const applicableUtxos = CWC.Transactions.get({ chain }).getRelatedUtxos({
        outputs: bitcoreTx.inputs,
        utxos: btcUtxos
      });
      bitcoreTx.associateInputs(applicableUtxos.map(utxo => new lib.Transaction.UnspentOutput(utxo)));
    }
    return bitcoreTx;
  }

  /**
   * Get the data of an observable or throw error
   * @param observable The observable to get the data from
   * @returns Promise containing the data
   * @throws Error if the result status is 'error'
   */
  async getObservableOutputOrError(observable: Observable<any>): Promise<any> {
    const result = await lastValueFrom(observable);
    if (result.status === 'error') {
      const e = result.error;
      const code = e?.errorCode ?? e?._tag;
      throw new Error(`${e?.message ?? 'unknown error'}${code ? ` (${code})` : ''}`, { cause: e });
    }
    return result.output;
  }
}

const Util = new UtilClass();
export default Util;
