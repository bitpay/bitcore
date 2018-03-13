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
      if (a.toString() == address) return 'copay';
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
  if (from == to) return addresses;
  var ret =  _.map(addresses, function(x) {

    var bitcore = Bitcore_[from == 'legacy' ? 'btc' : 'bch'];
    var orig = new bitcore.Address(x).toObject();

    if (to == 'cashaddr') {
      return Bitcore_['bch'].Address.fromObject(orig).toCashAddress(true);
    } else if (to == 'copay') {
      return Bitcore_['bch'].Address.fromObject(orig).toString();
    } else if (to == 'legacy') {
      return Bitcore_['btc'].Address.fromObject(orig).toString();
    }
  });

  if (wasArray) 
    return ret;
  else 
    return ret[0];

};


module.exports = BCHAddressTranslator;
