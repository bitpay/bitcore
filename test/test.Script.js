'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var ScriptModule = bitcore.Script;
var Address = bitcore.Address.class();
var Script;

describe('Script', function() {
  it('should initialze the main object', function() {
    should.exist(ScriptModule);
  });
  it('should be able to create class', function() {
    Script = ScriptModule.class();
    should.exist(Script);
  });
  it('should be able to create instance', function() {
    var s = new Script();
    should.exist(s);
  });
  it('should be able to create Script from Address', function() {
    var addr = new Address('1J57QmkaQ6JohJoQyaUJwngJ2vTQ3C6gHi');
    var script = Script.createPubKeyHashOut(addr.payload());
    should.exist(script);
    script.isPubkeyHash().should.be.true;
  });
  it('isP2SH should work', function() {
    var addr = new Address('1J57QmkaQ6JohJoQyaUJwngJ2vTQ3C6gHi');
    var script = Script.createPubKeyHashOut(addr.payload());
    script.isP2SH().should.be.false;
  });
});





