'use strict';

var buffer = require('buffer');

var chai = require('chai');
var should = chai.should();
var bitcore = require('../../');
var Script = bitcore.Script;
var BN = bitcore.crypto.BN;
var Transaction = bitcore.Transaction;
var sighash = Transaction.sighash;

var vectors_sighash = require('../data/sighash.json');

describe('sighash', function() {
  it('Should require amount for sigHash ForkId=0', function() {
    var vector = ["3eb87070042d16f9469b0080a3c1fe8de0feae345200beef8b1e0d7c62501ae0df899dca1e03000000066a0065525365ffffffffd14a9a335e8babddd89b5d0b6a0f41dd6b18848050a0fc48ce32d892e11817fd030000000863acac00535200527ff62cf3ad30d9064e180eaed5e6303950121a8086b5266b55156e4f7612f2c7ebf223e0020000000100ffffffff6273ca3aceb55931160fa7a3064682b4790ee016b4a5c0c0d101fd449dff88ba01000000055351ac526aa3b8223d0421f25b0400000000026552f92db70500000000075253516a656a53c4a908010000000000b5192901000000000652525251516aa148ca38", "acab53", 3, -1325231124, "fbbc83ed610e416d94dcee2bb3bc35dfea8060b8052c59eabd7e998e3e978328"];
    var txbuf = new buffer.Buffer(vector[0], 'hex');
    var scriptbuf = new buffer.Buffer(vector[1], 'hex');
    var subscript = Script(scriptbuf);
    var nin = vector[2];
    var nhashtype = vector[3];
    var sighashbuf = new buffer.Buffer(vector[4], 'hex');
    var tx = new Transaction(txbuf);

    //make sure transacion to/from buffer is isomorphic
    tx.uncheckedSerialize().should.equal(txbuf.toString('hex'));

    //sighash ought to be correct
    (function() {
      sighash.sighash(tx, nhashtype, nin, subscript).toString('hex').should.equal(sighashbuf.toString('hex'));
    }).should.throw('Invalid Argument');
  });

  var zeroBN = BN.Zero;
  vectors_sighash.forEach(function(vector, i) {
    if (i === 0 || !vector[4]) {
      // First element is just a row describing the next ones
      return;
    }
    it('test vector from bitcoind #' + i + ' (' + vector[4].substring(0, 16) + ')', function() {
      var txbuf = new buffer.Buffer(vector[0], 'hex');
      var scriptbuf = new buffer.Buffer(vector[1], 'hex');
      var subscript = Script(scriptbuf);
      var nin = vector[2];
      var nhashtype = vector[3];
      // var nhashtype = vector[3]>>>0;
      var sighashbuf = new buffer.Buffer(vector[4], 'hex');
      var tx = new Transaction(txbuf);

      //make sure transacion to/from buffer is isomorphic
      tx.uncheckedSerialize().should.equal(txbuf.toString('hex'));

      //sighash ought to be correct
      sighash.sighash(tx, nhashtype, nin, subscript, zeroBN).toString('hex').should.equal(sighashbuf.toString('hex'));
    });
  });
});
