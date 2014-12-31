'use strict';

var _ = require('lodash');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

var bitcore = require('..');
var UTXO = bitcore.UTXO;

describe('UTXO', function() {

  var sampleData1 = {
    'address': 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1',
    'txId': 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
    'outputIndex': 0,
    'script': 'OP_DUP OP_HASH160 20 0x88d9931ea73d60eaf7e5671efc0552b912911f2a OP_EQUALVERIFY OP_CHECKSIG',
    'satoshis': 1020000
  };
  var sampleData2 = {
    'txid': 'e42447187db5a29d6db161661e4bc66d61c3e499690fe5ea47f87b79ca573986',
    'vout': 1,
    'address': 'mgBCJAsvzgT2qNNeXsoECg2uPKrUsZ76up',
    'scriptPubKey': '76a914073b7eae2823efa349e3b9155b8a735526463a0f88ac',
    'amount': 0.01080000
  };

  it('roundtrip from raw data', function() {
    expect(UTXO(sampleData2).toObject()).to.deep.equal(sampleData2);
  });

  it('can be created without "new" operand', function() {
    expect(UTXO(sampleData1) instanceof UTXO).to.equal(true);
  });

  it('fails if no tx id is provided', function() {
    expect(function() {
      return new UTXO({});
    }).to.throw();
  });

  it('fails if vout is not a number', function() {
    var sample = _.cloneDeep(sampleData2);
    sample.vout = '1';
    expect(function() {
      return new UTXO(sample);
    }).to.throw();
  });

  it('displays nicely on the console', function() {
    var expected = '<UTXO: a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458:0' +
                   ', satoshis: 1020000, address: mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1>';
    expect(new UTXO(sampleData1).inspect()).to.equal(expected);
  });

  it('toString returns txid:vout', function() {
    var expected = 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458:0';
    expect(new UTXO(sampleData1).toString()).to.equal(expected);
  });

  it('to/from JSON roundtrip', function() {
    var utxo = new UTXO(sampleData2);
    expect(
      JSON.parse(
        UTXO.fromJSON(
          UTXO.fromObject(
            UTXO.fromJSON(
              utxo.toJSON()
            ).toObject()
          ).toJSON()
        ).toJSON()
      )
    ).to.deep.equal(sampleData2);
  });
});
