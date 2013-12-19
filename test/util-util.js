var assert = require('assert');
var coinUtil = require('../util/util');

describe('util/util', function(){
  describe('#parseValue', function(){
    it('should convert floating points to satoshis correctly', function(){
      function test_value(datum) {
        var decimal = datum[0];
        var intStr = datum[1];
        var bn = coinUtil.parseValue(decimal);
        assert.notEqual(bn, undefined);
        assert.equal(bn.toString(), intStr);
      }
      var dataValues=[
        [ "0", "0" ],
        [ "1.0", "100000000" ],
        [ "0.1", "10000000" ],
        [ ".1", "10000000" ],
        [ "0.0005", "50000" ],
        [ ".000000001", "0" ],
        [ ".000000009", "0" ],
        [ ".00000000000000001", "0" ]
      ];
      dataValues.forEach(function(datum) { test_value(datum); });
    });
  });
});
