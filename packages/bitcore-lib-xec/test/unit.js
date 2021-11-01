'use strict';

var should = require('chai').should();
var expect = require('chai').expect;

var bitcore = require('..');
var errors = bitcore.errors;
var Unit = bitcore.Unit;

describe('Unit', function() {

  it('can be created from a number and unit', function() {
    expect(function() {
      return new Unit(1.2, 'BTC');
    }).to.not.throw();
  });

  it('can be created from a number and exchange rate', function() {
    expect(function() {
      return new Unit(1.2, 350);
    }).to.not.throw();
  });

  it('no "new" is required for creating an instance', function() {
    expect(function() {
      return Unit(1.2, 'BTC');
    }).to.not.throw();

    expect(function() {
      return Unit(1.2, 350);
    }).to.not.throw();
  });

  it('has property accesors "BTC", "mBTC", "uBTC", "bits", and "satoshis"', function() {
    var unit = new Unit(1.2, 'BTC');
    unit.BTC.should.equal(1.2);
    unit.uBTC.should.equal(1.2);
    unit.bits.should.equal(1.2);
    unit.satoshis.should.equal(120);
  });

  it('a string amount is allowed', function() {
    var unit;

    unit = Unit.fromBits('100');
    unit.bits.should.equal(100);

    unit = Unit.fromSatoshis('8999');
    unit.satoshis.should.equal(8999);

    unit = Unit.fromFiat('43', 350);
    unit.BTC.should.equal(0.12);
  });

  it('should have constructor helpers', function() {
    var unit;

    unit = Unit.fromBits(100);
    unit.bits.should.equal(100);

    unit = Unit.fromSatoshis(8999);
    unit.satoshis.should.equal(8999);

    unit = Unit.fromFiat(43, 350);
    unit.BTC.should.equal(0.12);
  });

  it('converts to satoshis correctly', function() {
    /* jshint maxstatements: 25 */
    var unit;
    unit = Unit.fromBTC(1.3);
    unit.bits.should.equal(1.3);
    unit.satoshis.should.equal(130);

    unit = Unit.fromBits(1.3);
    unit.BTC.should.equal(1.3);
    unit.satoshis.should.equal(130);

    unit = Unit.fromSatoshis(3);
    unit.BTC.should.equal(0.03);
    unit.bits.should.equal(0.03);
  });

  it('exposes unit codes', function() {
    should.exist(Unit.BTC);
    Unit.BTC.should.equal('BTC');

    should.exist(Unit.bits);
    Unit.bits.should.equal('bits');

    should.exist(Unit.satoshis);
    Unit.satoshis.should.equal('satoshis');
  });

  it('exposes a method that converts to different units', function() {
    var unit = new Unit(1.3, 'BTC');
    unit.to(Unit.BTC).should.equal(unit.BTC);
    unit.to(Unit.bits).should.equal(unit.bits);
    unit.to(Unit.satoshis).should.equal(unit.satoshis);
  });

  it('exposes shorthand conversion methods', function() {
    var unit = new Unit(1.3, 'BTC');
    unit.toBTC().should.equal(unit.BTC);
    unit.toBits().should.equal(unit.bits);
    unit.toSatoshis().should.equal(unit.satoshis);
  });

  it('can convert to fiat', function() {
    var unit = new Unit(1.3, 350);
    unit.atRate(350).should.equal(0);
    unit.to(350).should.equal(0);

  });

  it('toString works as expected', function() {
    var unit = new Unit(1.3, 'BTC');
    should.exist(unit.toString);
    unit.toString().should.be.a('string');
  });

  it('can be imported and exported from/to JSON', function() {
    var json = JSON.stringify({amount:1.3, code:'BTC'});
    var unit = Unit.fromObject(JSON.parse(json));
    JSON.stringify(unit).should.deep.equal(json);
  });

  it('importing from invalid JSON fails quickly', function() {
    expect(function() {
      return Unit.fromJSON('¹');
    }).to.throw();
  });

  it('inspect method displays nicely', function() {
    var unit = new Unit(1.3, 'BTC');
    unit.inspect().should.equal('<Unit: 130 satoshis>');
  });

  it('fails when the unit is not recognized', function() {
    expect(function() {
      return new Unit(100, 'USD');
    }).to.throw(errors.Unit.UnknownCode);
    expect(function() {
      return new Unit(100, 'BTC').to('USD');
    }).to.throw(errors.Unit.UnknownCode);
  });

  it('fails when the exchange rate is invalid', function() {
    expect(function() {
      return new Unit(100, -123);
    }).to.throw(errors.Unit.InvalidRate);
    expect(function() {
      return new Unit(100, 'BTC').atRate(-123);
    }).to.throw(errors.Unit.InvalidRate);
  });

});
