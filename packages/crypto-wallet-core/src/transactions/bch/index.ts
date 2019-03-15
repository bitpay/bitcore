export class BCHTxProvider {
  lib = require('bitcore-lib-cash');
  create({ recipients, utxos, change, fee }) {
    let tx = new this.lib.Transaction().from(utxos).fee(Number(fee));
    for (const recipient of recipients) {
      tx.to(recipient.address, recipient.amount);
    }
    if (change) {
      tx.change(change);
    }
    return tx;
  }
}
