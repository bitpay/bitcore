var should = require('chai').should();
var Opcode = require('../lib/opcode');

describe('Opcode', function() {

  it('should create a new Opcode', function() {
    var opcode = new Opcode(5);
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
      var i = 0;
      for (var key in Opcode.map) {
        i++;
      }
      i.should.equal(116);
    });

  });

  describe('@reverseMap', function() {
    
    it('should exist and have op 185', function() {
      should.exist(Opcode.reverseMap);
      Opcode.reverseMap[185].should.equal('OP_NOP10');
    });

  });

});
