import BitcoreLibCash from 'bitcore-lib-cash';
import { BTCTxProvider } from '../btc';

export class BCHTxProvider extends BTCTxProvider {
  lib = BitcoreLibCash;
  create({ recipients, utxos = [], change, fee = 20000, isSweep }) {
    const filteredUtxos = isSweep ? utxos : this.selectCoins(recipients, utxos, fee);
    const btcUtxos = filteredUtxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / 1e8,
        txid: utxo.mintTxid,
        outputIndex: utxo.mintIndex
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
    const tx = new this.lib.Transaction().from(btcUtxos).feePerByte(Number(fee) + 2);
    if (change) {
      tx.change(change);
    }
    for (const recipient of recipients) {
      tx.to(recipient.address, parseInt(recipient.amount));
    }
    return tx.uncheckedSerialize();
  }
}
