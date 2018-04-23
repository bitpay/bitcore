const bitcoreLib = require('bitcore-lib');

class BTCTxProvder {
  create({addresses, amount, utxos, change}) {
    console.log(addresses, amount);
    let tx = new bitcoreLib.Transaction()
      .from(utxos)
      .to(addresses, Number(amount))
      .change(change);
    return tx;
  }
}
module.exports = new BTCTxProvder();
