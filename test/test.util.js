var chai = require('chai');
var bitcore = require('../bitcore');
var coinUtil = bitcore.util;
var should = chai.should();
var buffertools = require('buffertools');

describe('util', function() {
  describe('#parseValue', function() {
    it('should convert floating points to satoshis correctly', function() {
      function test_value(datum) {
        var decimal = datum[0];
        var intStr = datum[1];
        var bn = coinUtil.parseValue(decimal);
        should.exist(bn);
        bn.toString().should.equal(intStr);
      }
      var dataValues = [
        ["0", "0"],
        ["1.0", "100000000"],
        ["0.1", "10000000"],
        [".1", "10000000"],
        ["0.0005", "50000"],
        [".000000001", "0"],
        [".000000009", "0"],
        [".00000000000000001", "0"]
      ];
      dataValues.forEach(function(datum) {
        test_value(datum);
      });
    });
  });
  describe('#ripemd160', function() {
    var ripemdData = [
      ['somemessage123', '12fd01a7ec6b9ba23b3a5c16fbfab3ac19624a88'],
      ['', '9c1185a5c5e9fc54612808977ee8f548b2258d31'],
      ['0000', 'ab20e58c9eeb4776e719deff3158e26ca9edb636']
    ];
    ripemdData.forEach(function(datum) {
      it('should work for ' + datum[0], function() {
        var r = coinUtil.ripe160(datum[0]);
        buffertools.toHex(r).should.equal(datum[1]);
      });
      it('should work for Buffer ' + datum[0], function() {
        var r = coinUtil.ripe160(new Buffer(datum[0]));
        buffertools.toHex(r).should.equal(datum[1]);
      });
    });
  });
  describe('#intToBuffer', function() {
    var data = [
      [0, '00000000'],
      [-0, '00000000'],
      [-1, 'ffffffff'],
      [1, '01000000'],
      [18, '12000000'],
      [878082192, '90785634'],
      [0x01234567890, '1200000090785634'],
      [-4294967297, 'feffffffffffffff'],
    ];
    data.forEach(function(datum) {
      var integer = datum[0];
      var result = datum[1];
      it('should work for ' + integer, function() {
        buffertools.toHex(coinUtil.intToBuffer(integer)).should.equal(result);
      });
    });
  });
});
