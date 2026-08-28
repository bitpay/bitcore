import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { EveryUtxoType, TransactionType, UtxoType } from 'src/types/txTypes.js';

class UtilClass {
  /**
  * Standardize utxo for internal funcionality.
  * Accepts either a bitcore-node or a lib (bitcore-lib, bitcore-lib-cash, etc.) utxo.
  * Handles both lib style utxos: UnspentOutput properties and UnspentOutput.toObject properties.
  *
  * @param utxos either a bitcore-node or lib utxo
  * @returns utxo in the standard, internaly used format
  */
  standardizeUtxo(utxo: EveryUtxoType): UtxoType {
    return {
      satoshis: Number(utxo.satoshis ?? utxo.value ?? BitcoreLib.Unit.fromBTC(utxo.amount ?? 0).toSatoshis()),
      txId: utxo.txId ?? utxo.mintTxid ?? utxo.txid ?? '',
      outputIndex: Number(utxo.outputIndex ?? utxo.mintIndex ?? utxo.vout ?? 0),
      script: utxo.scriptPubKey ?? new BitcoreLib.Script(utxo.script).toHex(),
      address: utxo.address != undefined ? new BitcoreLib.Address(utxo.address).toString() : undefined
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
  buildTransaction(tx: TransactionType, utxos?: EveryUtxoType[]): BitcoreLib.Transaction {
    const bitcoreTx = tx instanceof BitcoreLib.Transaction ? tx : new BitcoreLib.Transaction(tx);
    if (utxos) {
      const btcUtxos = utxos.map(utxo => Util.standardizeUtxo(utxo));
      const applicableUtxos = Util.getRelatedUtxos({
        outputs: bitcoreTx.inputs,
        utxos: btcUtxos
      });
      bitcoreTx.associateInputs(applicableUtxos.map(utxo => new BitcoreLib.Transaction.UnspentOutput(utxo)));
    }
    return bitcoreTx;
  }
}

const Util = new UtilClass();
export default Util;
