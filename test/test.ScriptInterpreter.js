'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var ScriptInterpreterModule = bitcore.ScriptInterpreter;
var ScriptInterpreter;

describe('ScriptInterpreter', function() {
  it('should initialze the main object', function() {
    should.exist(ScriptInterpreterModule);
  });
  it('should be able to create class', function() {
    ScriptInterpreter = ScriptInterpreterModule;
    should.exist(ScriptInterpreter);
  });
  it('should be able to create instance', function() {
    var si = new ScriptInterpreter();
    should.exist(si);
  });
});





