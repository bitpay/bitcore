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
  it('should initialize the main objects', function() {
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

  it('#normalized hash', function() {
    // string output generated from: bitcoind createrawtransaction '[{"txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1","vout":1},{"txid":"2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc2","vout":0}  ]' '{"mrPnbY1yKDBsdgbHbS7kJ8GVm8F66hWHLE":0.08}'
    //
    var Parser = bitcore.BinaryParser;
    var tx = new Transaction();
    tx.parse(new Buffer('0100000002c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0100000000ffffffffc2cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a0000000000ffffffff0100127a00000000001976a914774e603bafb717bd3f070e68bbcccfd907c77d1388ac00000000','hex'));

    tx.getNormalizedHash().toString('hex').should.equal('1f7d2666e2d0d663e098abb76db6ba392da972d21c14b6ea6f4336171d29966b');

    var tx2 = new Transaction();
    tx2.parse(new Buffer('0100000001c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a010000004b00473044022059085ff1b8ad03033e60969b1c770aa29ba5d74c28a9992c514b100d860792f1022057a307f77f91f4563651eefc0a959aa916d275c58525320309b6aeeff43d0d8a010000ffffffff0215cd5b07000000001976a91434f8e0c5be216025a52addf18a987543cad23f7a88acdbd53e340000000017a9147a769913c0721b1e0aa6bf8a93f4ef810c60587a8700000000','hex'));

    tx2.getNormalizedHash().toString('hex').should.equal('e298bbf3734898581b8e342f2064236abf0acca6ac7e9a3009a16ef7b64d4983');
  });


});
