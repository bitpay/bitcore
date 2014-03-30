'use strict';

var chai = chai || require('chai');
chai.Assertion.includeStack = true;
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
    data.forEach(function(datum) {
      if (datum.length < 3) return;
      var raw = datum[1];
      var verifyP2SH = datum[2];

      it.skip((valid ? '' : 'in') + 'valid tx=' + raw, function(done) {
        var cb = function(err, results) {
          should.not.exist(err);
          should.exist(results);
          results.should.equal(valid);
          done();
        };

        var testTx = parse_test_transaction(datum);
        buffertools.toHex(testTx.transaction.serialize()).should.equal(raw);
        var inputs = testTx.transaction.inputs();
        for (var i = 0; i < inputs.length; i++) {
          var input = inputs[i];
          buffertools.reverse(input[0]);
          input[0] = buffertools.toHex(input[0]);
          var mapKey = [input];
          var scriptPubKey = testTx.inputs[mapKey];
          if (!scriptPubKey) throw new Error('Bad test: '+datum);
          testTx.transaction.verifyInput(
            i,
            scriptPubKey, {
              verifyP2SH: verifyP2SH,
              dontVerifyStrictEnc: true
            },
            cb);
        }
      });
    });
  };

  coreTest(testdata.dataTxValid, true);
  coreTest(testdata.dataTxInvalid, false);

});
