import _ from 'lodash';
const Bitcore_ = {
  btc: require('@bcpros/bitcore-lib'),
  bch: require('@bcpros/bitcore-lib-cash'),
  xec: require('@bcpros/bitcore-lib-xec'),
  xpi: require('@bcpros/bitcore-lib-xpi')
};

export class XPIAddressTranslator {
  static getAddressCoin(address) {
    try {
      new Bitcore_['btc'].Address(address);
      return 'legacy';
    } catch (e) {
      try {
        const a = new Bitcore_['bch'].Address(address);
        if (a.toLegacyAddress() == address) return 'copay';
        return 'cashaddr';
      } catch (e) {
        try {
          const a = new Bitcore_['xpi'].Address(address);
          return 'xaddr';
        } catch (e) {
          return;
        }
      }
    }
  }

  // Supports 3 formats:  legacy (1xxx, mxxxx); Cashaddr(qxxx); Lotus(lotus_xxx)
  static translate(addresses, to, from?) {
    let wasArray = true;

    if (!_.isArray(addresses)) {
      wasArray = false;
      addresses = [addresses];
    }
    from = from || XPIAddressTranslator.getAddressCoin(addresses[0]);

    let ret;
    if (from == to) {
      ret = addresses;
    } else {
      ret = _.filter(
        _.map(addresses, x => {
          let bitcore;
          if (from == 'xaddr') {
            bitcore = Bitcore_['xpi'];
          } else {
            bitcore = Bitcore_[from == 'legacy' ? 'btc' : 'bch'];
          }
          let orig;
          try {
            orig = new bitcore.Address(x).toObject();
          } catch (e) {
            return null;
          }

          if (to == 'cashaddr') {
            return Bitcore_['bch'].Address.fromObject(orig).toCashAddress(true);
          } else if (to == 'copay') {
            return Bitcore_['bch'].Address.fromObject(orig).toLegacyAddress();
          } else if (to == 'legacy') {
            return Bitcore_['btc'].Address.fromObject(orig).toString();
          } else if (to == 'xaddr') {
            return Bitcore_['xpi'].Address.fromObject(orig).toXAddress();
          }
        })
      );
    }
    if (wasArray) return ret;
    else return ret[0];
  }
}

module.exports = XPIAddressTranslator;
