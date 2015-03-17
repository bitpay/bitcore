'use strict';

var should = require('chai').should();
var P2P = require('../../../');
var Messages = P2P.Messages;
var sinon = require('sinon');
var bitcore = require('bitcore');

describe('Command Messages', function() {

  var messages = new Messages();
  var commandsMap = {
    version: 'Version',
    verack: 'VerAck',
    ping: 'Ping',
    pong: 'Pong',
    block: 'Block',
    tx: 'Transaction',
    getdata: 'GetData',
    headers: 'Headers',
    notfound: 'NotFound',
    inv: 'Inventory',
    addr: 'Address',
    alert: 'Alert',
    reject: 'Reject',
    merkleblock: 'MerkleBlock',
    filterload: 'FilterLoad',
    filteradd: 'FilterAdd',
    filterclear: 'FilterClear',
    getblocks: 'GetBlocks',
    getheaders: 'GetHeaders',
    mempool: 'MemPool',
    getaddr: 'GetAddr'
  };

  describe('Transaction', function() {

    it('should accept a transaction instance as an argument', function() {
      var tx = new bitcore.Transaction();
      var message = messages.Transaction(tx);
      message.transaction.should.be.instanceof(bitcore.Transaction);
    });

  });

  describe('Block', function() {

    it('should accept a block instance as an argument', function() {
      var block = new bitcore.Block({
        header: {},
        transactions: []
      });
      var message = messages.Block(block);
      message.block.should.be.instanceof(bitcore.Block);
    });

  });

  describe('FilterLoad', function() {

    it('should return a null payload', function() {
      var message = messages.FilterLoad();
      var payload = message.getPayload();
      payload.length.should.equal(0);
      payload.should.be.instanceof(Buffer);
    });

  });

  describe('Transaction', function() {

    it('should be able to pass a custom Transaction', function(done) {
      var Transaction = function(){};
      Transaction.prototype.fromBuffer = function() {
        done();
      };
      var messagesCustom = new Messages({Transaction: Transaction});
      var message = messagesCustom.Transaction.fromBuffer();
      should.exist(message);
    });

    it('should work with Transaction.fromBuffer', function(done) {
      var Transaction = sinon.stub();
      Transaction.fromBuffer = function() {
        done();
      };
      var messagesCustom = new Messages({Transaction: Transaction});
      var message = messagesCustom.Transaction.fromBuffer();
      should.exist(message);
    });

  });

  describe('Block', function() {

    it('should be able to pass a custom Block', function(done) {
      var Block = sinon.stub();
      Block.fromBuffer = function() {
        done();
      };
      var messagesCustom = new Messages({Block: Block});
      var message = messagesCustom.Block.fromBuffer();
      should.exist(message);
    });

  });

  describe('GetBlocks', function() {

    it('should error with invalid stop', function() {
      var invalidStop = '000000';
      var starts = ['000000000000000013413cf2536b491bf0988f52e90c476ffeb701c8bfdb1db9'];
      (function() {
        var message = messages.GetBlocks({starts: starts, stop: invalidStop});
        var buffer = message.toBuffer();
        should.not.exist(buffer);
      }).should.throw('Invalid hash length');
    });

  });

  describe('GetHeaders', function() {

    it('should error with invalid stop', function() {
      var invalidStop = '000000';
      var starts = ['000000000000000013413cf2536b491bf0988f52e90c476ffeb701c8bfdb1db9'];
      (function() {
        var message = messages.GetHeaders({starts: starts, stop: invalidStop});
        var buffer = message.toBuffer();
        should.not.exist(buffer);
      }).should.throw('Invalid hash length');
    });

  });

  describe('MerkleBlock', function() {

    it('should return null buffer for payload', function() {
      var message = messages.MerkleBlock();
      var payload = message.getPayload();
      payload.length.should.equal(0);
    });

  });


  describe('Default Magic Number', function() {

    Object.keys(commandsMap).forEach(function(command) {
      it(command, function() {
        var messageConstructor = require('../../../lib/messages/commands/' + command)({});
        var message = new messageConstructor();
        var defaultMagic = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);
        message.magicNumber.should.equal(defaultMagic);
      });
    });

  });

});
