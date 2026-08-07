import BitcoreLibCash from '@bitpay-labs/bitcore-lib-cash';
import { BTCTxProvider } from '../btc';

export class BCHTxProvider extends BTCTxProvider {
  lib = BitcoreLibCash;
  create({ recipients, utxos = [], change, fee = 20000, isSweep }) {
    const filteredUtxos = isSweep ? utxos : this.selectCoins(recipients, utxos, fee);
    const btcUtxos = filteredUtxos.map(this.standardizeUtxo);
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
