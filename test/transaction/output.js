'use strict';

/* jshint unused: false */
/* jshint latedef: false */
var should = require('chai').should();
var expect = require('chai').expect;
var _ = require('lodash');

var bitcore = require('../..');
var BN = bitcore.crypto.BN;
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;
var Output = bitcore.Transaction.Output;
var Script = bitcore.Script;

var errors = bitcore.errors;

describe('Output', function() {

  var output = new Output({satoshis: 0, script: Script.empty()});

  it('can be assigned a satoshi amount in big number', function() {
    var newOutput = new Output({satoshis: new BN(100), script: Script.empty()});
    newOutput.satoshis.should.equal(100);
  });

  var expectEqualOutputs = function(a, b) {
    a.satoshis.should.equal(b.satoshis);
    a.script.toString().should.equal(b.script.toString());
  };

  it('deserializes correctly a simple output', function() {
    var writer = new BufferWriter();
    output.toBufferWriter(writer);
    var deserialized = Output.fromBufferReader(new BufferReader(writer.toBuffer()));
    expectEqualOutputs(output, deserialized);
  });

  it('roundtrips to/from object', function() {
    var newOutput = new Output({satoshis: 50, script: new Script().add(0)});
    var otherOutput = new Output(newOutput.toObject());
    expectEqualOutputs(newOutput, otherOutput);
  });

  it('can set a script from a buffer', function() {
    var newOutput = Output(output);
    newOutput.setScript(Script().add(0).toBuffer());
    newOutput.inspect().should.equal('<Output (0 sats) <Script: OP_0>>');
  });
  
  it('has a inspect property', function() {
    output.inspect().should.equal('<Output (0 sats) <Script: >>');
  });
});
