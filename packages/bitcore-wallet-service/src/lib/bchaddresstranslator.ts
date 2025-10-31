import { BitcoreLib, BitcoreLibCash } from 'crypto-wallet-core';

const Bitcore_ = {
  btc: BitcoreLib,
  bch: BitcoreLibCash
};

export class BCHAddressTranslator {
  static getAddressCoin(address) {
    try {
      new Bitcore_['btc'].Address(address);
      return 'legacy';
    } catch {
      try {
        const a = new Bitcore_['bch'].Address(address);
        if (a.toLegacyAddress() == address) return 'copay';
        return 'cashaddr';
      } catch {
        return;
      }
    }
  }

  // Supports 3 formats:  legacy (1xxx, mxxxx); Copay: (Cxxx, Hxxx), Cashaddr(qxxx);
  static translate(addresses, to, from?) {
    let wasArray = true;
    if (!Array.isArray(addresses)) {
      wasArray = false;
      addresses = [addresses];
    }
    from = from || BCHAddressTranslator.getAddressCoin(addresses[0]);

    let ret;
    if (from == to) {
      ret = addresses;
    } else {
      ret = addresses.map(x => {
        const bitcore = Bitcore_[from == 'legacy' ? 'btc' : 'bch'];
        let orig;

        try {
          orig = new bitcore.Address(x).toObject();
        } catch {
          return null;
        }

        if (to == 'cashaddr') {
          return Bitcore_['bch'].Address.fromObject(orig).toCashAddress(true);
        } else if (to == 'copay') {
          return Bitcore_['bch'].Address.fromObject(orig).toLegacyAddress();
        } else if (to == 'legacy') {
          return Bitcore_['btc'].Address.fromObject(orig).toString();
        }
      }).filter(x => !!x);
    }
    if (wasArray) return ret;
    else return ret[0];
  }
}
