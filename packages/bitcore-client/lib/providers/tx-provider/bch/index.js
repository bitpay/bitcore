const bitcoreLib = require('bitcore-lib-cash');

class BCHTxProvder {
  create({ recipients, utxos, change, fee }) {
    let tx = new bitcoreLib.Transaction()
      .from(utxos)
      .fee(Number(fee));
    for (const recipient of recipients) {
      tx.to(recipient.address, recipient.amount);
    }
    if (change) {
      tx.change(change);
    }
    return tx;
  }
}
module.exports = new BCHTxProvder();
