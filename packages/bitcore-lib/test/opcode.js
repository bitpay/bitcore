'use strict';

var _ = require('lodash');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
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
      Opcode.fromNumber(0).num.should.equal(0);
    });
    it('should fail for non-number', function() {
      Opcode.fromNumber.bind(null, 'a string').should.throw('Invalid Argument');
    });
  });

  describe('#set', function() {
    it('should work for object', function() {
      Opcode(42).num.should.equal(42);
    });
    it('should fail for empty-object', function() {
      expect(function() {
        Opcode();
      }).to.throw(TypeError);
    });
  });

  describe('#toNumber', function() {
    it('should work for 0', function() {
      Opcode.fromNumber(0).toNumber().should.equal(0);
    });
  });

  describe('#buffer', function() {
    it('should correctly input/output a buffer', function() {
      var buf = Buffer.from('a6', 'hex');
      Opcode.fromBuffer(buf).toBuffer().should.deep.equal(buf);
    });
  });

  describe('#fromString', function() {
    it('should work for OP_0', function() {
      Opcode.fromString('OP_0').num.should.equal(0);
    });
    it('should fail for invalid string', function() {
      Opcode.fromString.bind(null, 'OP_SATOSHI').should.throw('Invalid opcodestr');
      Opcode.fromString.bind(null, 'BANANA').should.throw('Invalid opcodestr');
    });
    it('should fail for non-string', function() {
      Opcode.fromString.bind(null, 123).should.throw('Invalid Argument');
    });
  });

  describe('#toString', function() {
    it('should work for OP_0', function() {
      Opcode.fromString('OP_0').toString().should.equal('OP_0');
    });

    it('should not work for non-opcode', function() {
      expect(function(){
        Opcode('OP_NOTACODE').toString();
      }).to.throw('Opcode does not have a string representation');
    });
  });

  describe('#decodeOpN', function() {
    it('returns 0 for OP_0', function() {
      Opcode.decodeOpN(Opcode.OP_0).should.equal(0);
    });

    it('should return 16 for OP_16', function() {
      Opcode.decodeOpN(Opcode.OP_16).should.equal(16);
    });

    it('should throw an error for >OP_16', function() {
      try {
        Opcode.decodeOpN(Opcode.OP_NOP);
        throw new Error('should have thrown');
      } catch(e) {
        e.message.should.equal('Invalid Argument: Error: Invalid opcode: 97');
      }
    });
  });

  describe('#isOpSuccess', function() {
    it('should return true for "success" codes', function() {
      function isSuccess(opcode) {
        return opcode == 80 || opcode == 98 || (opcode >= 126 && opcode <= 129) ||
          (opcode >= 131 && opcode <= 134) || (opcode >= 137 && opcode <= 138) ||
          (opcode >= 141 && opcode <= 142) || (opcode >= 149 && opcode <= 153) ||
          (opcode >= 187 && opcode <= 254)
      };
      for (let i = 0; i <= 255; i++) {
        Opcode.isOpSuccess(i).should.equal(isSuccess(i));
      }
    });

    it('should handle human readable string opcode', function() {
      Opcode.isOpSuccess('OP_RESERVED').should.equal(true);
    });

    it('should handle number string opcode', function() {
      Opcode.isOpSuccess('80').should.equal(true);
    });
  });

  describe('@map', function() {
    it('should have a map containing 119 elements', function() {
      _.size(Opcode.map).should.equal(119);
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

  describe('@smallInt', function() {
    var testSmallInt = function(n, op) {
      Opcode.smallInt(n).toString().should.equal(op.toString());
    };

    for (var i = 0; i < smallints.length; i++) {
      var op = smallints[i];
      it('should work for small int ' + op, testSmallInt.bind(null, i, op));
    }

    it('with not number', function () {
      Opcode.smallInt.bind(null, '2').should.throw('Invalid Argument');
    });

    it('with n equal -1', function () {
      Opcode.smallInt.bind(null, -1).should.throw('Invalid Argument');
    });

    it('with n equal 17', function () {
      Opcode.smallInt.bind(null, 17).should.throw('Invalid Argument');
    });
  });
  describe('@isSmallIntOp', function() {
    var testIsSmallInt = function(op) {
      Opcode.isSmallIntOp(op).should.equal(true);
    };
    for (var i = 0; i < smallints.length; i++) {
      var op = smallints[i];
      it('should work for small int ' + op, testIsSmallInt.bind(null, op));
    }

    it('should work for non-small ints', function() {
      Opcode.isSmallIntOp(Opcode('OP_RETURN')).should.equal(false);
      Opcode.isSmallIntOp(Opcode('OP_CHECKSIG')).should.equal(false);
      Opcode.isSmallIntOp(Opcode('OP_IF')).should.equal(false);
      Opcode.isSmallIntOp(Opcode('OP_NOP')).should.equal(false);
    });

  });

  describe('#inspect', function() {
    it('should output opcode by name, hex, and decimal', function() {
      Opcode.fromString('OP_NOP').inspect().should.equal('<Opcode: OP_NOP, hex: 61, decimal: 97>');
    });
  });

});
