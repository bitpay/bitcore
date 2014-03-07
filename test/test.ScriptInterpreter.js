'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();
var test_data = require('./testdata');

var ScriptInterpreterModule = bitcore.ScriptInterpreter;
var Script = bitcore.Script.class();
var ScriptInterpreter;

describe('ScriptInterpreter', function() {
  it('should initialze the main object', function() {
    should.exist(ScriptInterpreterModule);
  });
  it('should be able to create class', function() {
    ScriptInterpreter = ScriptInterpreterModule.class();
    should.exist(ScriptInterpreter);
  });
  it('should be able to create instance', function() {
    var si = new ScriptInterpreter();
    should.exist(si);
  });
  var i = 0;
  test_data.dataScriptValid.forEach(function(datum) {
    if (datum.length < 2) throw new Error('Invalid test data');
    var scriptSig = datum[0]; // script inputs
    var scriptPubKey = datum[1]; // output script
    var human = scriptSig + ' ' + scriptPubKey;
    it('should validate script ' + human, function(done) {
      i++;
      console.log(i + ' ' + human);
      ScriptInterpreter.verify(Script.fromStringContent(scriptSig),
        Script.fromStringContent(scriptPubKey),
        null, 0, 0, // tx, output index, and hashtype
        function (err, result) {
          should.not.exist(err);
          result.should.equal(true);
          done();
        }
      );
    });
  });
});





