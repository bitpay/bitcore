import { BTCTxProvider } from '../btc';

export class LTCTxProvider extends BTCTxProvider {
  lib = require('bitcore-lib-ltc');
  create({ recipients, utxos = [], change, wallet, feeRate, fee = 20000 }) {
    change = change || wallet.deriveAddress(wallet.addressIndex, true);
    const filteredUtxos = this.selectCoins(recipients, utxos, fee);
    const btcUtxos = filteredUtxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / 1e8,
        txid: utxo.mintTxid,
        outputIndex: utxo.mintIndex
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
    let tx = new this.lib.Transaction().from(btcUtxos);
    if (fee) {
      tx.fee(fee);
    }
    if (feeRate) {
      tx.feePerKb(Number(feeRate) * 1000); // feeRate is in feePerByte
    }
    if (change) {
      tx.change(change);
    }
    for (const recipient of recipients) {
      tx.to(recipient.address, parseInt(recipient.amount));
    }
    return tx.uncheckedSerialize();
  }
}
