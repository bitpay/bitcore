'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();

var Utils = {};

var _SEPARATORS = {
  en: {
    thousands: ',',
    decimal: '.'
  },
  es: {
    thousands: '.',
    decimal: ','
  },
};
var _UNITS = {
  btc: {
    toSatoshis: 100000000,
    decimals: 6
  },
  bit: {
    toSatoshis: 100,
    decimals: 0
  },
};

Utils.formatAmount = function(satoshis, unit, locale) {
  $.shouldBeNumber(satoshis);
  $.checkArgument(_.contains(_.keys(_UNITS), unit));
  $.checkArgument(_.contains(_.keys(_SEPARATORS), locale));

  function addSeparators(nStr, thousands, decimal) {
    nStr = nStr.replace('.', decimal);
    var x = nStr.split(decimal);
    var x1 = x[0];
    var x2 = x.length > 1 ? decimal + x[1] : '';
    x1 = x1.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    return x1 + x2;
  }

  var u = _UNITS[unit];
  var l = _SEPARATORS[locale];
  var amount = (satoshis / u.toSatoshis).toFixed(u.decimals);
  return addSeparators(amount, l.thousands, l.decimal);
};

module.exports = Utils;
