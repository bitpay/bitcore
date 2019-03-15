import { Wallet, ParseApiStream } from '../../../';
import * as _ from 'lodash';

export class BTCTxProvider {
  lib = require('bitcore-lib');

  async getUtxos(wallet: Wallet) {
    const utxos = [];
    await new Promise(resolve =>
      wallet
        .getUtxos()
        .pipe(new ParseApiStream())
        .on('data', utxo =>
          utxos.push({
            value: utxo.value,
            txid: utxo.mintTxid,
            vout: utxo.mintIndex,
            address: utxo.address,
            script: utxo.script,
            utxo
          })
        )
        .on('finish', resolve)
    );
    return utxos;
  }

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

  async create({ recipients, utxos = [], change, wallet, fee = 20000 }) {
    change = change || (await wallet.deriveAddress(wallet.addressIndex, true));
    if (!utxos.length) {
      utxos = await this.getUtxos(wallet);
    }

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

  async sign(params: { tx: string; wallet: Wallet; utxos: any[] }) {
    const { tx, wallet } = params;
    const { encryptionKey } = wallet.unlocked;
    let utxos = params.utxos || [];
    if (!utxos.length) {
      utxos = await this.getUtxos(wallet);
    }

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
