import _ from 'lodash';
const Bitcore_ = {
  btc: require('@bcpros/bitcore-lib'),
  xec: require('@bcpros/bitcore-lib-xec')
};

export class XECAddressTranslator {
  static getAddressCoin(address) {
    try {
      new Bitcore_['btc'].Address(address);
      return 'legacy';
    } catch (e) {
      try {
        const a = new Bitcore_['xec'].Address(address);
        return 'cashaddr';
      } catch (e) {
        return;
      }
    }
  }

  // Supports 3 formats:  legacy (1xxx, mxxxx); Copay: (Cxxx, Hxxx), Cashaddr(qxxx);
  static translate(addresses, to, from?) {
    let wasArray = true;

    if (!_.isArray(addresses)) {
      wasArray = false;
      addresses = [addresses];
    }
    from = from || XECAddressTranslator.getAddressCoin(addresses[0]);

    let ret;
    if (from == to) {
      ret = addresses;
    } else {
      ret = _.filter(
        _.map(addresses, x => {
          const bitcore = Bitcore_[from == 'legacy' ? 'btc' : 'xec'];
          let orig;

          try {
            orig = new bitcore.Address(x).toObject();
          } catch (e) {
            return null;
          }

          if (to == 'cashaddr') {
            return Bitcore_['xec'].Address.fromObject(orig).toCashAddress(true);
          } else if (to == 'legacy') {
            return Bitcore_['btc'].Address.fromObject(orig).toString();
          }
        })
      );
    }
    if (wasArray) return ret;
    else return ret[0];
  }
}

module.exports = XECAddressTranslator;
