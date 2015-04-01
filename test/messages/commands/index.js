'use strict';

var should = require('chai').should();
var P2P = require('../../../');
var Messages = P2P.Messages;
var sinon = require('sinon');
var bitcore = require('bitcore');

describe('Command Messages', function() {

  var messages = new Messages();

  describe('Alert', function() {

    it('should accept a transaction instance as an argument', function() {
      var message = messages.Alert({
        payload: new Buffer('abcdef', 'hex'),
        signature: new Buffer('123456', 'hex')
      });
      message.payload.should.deep.equal(new Buffer('abcdef', 'hex'));
      message.signature.should.deep.equal(new Buffer('123456', 'hex'));
    });

  });

  describe('Transaction', function() {

    it('should accept a transaction instance as an argument', function() {
      var tx = new bitcore.Transaction();
      var message = messages.Transaction(tx);
      message.transaction.should.be.instanceof(bitcore.Transaction);
    });

    it('version should remain the same', function() {
      var tx = new bitcore.Transaction();
      var version = Number(tx.version);
      var message = messages.Transaction(tx);
      message.transaction.version.should.equal(version);
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

    it('should error if filter is not a bloom filter', function() {
      (function() {
        var message = messages.FilterLoad({filter: 'not a bloom filter'});
      }).should.throw('An instance of BloomFilter');
    });

  });

  describe('Inventory', function() {
    it('should error if arg is not an array', function() {
      (function() {
        var message = messages.Inventory({});
      }).should.throw('Argument is expected to be an array of inventory objects');
    });
    it('should not error if arg is an empty array', function() {
      var message = messages.Inventory([]);
    });
    it('should error if arg is not an array of inventory objects', function() {
      (function() {
        var message = messages.Inventory([Number(0)]);
      }).should.throw('Argument is expected to be an array of inventory objects');
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

  describe('Headers', function() {
    it('should error if arg is not an array', function() {
      (function() {
        var message = messages.Headers({});
      }).should.throw('First argument is expected to be an array');
    });
    it('should error if arg is an empty array', function() {
      (function() {
        var message = messages.Headers([]);
      }).should.throw('First argument is expected to be an array');
    });
    it('should error if arg is not an array of BlockHeaders', function() {
      (function() {
        var message = messages.Headers([Number(0)]);
      }).should.throw('First argument is expected to be an array');
    });
  });

  describe('MerkleBlock', function() {

    it('should return null buffer for payload', function() {
      var message = messages.MerkleBlock();
      var payload = message.getPayload();
      payload.length.should.equal(0);
    });

    it('should error if merkleBlock is not a MerkleBlock', function() {
      (function() {
        var message = messages.MerkleBlock({merkleBlock: 'not a merkle block'});
      }).should.throw('An instance of MerkleBlock');
    });
  });

  describe('Version', function() {
    it('should set the default relay property as true', function() {
      var message = messages.Version();
      should.exist(message.relay);
      message.relay.should.equal(true);
    });
    it('should set the relay as false', function() {
      var message = messages.Version({relay: false});
      should.exist(message.relay);
      message.relay.should.equal(false);
    });
    it('should set the relay as true', function() {
      var message = messages.Version({relay: true});
      should.exist(message.relay);
      message.relay.should.equal(true);
    });
  });

});
