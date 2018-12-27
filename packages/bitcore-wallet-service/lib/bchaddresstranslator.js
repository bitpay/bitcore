var Bitcore_ = {
  btc: require('bitcore-lib'),
  bch: require('bitcore-lib-cash')
};

var _ = require('lodash');

function BCHAddressTranslator() {
};


BCHAddressTranslator.getAddressCoin = function(address) {
  try {
    new Bitcore_['btc'].Address(address);
    return 'legacy';
  } catch (e) {
    try {
      var a= new Bitcore_['bch'].Address(address);
      if (a.toLegacyAddress() == address) return 'copay';
      return 'cashaddr';
    } catch (e) {
      return;
    }
  }
};


// Supports 3 formats:  legacy (1xxx, mxxxx); Copay: (Cxxx, Hxxx), Cashaddr(qxxx);
BCHAddressTranslator.translate = function(addresses, to, from) {
  var wasArray = true;
  if (!_.isArray(addresses)) {
    wasArray = false;
    addresses = [addresses];
  }
  from = from || BCHAddressTranslator.getAddressCoin(addresses[0]);

  var ret;
  if (from == to) {
    ret = addresses;
  } else {
    ret =  _.map(addresses, function(x) {
      var bitcore = Bitcore_[from == 'legacy' ? 'btc' : 'bch'];
      var orig = new bitcore.Address(x).toObject();

      if (to == 'cashaddr') {
        return Bitcore_['bch'].Address.fromObject(orig).toCashAddress(true);
      } else if (to == 'copay') {
        return Bitcore_['bch'].Address.fromObject(orig).toLegacyAddress();
      } else if (to == 'legacy') {
        return Bitcore_['btc'].Address.fromObject(orig).toString();
      }
    });
  }
  if (wasArray) 
    return ret;
  else 
    return ret[0];

};


module.exports = BCHAddressTranslator;
