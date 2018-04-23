const bitcoreLib = require('bitcore-lib');

class BTCTxProvder {
  create({addresses, amount, utxos, change}) {
    let tx = new bitcoreLib.Transaction()
      .from(utxos)
      .to(addresses, Number(amount))
      .change(change);
    return tx;
  }
}
module.exports = new BTCTxProvder();
