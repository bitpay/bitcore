import { BitcoreLib, BitcoreLibCash, BitcoreLibDoge, BitcoreLibLtc } from '@bitpay-labs/crypto-wallet-core';
import { EveryUtxoType, TransactionType, UtxoType } from 'src/types/txTypes.js';
import { UtxoChain } from './types/chains.js';

class UtilClass {
  libs: Record<UtxoChain, BitcoreLib> = {
    BTC: BitcoreLib,
    BCH: BitcoreLibCash,
    DOGE: BitcoreLibDoge,
    LTC: BitcoreLibLtc
  } as const;
  /**
  * Standardize utxo for internal funcionality.
  * Accepts either a bitcore-node or a lib (bitcore-lib, bitcore-lib-cash, etc.) utxo.
  * Handles both lib style utxos: UnspentOutput properties and UnspentOutput.toObject properties.
  *
  * @param utxos either a bitcore-node or lib utxo
  * @returns utxo in the standard, internaly used format
  */
  standardizeUtxo(utxo: EveryUtxoType, chain: UtxoChain = 'BTC'): UtxoType {
    const lib = this.libs[chain];
    return {
      satoshis: Number(utxo.satoshis ?? utxo.value ?? lib.Unit.fromBTC(utxo.amount ?? 0).toSatoshis()),
      txId: utxo.txId ?? utxo.mintTxid ?? utxo.txid ?? '',
      outputIndex: Number(utxo.outputIndex ?? utxo.mintIndex ?? utxo.vout ?? 0),
      script: utxo.scriptPubKey ?? new lib.Script(utxo.script).toHex(),
      address: utxo.address != undefined ? new lib.Address(utxo.address).toString() : undefined
    };
  }
  
  getRelatedUtxos(params: {
    outputs: BitcoreLib.Transaction.Input[];
    utxos: UtxoType[];
  }): UtxoType[] {
    const { outputs, utxos } = params;
    const txids = outputs.map(output => output.toObject().prevTxId);
    return utxos.filter(utxo => txids.includes(utxo.txId));
  }

  /**
   * Convert some kind of transaction and utxo data into a bitcore-lib transaction
   * 
   * @param tx transaction data, string or some object
   * @param utxos utxo data
   * @returns bitcore-lib transaction
   */
  buildTransaction(tx: TransactionType, utxos?: EveryUtxoType[], chain: UtxoChain = 'BTC'): BitcoreLib.Transaction {
    const lib = this.libs[chain];
    const bitcoreTx = tx instanceof lib.Transaction ? tx : new lib.Transaction(tx);
    if (utxos) {
      const btcUtxos = utxos.map(utxo => Util.standardizeUtxo(utxo, chain));
      const applicableUtxos = Util.getRelatedUtxos({
        outputs: bitcoreTx.inputs,
        utxos: btcUtxos
      });
      bitcoreTx.associateInputs(applicableUtxos.map(utxo => new lib.Transaction.UnspentOutput(utxo)));
    }
    return bitcoreTx;
  }
}

const Util = new UtilClass();
export default Util;
