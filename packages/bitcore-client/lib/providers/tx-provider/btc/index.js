const bitcoreLib = require('bitcore-lib');

export default class BTCTxProvder {
  create({addresses, amount, utxos, change}) {
    let tx = new bitcoreLib.Transaction()
      .from(utxos)
      .to(addresses, amounts)
      .change(change);
    return tx;
  }
}
