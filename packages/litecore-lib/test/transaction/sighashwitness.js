'use strict';

var chai = require('chai');
var should = chai.should();
var bitcore = require('../../');
var Transaction = bitcore.Transaction;
var Signature = bitcore.crypto.Signature;
var SighashWitness = Transaction.SighashWitness;

describe('Sighash Witness Program Version 0', function() {

  it('should create hash for sighash all', function() {
    // https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki
    var unsignedTx = bitcore.Transaction('0100000002fff7f7881a8099afa6940d42d1e7f6362bec38171ea3edf433541db4e4ad969f0000000000eeffffffef51e1b804cc89d182d279655c3aa89e815b1b309fe287d9b2b55d57b90ec68a0100000000ffffffff02202cb206000000001976a9148280b37df378db99f66f85c95a783a76ac7a6d5988ac9093510d000000001976a9143bde42dbee7e4dbe6a21b2d50ce2f0167faa815988ac11000000');

    var scriptCode = new Buffer('1976a9141d0f172a0ecb48aee1be1f2687d2963ae33f71a188ac', 'hex');
    var satoshisBuffer = new Buffer('0046c32300000000', 'hex');

    var hash = SighashWitness.sighash(unsignedTx, Signature.SIGHASH_ALL, 1, scriptCode, satoshisBuffer);

    hash.toString('hex').should.equal('c37af31116d1b27caf68aae9e3ac82f1477929014d5b917657d0eb49478cb670');
  });

});
