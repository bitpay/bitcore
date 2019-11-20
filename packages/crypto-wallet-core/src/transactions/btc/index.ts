import * as _ from 'lodash';
import { Key } from '../../derivation';

export class BTCTxProvider {
  lib = require('bitcore-lib');

  selectCoins(
    recipients: Array<{ amount: number }>,
    utxos: Array<{ value: number; utxo: { mintHeight: number } }>,
    fee: number
  ) {
    utxos = utxos.sort(function(a, b) {
      return a.utxo.mintHeight - b.utxo.mintHeight;
    });

    let index = 0;
    let utxoSum = 0;
    let recepientSum = recipients.reduce(
      (sum, cur) => sum + Number(cur.amount),
      fee
    );
    while (utxoSum < recepientSum) {
      const utxo = utxos[index];
      utxoSum += Number(utxo.value);
      index += 1;
    }
    const filteredUtxos = utxos.slice(0, index);
    return filteredUtxos;
  }

  create({ recipients, utxos = [], change, wallet, fee = 20000 }) {
    change = change || (wallet.deriveAddress(wallet.addressIndex, true));

    const filteredUtxos = this.selectCoins(recipients, utxos, fee);
    const btcUtxos = filteredUtxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / 1e8
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
    let tx = new this.lib.Transaction().from(btcUtxos).fee(Number(fee));
    if (change) {
      tx.change(change);
    }
    for (const recipient of recipients) {
      tx.to(recipient.address, recipient.amount);
    }
    return tx.uncheckedSerialize();
  }

  getSignature(params: { tx: string; keys: Array<Key>}) {
    throw new Error('No implemented for UTXO coins');
  }

  applySignature(params: { tx: string; keys: Array<Key>}) {
    throw new Error('No implemented for UTXO coins');
  }

  getHash(params: { tx: string}) {
    throw new Error('No implemented for UTXO coins');
  }

  sign(params: { tx: string; keys: Array<Key>; utxos: any[] }) {
    const { tx, keys } = params;
    let utxos = params.utxos || [];
    let inputAddresses = this.getSigningAddresses({ tx, utxos });
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    const outputs = this.getOutputsFromTx({ tx: bitcoreTx });
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
