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

  var output = new Output({
    satoshis: 0,
    script: Script.empty()
  });

  it('can be assigned a satoshi amount in big number', function() {
    var newOutput = new Output({
      satoshis: new BN(100),
      script: Script.empty()
    });
    newOutput.satoshis.should.equal(100);
  });

  it('can be assigned a satoshi amount with a string', function() {
    var newOutput = new Output({
      satoshis: '100',
      script: Script.empty()
    });
    newOutput.satoshis.should.equal(100);
  });

  describe('will error if output is not a positive integer', function() {
    it('-100', function() {
      (function() {
        var newOutput = new Output({
          satoshis: -100,
          script: Script.empty()
        });
      }).should.throw('Output satoshis is not a natural number');
    });

    it('1.1', function() {
      (function() {
        var newOutput = new Output({
          satoshis: 1.1,
          script: Script.empty()
        });
      }).should.throw('Output satoshis is not a natural number');
    });

    it('NaN', function() {
      (function() {
        var newOutput = new Output({
          satoshis: NaN,
          script: Script.empty()
        });
      }).should.throw('Output satoshis is not a natural number');
    });

    it('Infinity', function() {
      (function() {
        var newOutput = new Output({
          satoshis: Infinity,
          script: Script.empty()
        });
      }).should.throw('Output satoshis is not a natural number');
    });
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

  it('can set a script from a buffer', function() {
    var newOutput = Output(output);
    newOutput.setScript(Script().add(0).toBuffer());
    newOutput.inspect().should.equal('<Output (0 sats) <Script: OP_0>>');
  });

  it('has a inspect property', function() {
    output.inspect().should.equal('<Output (0 sats) <Script: >>');
  });

  var output2 = new Output({
    satoshis: 1100000000,
    script: new Script('OP_2 21 0x038282263212c609d9ea2a6e3e172de238d8c39' +
      'cabd5ac1ca10646e23fd5f51508 21 0x038282263212c609d9ea2a6e3e172de23' +
      '8d8c39cabd5ac1ca10646e23fd5f51508 OP_2 OP_CHECKMULTISIG OP_EQUAL')
  });

  it('toBufferWriter', function() {
    output2.toBufferWriter().toBuffer().toString('hex')
      .should.equal('00ab904100000000485215038282263212c609d9ea2a6e3e172de2' +
        '38d8c39cabd5ac1ca10646e23fd5f5150815038282263212c609d9ea2a6e3e172d' +
        'e238d8c39cabd5ac1ca10646e23fd5f5150852ae87');
  });

  it('roundtrips to/from object', function() {
    var newOutput = new Output({
      satoshis: 50,
      script: new Script().add(0)
    });
    var otherOutput = new Output(newOutput.toObject());
    expectEqualOutputs(newOutput, otherOutput);
  });

  it('roundtrips to/from JSON', function() {
    var json = output2.toJSON();
    var o3 = new Output(json);
    o3.toJSON().should.equal(json);
  });

  it('setScript fails with invalid input', function() {
    var out = new Output(output2.toJSON());
    out.setScript.bind(out, 45).should.throw('Invalid argument type: script');
  });

  it('sets script to null if it is an InvalidBuffer', function() {
    var output = new Output({
      satoshis: 1000
    });
    output._scriptBuffer = new Buffer('4c', 'hex');

    var result = output.script;
    should.equal(result, null);
  });

  it('should throw an error if Script throws an error that is not InvalidBuffer', function() {
    var output = new Output({
      satoshis: 1000
    });
    output._scriptBuffer = 'bad';

    (function() {
      var result = output.script;
    }).should.throw('Invalid hex string');
  });
});
