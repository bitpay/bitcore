import BitcoreLibDoge from '@bitpay-labs/bitcore-lib-doge';
import { BTCTxProvider, EveryUtxoType } from '../btc';

export class DOGETxProvider extends BTCTxProvider {
  lib = BitcoreLibDoge;
  create(params: {
    recipients: Array<{ address: string; amount: number }>;
    utxos?: EveryUtxoType[];
    change?: string;
    feeRate?: number | string;
    fee?: number | string;
  }): string {
    const { recipients, utxos = [], change, feeRate, fee = 20000 } = params;
    const filteredUtxos = this.selectCoins(recipients, utxos, Number(fee));
    const btcUtxos = filteredUtxos.map(utxo => this.standardizeUtxo(utxo));
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
      tx.to(recipient.address, Number(recipient.amount));
    }
    return tx.uncheckedSerialize();
  }
}
