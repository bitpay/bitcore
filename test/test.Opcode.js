'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var OpcodeModule = bitcore.Opcode;
var Opcode;

describe('Opcode', function() {
  it('should initialze the main object', function() {
    should.exist(OpcodeModule);
  });
  it('should be able to create class', function() {
    Opcode = OpcodeModule;
    should.exist(Opcode);
  });
  it('should be able to create instance', function() {
    var oc = new Opcode(81);
    should.exist(oc);
  });
  it('should be able to create some constants', function() {
    should.exist(Opcode.map.OP_VER);
    should.exist(Opcode.map.OP_HASH160);
    should.exist(Opcode.map.OP_RETURN);
    should.exist(Opcode.map.OP_EQUALVERIFY);
    should.exist(Opcode.map.OP_CHECKSIG);
    should.exist(Opcode.map.OP_CHECKMULTISIG);
  });
  it('#asList should work', function() {
    var list = Opcode.asList();
    (typeof(list[0])).should.equal('string');
    list.length.should.equal(116);
  });
});
