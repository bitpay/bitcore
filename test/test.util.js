'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = bitcore.util;
var should = chai.should();
var buffertools = require('buffertools');

describe('util', function() {
  describe('exist', function() {
    it('should initialze the util object', function() {
      should.exist(bitcore.util);
    });
  });
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
        ['0', '0'],
        ['1.0', '100000000'],
        ['0.1', '10000000'],
        ['.1', '10000000'],
        ['0.0005', '50000'],
        ['.000000001', '0'],
        ['.000000009', '0'],
        ['.00000000000000001', '0']
      ];
      dataValues.forEach(function(datum) {
        test_value(datum);
      });
    });
  });
  describe('#ripe160', function() {
    var pk = 'a5c756101065ac5b8f689139e6d856fa99e54b5000b6428b43729d334cc9277d';
    it('should work for ' + pk, function() {
      var pubKeyHash = coinUtil.ripe160(new Buffer(pk,'hex'));
      var pkh = buffertools.toHex(pubKeyHash);
      pkh.should.equal('d166a41f27fd4b158f70314e5eee8998bf3d97d5');
    });
  });
 

  describe('#sha256', function() {
    var pk = '03d95e184cce34c3cfa58e9a277a09a7c5ed1b2a8134ea1e52887bc66fa3f47071'
    it('should work for ' + pk, function() {
      var pubKeyHash = coinUtil.sha256(pk);
      var pkh = buffertools.toHex(pubKeyHash);
      pkh.should.equal('a5c756101065ac5b8f689139e6d856fa99e54b5000b6428b43729d334cc9277d');
    });
  });
 
  describe('#sha256ripe160', function() {
    var pk = '03d95e184cce34c3cfa58e9a277a09a7c5ed1b2a8134ea1e52887bc66fa3f47071'
    it('should work for ' + pk, function() {
      var pubKeyHash = coinUtil.sha256ripe160(pk);
      var pkh = buffertools.toHex(pubKeyHash);
      pkh.should.equal('d166a41f27fd4b158f70314e5eee8998bf3d97d5');
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
        var r = coinUtil.ripe160( new bitcore.Buffer(datum[0]));
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
      [0, ''],
      [-0, ''],
      [1, '01'],
      [-1, 'ff'],
      [18, '12'],
      [-18, 'ee'],
      [127, '7f'],
      [128, '8000'],
      [129, '8100'],
      [4096, '0010'],
      [-4096, '00f0'],
      [32767, 'ff7f'],
      [878082192, '90785634'],
      [0x01234567890, '9078563412'],
      [4294967295, 'ffffffff00'],
      [4294967296, '0000000001'],
      [4294967297, '0100000001'],
      [2147483647, 'ffffff7f'],
      [-2147483647, '01000080'],
      //[-4294967295, 'feffffffffffffff'],
      //[-4294967296, 'feffffffffffffff'],
      //[-4294967297, 'feffffffffffffff'],
    ];
    data.forEach(function(datum) {
      var integer = datum[0];
      var result = datum[1];
      it('should work for ' + integer, function() {
        buffertools.toHex(coinUtil.intToBuffer(integer)).should.equal(result);
      });
    });
  });
  describe('#varIntBuf', function() {
    var data = [
      [0, '00' ],
      [1, '01'],
      [253, 'fdfd00'],
      [254, 'fdfe00'],
      [255, 'fdff00'],
      [0x100, 'fd0001'],
      [0x1000, 'fd0010'],
      [0x1001, 'fd0110'],
      [0x10000, 'fe00000100'],
      [0x12345, 'fe45230100'],
      [0x12345678, 'fe78563412'],
      [0x123456789a, 'ff9a78563412000000'],
      [0x123456789abcde, 'ffdebc9a7856341200'],
    ];
    data.forEach(function(datum) {
      var integer = datum[0];
      var result = datum[1];
      it('should work for ' + integer, function() {
        buffertools.toHex(coinUtil.varIntBuf(integer)).should.equal(result);
      });
    });
  });
  describe('#getVarIntSize', function() {
    var data = [
      [0, 1],
      [1, 1],
      [252, 1],
      [253, 3],
      [254, 3],
      [0x100, 3],
      [0x1000, 3],
      [0x1001, 3],
      [0x10000, 5],
      [0x10001, 5],
      [0xffffffff, 5],
      [0x100000000, 9],
      [0x100000001, 9],
    ];
    data.forEach(function(datum) {
      var integer = datum[0];
      var result = datum[1];
      it('should work for ' + integer, function() {
        coinUtil.getVarIntSize(integer).should.equal(result);
      });
    });
  });
});
