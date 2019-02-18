import { Wallet } from '../../../';
import * as _ from 'lodash';

export class BTCTxProvider {
  lib = require('bitcore-lib');

  create({ recipients, utxos, change, fee = 20000 }) {
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
    return tx.uncheckedSerialize();
  }

  async sign(params: { tx: string; wallet: Wallet; utxos: any[] }) {
    const { tx, wallet, utxos } = params;
    const { encryptionKey } = wallet.unlocked;
    let inputAddresses = await this.getSigningAddresses({ tx, utxos });
    let keyPromises = inputAddresses.map(address => {
      return wallet.storage.getKey({
        address,
        encryptionKey,
        name: wallet.name
      });
    });

    let keys = await Promise.all(keyPromises);
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = await this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    const outputs = await this.getOutputsFromTx({ tx: bitcoreTx });
    let newTx = new this.lib.Transaction().from(applicableUtxos).to(outputs);
    const privKeys = _.uniq(keys.map(key => key.privKey.toString()));
    const signedTx = newTx.sign(privKeys).toString();
    return signedTx;
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

  getSigningAddresses({ tx, utxos }): string[] {
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    return applicableUtxos.map(utxo => utxo.address);
  }
}
