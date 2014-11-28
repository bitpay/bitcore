'use strict';

var _ = require('lodash');
var should = require('chai').should();
var bitcore = require('..');
var Opcode = bitcore.Opcode;

describe('Opcode', function() {

  it('should create a new Opcode', function() {
    var opcode = new Opcode(5);
    should.exist(opcode);
  });

  it('should convert to a string with this handy syntax', function() {
    Opcode(0).toString().should.equal('OP_0');
    Opcode(96).toString().should.equal('OP_16');
    Opcode(97).toString().should.equal('OP_NOP');
  });

  it('should convert to a number with this handy syntax', function() {
    Opcode('OP_0').toNumber().should.equal(0);
    Opcode('OP_16').toNumber().should.equal(96);
    Opcode('OP_NOP').toNumber().should.equal(97);
  });

  describe('#fromNumber', function() {

    it('should work for 0', function() {
      Opcode().fromNumber(0).num.should.equal(0);
    });

  });

  describe('#toNumber', function() {

    it('should work for 0', function() {
      Opcode().fromNumber(0).toNumber().should.equal(0);
    });

  });

  describe('#fromString', function() {

    it('should work for OP_0', function() {
      Opcode().fromString('OP_0').num.should.equal(0);
    });

  });

  describe('#toString', function() {

    it('should work for OP_0', function() {
      Opcode().fromString('OP_0').toString().should.equal('OP_0');
    });

  });

  describe('@map', function() {

    it('should have a map containing 116 elements', function() {
      _.size(Opcode.map).should.equal(116);
    });

  });

  describe('@reverseMap', function() {

    it('should exist and have op 185', function() {
      should.exist(Opcode.reverseMap);
      Opcode.reverseMap[185].should.equal('OP_NOP10');
    });

  });
  var smallints = [
    Opcode('OP_0'),
    Opcode('OP_1'),
    Opcode('OP_2'),
    Opcode('OP_3'),
    Opcode('OP_4'),
    Opcode('OP_5'),
    Opcode('OP_6'),
    Opcode('OP_7'),
    Opcode('OP_8'),
    Opcode('OP_9'),
    Opcode('OP_10'),
    Opcode('OP_11'),
    Opcode('OP_12'),
    Opcode('OP_13'),
    Opcode('OP_14'),
    Opcode('OP_15'),
    Opcode('OP_16')
  ];

  describe('@isSmallIntOp', function() {
    var testSmallInt = function() {
      Opcode.isSmallIntOp(this).should.equal(true);
    };
    for (var i = 0; i < smallints.length; i++) {
      var op = smallints[i];
      it('should work for small int ' + op, testSmallInt.bind(op));
    }

    it('should work for non-small ints', function() {
      Opcode.isSmallIntOp(Opcode('OP_RETURN')).should.equal(false);
      Opcode.isSmallIntOp(Opcode('OP_CHECKSIG')).should.equal(false);
      Opcode.isSmallIntOp(Opcode('OP_IF')).should.equal(false);
      Opcode.isSmallIntOp(Opcode('OP_NOP')).should.equal(false);
    });

  });


});
