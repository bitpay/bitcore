import BitcoreLibDoge from '@bitpay-labs/bitcore-lib-doge';
import { BTCTxProvider } from '../btc';

export class DOGETxProvider extends BTCTxProvider {
  lib = BitcoreLibDoge;
  create({ recipients, utxos = [], change, feeRate, fee = 20000 }) {
    const filteredUtxos = this.selectCoins(recipients, utxos, fee);
    const btcUtxos = filteredUtxos.map(this.standardizeUtxo);
    const tx = new this.lib.Transaction().from(btcUtxos);
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
