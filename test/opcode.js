var should = require('chai').should();
var Opcode = require('../lib/opcode');

describe('Opcode', function() {

  it('should create a new Opcode', function() {
    var opcode = new Opcode(5);
  });
  
  it('should convert to a string with this handy syntax', function() {
    Opcode(0).toString().should.equal('OP_0');
    Opcode(97).toString().should.equal('OP_NOP');
    Opcode(96).toString().should.equal('OP_16');
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
