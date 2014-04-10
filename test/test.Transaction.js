'use strict';

var chai = chai || require('chai');
chai.config.includeStack = true;
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var Transaction = bitcore.Transaction;
var In;
var Out;
var Script = bitcore.Script;
var util = bitcore.util;
var buffertools = require('buffertools');
var testdata = testdata || require('./testdata');

// Read tests from test/data/tx_valid.json and tx_invalid.json
// Format is an array of arrays
// Inner arrays are either [ "comment" ]
// or [[[prevout hash, prevout index, prevout scriptPubKey], [input 2], ...],"], serializedTransaction, enforceP2SH
// ... where all scripts are stringified scripts.
// Returns an object with the Transaction object, and an array of input objects
function parse_test_transaction(entry) {
  // Ignore comments
  if (entry.length !== 3) return;

  var inputs = {};
  entry[0].forEach(function(vin) {
    var hash = (vin[0]);
    var index = vin[1];
    var scriptPubKey = Script.fromHumanReadable(vin[2]);

    var mapKey = [hash, index];
    inputs[mapKey] = scriptPubKey;

  });

  var raw = new Buffer(entry[1], 'hex');
  var tx = new Transaction();
  tx.parse(raw);

  // Sanity check transaction has been parsed correctly
  buffertools.toHex(tx.serialize()).should.equal(buffertools.toHex(raw));
  return {
    'transaction': tx,
    'inputs': inputs
  };
}

describe('Transaction', function() {
  it('should initialze the main object', function() {
    should.exist(Transaction);
    In = Transaction.In;
    Out = Transaction.Out;
    should.exist(In);
    should.exist(Out);
  });


  it('should be able to create instance', function() {
    var t = new Transaction();
    should.exist(t);
  });

  /*
   * Bitcoin core transaction tests
   */
  // Verify that known valid transactions are intepretted correctly
  var coreTest = function(data, valid) {
    buffertools.extend();
    data.forEach(function(datum) {
      if (datum.length < 3) return;
      var raw = datum[1];
      var verifyP2SH = datum[2];
      var testTx = parse_test_transaction(datum);
      var tx = testTx.transaction;

      describe((valid ? '' : 'in') + 'valid tx=' + raw, function() {
        it('should parse correctly', function() {
          buffertools.toHex(tx.serialize()).toLowerCase().should.equal(raw.toLowerCase());
        });

        var inputs = tx.inputs();
        var j = 0;
        inputs.forEach(function(input) {
          var i = j;
          j += 1;
          it('should validate input #' + i, function(done) {

            var outpointHash = new Buffer(input[0].length);
            input[0].copy(outpointHash);
            input[0] = buffertools.reverse(outpointHash);
            input[0] = buffertools.toHex(input[0]);
            var mapKey = [input];
            var scriptPubKey = testTx.inputs[mapKey];
            if (!scriptPubKey) throw new Error('Bad test: ' + datum);
            tx.verifyInput(
              i,
              scriptPubKey, {
                verifyP2SH: verifyP2SH,
                dontVerifyStrictEnc: true
              },
              function(err, results) {
                if (valid) {
                  should.not.exist(err);
                  should.exist(results);
                  results.should.equal(valid);
                } else {
                  var invalid = (typeof err !== 'undefined') || results === false;
                  invalid.should.equal(true);
                }
                done();
              }
            );
          });
        });
      });
    });
  };

  coreTest(testdata.dataTxValid, true);
  coreTest(testdata.dataTxInvalid, false);

});
