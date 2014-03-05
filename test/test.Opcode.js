'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

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
    var oc = new Opcode();
    should.exist(oc);
  });
  it.skip('should be able to create some constants', function() {
    // TODO: test works in node but not in browser
    for (var i in Opcode.map) {
      console.log('var '+i + ' = ' + Opcode.map[i] + ';');
      eval('var '+i + ' = ' + Opcode.map[i] + ';');
      console.log(eval(i));
    }
    should.exist(OP_VER);
    should.exist(OP_HASH160);
    should.exist(OP_RETURN);
    should.exist(OP_EQUALVERIFY);
    should.exist(OP_CHECKSIG);
    should.exist(OP_CHECKMULTISIG);

  });
});





