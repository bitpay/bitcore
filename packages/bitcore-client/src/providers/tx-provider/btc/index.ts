export class BTCTxProvider {
  lib = require('bitcore-lib');

  create({ recipients, utxos, change, fee = 4566}) {
    const btcUtxos = utxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / Math.pow(10, 8)
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
    let tx = new this.lib.Transaction().from(btcUtxos).fee(Number(fee));
    if (change) {
      console.log('adding change address', change);
      tx.change(change);
    }
    for (const recipient of recipients) {
      tx.to(recipient.address, recipient.amount * 10e7);
    }
    console.log(tx);
    return tx.uncheckedSerialize();
  }

  sign({ tx, keys, utxos }) {
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    const outputs = this.getOutputsFromTx({ tx: bitcoreTx });
    let newTx = new this.lib.Transaction().from(applicableUtxos).to(outputs);
    const privKeys = keys.map(key => key.privKey.toString('hex'));
    return newTx.sign(privKeys).toString();
  }

  getRelatedUtxos({ outputs, utxos }) {
    let txids = outputs.map(output => output.toObject().prevTxId);
    let applicableUtxos = utxos.filter(utxo => txids.includes(utxo.txid));
    return applicableUtxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / Math.pow(10, 8)
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
  }

  getOutputsFromTx({ tx }) {
    return tx.outputs.map(({ script, satoshis }) => {
      let address = script;
      return { address, satoshis };
    });
  }

  getSigningAddresses({ tx, utxos }) {
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    return applicableUtxos.map(utxo => utxo.address);
  }
}
