const bitcoreLib = require('bitcore-lib');

class BTCTxProvder {
  create({ addresses, amount, utxos, change, fee }) {
    let tx = new bitcoreLib.Transaction()
      .from(utxos)
      .to(addresses, Number(amount))
      .fee(Number(fee))
      .change(change);
    return tx;
  }

  sign({ tx, keys, utxos }) {
    let bitcoreTx = new bitcoreLib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });

    let newTx = new bitcoreLib.Transaction()
      .from(applicableUtxos)
      .to(this.getOutputsFromTx({ tx: bitcoreTx }));
    return newTx.sign(keys.toString('hex'));
  }

  getRelatedUtxos({ outputs, utxos }) {
    let txids = outputs.map(output => output.toObject().prevTxId);
    let applicableUtxos = utxos.filter(utxo => txids.includes(utxo.txid));
    return applicableUtxos;
  }

  getOutputsFromTx({ tx }) {
    return tx.outputs.map(({ script, satoshis }) => {
      let address = script;
      return { address, satoshis };
    });
  }

  getSigningAddresses({ tx, utxos }) {
    let bitcoreTx = new bitcoreLib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    return applicableUtxos.map(utxo => utxo.address);
  }
}
module.exports = new BTCTxProvder();
