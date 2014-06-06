'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = bitcore.util;
var should = chai.should();
var buffertools = require('buffertools');

describe('util', function() {
  describe('sha512', function() {
    it('should calculate this particular hash correctly', function() {
      var data = new Buffer('test data');
      var hash = coinUtil.sha512(data);
      hash.toString('hex').should.equal('0e1e21ecf105ec853d24d728867ad70613c21663a4693074b2a3619c1bd39d66b588c33723bb466c72424e80e3ca63c249078ab347bab9428500e7ee43059d0d');
    });
  });
  describe('sha512hmac', function() {
    it('should calculate the value of this sha512hmac correctly', function() {
      var data = new Buffer('data');
      var key = new Buffer('key');
      var mac = coinUtil.sha512hmac(data, key);
      mac.toString('hex').should.equal('3c5953a18f7303ec653ba170ae334fafa08e3846f2efe317b87efce82376253cb52a8c31ddcde5a3a2eee183c2b34cb91f85e64ddbc325f7692b199473579c58');
    });
  });
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
      var pubKeyHash = coinUtil.ripe160(new Buffer(pk, 'hex'));
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

  describe('#twoSha256', function() {
    var data = new Buffer('907c2bc503ade11cc3b04eb2918b6f547b0630ab569273824748c87ea14b0696526c66ba740200000000fd1f9bdd4ef073c7afc4ae00da8a66f429c917a0081ad1e1dabce28d373eab81d8628de80200000000ad042b5f25efb33beec9f3364e8a9139e8439d9d7e26529c3c30b6c3fd89f8684cfd68ea0200000000599ac2fe02a526ed040000000008535300516352515164370e010000000003006300ab2ec2291fe51c6f', 'hex');
    it('should work for ' + data.toString('hex'), function() {
      var twoSha256 = buffertools.toHex(buffertools.reverse(coinUtil.twoSha256(data)));
      var expected = '31af167a6cf3f9d5f6875caa4d31704ceb0eba078d132b78dab52c3b8997317e';
      twoSha256.should.equal(expected);
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
        var r = coinUtil.ripe160(new bitcore.Buffer(datum[0]));
        buffertools.toHex(r).should.equal(datum[1]);
      });
      it('should work for Buffer ' + datum[0], function() {
        var r = coinUtil.ripe160(new Buffer(datum[0]));
        buffertools.toHex(r).should.equal(datum[1]);
      });
    });
  });
  describe('#intToBuffer2C', function() {
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
    ];
    data.forEach(function(datum) {
      var integer = datum[0];
      var result = datum[1];
      it('should work for ' + integer, function() {
        var buf = coinUtil.intToBuffer2C(integer);
        var hex = buffertools.toHex(buf);
        hex.should.equal(result);
      });
    });
  });
  describe('#varIntBuf', function() {
    var data = [
      [0, '00'],
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
  describe('#intToBufferSM', function() {
    var data = [
      [0, ''],
      [1, '01'],
      [-1, '81'],
      [2, '02'],
      [-2, '82'],
      [-32768, '008080'],
    ];
    data.forEach(function(datum) {
      var i = datum[0];
      var hex = datum[1];
      it('should work for ' + i, function() {
        var result = coinUtil.intToBufferSM(i);
        buffertools.toHex(result).should.equal(hex);
      });
    });
  });
  describe('#calcDifficulty', function() {
    var bitsgenesis = 486604799;
    it('should work for the bits from the genesis block; ' + bitsgenesis, function() {
      var difficulty = coinUtil.calcDifficulty(bitsgenesis);
      difficulty.should.equal(1);
    });
    var randomotherbits = 419476394;
    it('should work for the bits in a randomly chosen block, eg [00000000000000001fef2bbc6da9b65e16f9187b7d88f15a308490bf2c9b8e1d] ' + randomotherbits, function() {
      var difficulty = coinUtil.calcDifficulty(randomotherbits);
      difficulty.should.equal(6119726089);
    });
  });

});
