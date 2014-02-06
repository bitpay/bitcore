'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var ScriptModule = bitcore.Script;
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
});





