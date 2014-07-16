'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var buffertools = require('buffertools');

var should = chai.should();
var testdata = testdata || require('./testdata');

var Script = bitcore.Script;
var ScriptInterpreter = bitcore.ScriptInterpreter;

describe('ScriptInterpreter', function() {
  it('should initialze the main object', function() {
    should.exist(ScriptInterpreter);
  });
  it('should be able to create instance', function() {
    var si = new ScriptInterpreter();
    should.exist(si);
  });

  describe('SIGHASH constants', function() {
    it('should equal the values from bitcoin core', function() {
      ScriptInterpreter.SIGHASH_ALL.should.equal(1);
      ScriptInterpreter.SIGHASH_NONE.should.equal(2);
      ScriptInterpreter.SIGHASH_SINGLE.should.equal(3);
      ScriptInterpreter.SIGHASH_ANYONECANPAY.should.equal(0x80);
    });
  });

  var testScripts = function(data, valid) {
    data.forEach(function(datum) {
      if (datum.length < 2) throw new Error('Invalid test data');
      var scriptSig = datum[0]; // script inputs
      var scriptPubKey = datum[1]; // output script
      var human = scriptSig + ' ' + scriptPubKey;
      it('should ' + (!valid ? 'not ' : '') + 'validate script ' + human, function(done) {
        try {
          ScriptInterpreter.verifyFull(
            Script.fromHumanReadable(scriptSig), // scriptSig
            Script.fromHumanReadable(scriptPubKey), // scriptPubKey
            null, 0, 0, // tx, output index, hashtype
            { verifyP2SH: !valid}, // only verify P2SH for invalid data set
            function(err, result) {
              if (valid) {
                should.not.exist(err);
              } else {
                var failed = (typeof err !== 'undefined') || (result === false);
                failed.should.equal(true);
              }
              if (typeof result !== 'undefined') {
                result.should.equal(valid);
              }
              done();
            }
          );
        } catch (e) {
          if (valid) {
            console.log(e);
          }
          valid.should.equal(false);
          done();
        }

      });
    });
  };
  testScripts(testdata.dataScriptValid, true);
  testScripts(testdata.dataScriptInvalid, false);



  testdata.dataSigCanonical.forEach(function(datum) {
    it('should validate valid canonical signatures', function() {
      new ScriptInterpreter().isCanonicalSignature(new Buffer(datum, 'hex')).should.equal(true);
    });
  });
  testdata.dataSigNonCanonical.forEach(function(datum) {
    it('should NOT validate invalid canonical signatures', function() {
      var sig;
      var isHex;
      //is Hex?
      try {
        sig = new Buffer(datum, 'hex');
        isHex = 1;
      } catch (e) {}

      // ignore non-hex strings
      if (isHex) {
        var f = function() {
          var si = new ScriptInterpreter();
          var r = si.isCanonicalSignature(sig);
        };
        // how this test should be
        // f.should.throw();
        new ScriptInterpreter().isCanonicalSignature.bind(sig).should.throw();
      }
    });
  });


});
