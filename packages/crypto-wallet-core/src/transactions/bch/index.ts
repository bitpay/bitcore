import BitcoreLibCash from '@bitpay-labs/bitcore-lib-cash';
import { BTCTxProvider, EveryUtxoType } from '../btc';

export class BCHTxProvider extends BTCTxProvider {
  lib = BitcoreLibCash;
  create(params: BchCreateParams): string {
    const { recipients, utxos = [], change, fee = 20000, isSweep } = params;
    const filteredUtxos = isSweep ? utxos : this.selectCoins(recipients, utxos, Number(fee));
    const btcUtxos = filteredUtxos.map(utxo => this.standardizeUtxo(utxo));
    const tx = new this.lib.Transaction().from(btcUtxos).feePerByte(Number(fee) + 2);
    if (change) {
      tx.change(change);
    }
    for (const recipient of recipients) {
      tx.to(recipient.address, Number(recipient.amount));
    }
    return tx.uncheckedSerialize();
  }
}

export interface BchCreateParams {
  recipients: Array<{ address: string; amount: number }>;
  utxos?: EveryUtxoType[];
  change?: string;
  fee?: number | string;
  isSweep?: boolean;
};
