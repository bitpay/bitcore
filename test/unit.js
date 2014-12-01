'use strict';

var should = require('chai').should();
var bitcore = require('..');
var Unit = bitcore.Unit;

describe('Unit', function() {

  it('should create an instance', function() {
    var unit;

    unit = new Unit(1.2, 'BTC');
    should.exist(unit);

    unit = Unit(1.2, 'BTC');
    should.exist(unit);
  });

  it('should have property accesors', function() {
    var unit = new Unit(1.2, 'BTC');
    should.exist(unit.BTC);
    should.exist(unit.mBTC);
    should.exist(unit.bits);
    should.exist(unit.satoshis);
  });

  it('should allow amount as string', function() {
    var unit;

    unit = Unit.fromBTC('1.00001');
    unit.BTC.should.equal(1.00001);

    unit = Unit.fromMilis('1.00001');
    unit.mBTC.should.equal(1.00001);

    unit = Unit.fromBits('100');
    unit.bits.should.equal(100);

    unit = Unit.fromSatoshis('8999');
    unit.satoshis.should.equal(8999);
  });

  it('should have constructor helpers', function() {
    var unit;

    unit = Unit.fromBTC(1.00001);
    unit.BTC.should.equal(1.00001);

    unit = Unit.fromMilis(1.00001);
    unit.mBTC.should.equal(1.00001);

    unit = Unit.fromBits(100);
    unit.bits.should.equal(100);

    unit = Unit.fromSatoshis(8999);
    unit.satoshis.should.equal(8999);
  });

  it('should convert to satoshis correctly', function() {
    var unit;

    unit = Unit.fromBTC(1.3);
    unit.mBTC.should.equal(1300);
    unit.bits.should.equal(1300000);
    unit.satoshis.should.equal(130000000);

    unit = Unit.fromMilis(1.3);
    unit.BTC.should.equal(0.0013);
    unit.bits.should.equal(1300);
    unit.satoshis.should.equal(130000);

    unit = Unit.fromBits(1.3);
    unit.BTC.should.equal(0.0000013);
    unit.mBTC.should.equal(0.0013);
    unit.satoshis.should.equal(130);

    unit = Unit.fromSatoshis(3);
    unit.BTC.should.equal(0.00000003);
    unit.mBTC.should.equal(0.00003);
    unit.bits.should.equal(0.03);
  });

  it('should take in count floating point problems', function() {
    var unit = Unit.fromBTC(0.00000003);
    unit.mBTC.should.equal(0.00003);
    unit.bits.should.equal(0.03);
    unit.satoshis.should.equal(3);
  });

  it('should expose unit codes', function() {
    should.exist(Unit.BTC);
    Unit.BTC.should.equal('BTC');

    should.exist(Unit.mBTC);
    Unit.mBTC.should.equal('mBTC');

    should.exist(Unit.bits);
    Unit.bits.should.equal('bits');

    should.exist(Unit.satoshis);
    Unit.satoshis.should.equal('satoshis');
  });

  it('should expose shorthand conversion methods', function() {
    var unit = new Unit(1.3, 'BTC');
    unit.toBTC().should.equal(unit.BTC);
    unit.toMilis().should.equal(unit.mBTC);
    unit.toBits().should.equal(unit.bits);
    unit.toSatoshis().should.equal(unit.satoshis);
  });

  it('should expose a general conversion method', function() {
    var unit = new Unit(1.3, 'BTC');
    unit.to(Unit.BTC).should.equal(unit.BTC);
    unit.to(Unit.mBTC).should.equal(unit.mBTC);
    unit.to(Unit.bits).should.equal(unit.bits);
    unit.to(Unit.satoshis).should.equal(unit.satoshis);
  });

  it('should have a toString method', function() {
    var unit = new Unit(1.3, 'BTC');
    should.exist(unit.toString);
    unit.toString().should.be.a('string');
  });

  it('should have an inspect method', function() {
    var unit = new Unit(1.3, 'BTC');
    should.exist(unit.inspect);
    unit.inspect().should.be.a('string');
  });

});
