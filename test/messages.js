'use strict';

var chai = require('chai');

var should = chai.should();

var bitcore = require('bitcore');
var Data = require('./data/messages');
var P2P = require('../');
var Messages = P2P.Messages;
var Networks = bitcore.Networks;

describe('Messages', function() {

  describe('Version', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Version();
      message.command.should.equal('version');
      message.version.should.equal(70000);
      var version = require('../package.json').version;
      message.subversion.should.equal('/bitcore:' + version + '/');
      should.exist(message.nonce);
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Version();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Version();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });

    it('should be able to parse payload', function() {
      var payload = new Buffer(Data.VERSION.payload, 'hex');
      new Messages.Version().fromBuffer(payload);
    });
  });

  describe('VerAck', function() {
    it('should be able to create instance', function() {
      var message = new Messages.VerAck();
      message.command.should.equal('verack');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.VerAck();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.VerAck();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });

    it('should be able to parse payload', function() {
      var payload = new Buffer(Data.VERACK.payload, 'hex');
      new Messages.VerAck().fromBuffer(payload);
    });
  });

  describe('Inventory', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Inventory();
      message.command.should.equal('inv');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Inventory();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Inventory();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });

    it('should be able to parse payload', function() {
      var payload = new Buffer(Data.INV.payload, 'hex');
      new Messages.Inventory().fromBuffer(payload);
    });
  });

  describe('Addresses', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Addresses();
      message.command.should.equal('addr');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Addresses();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Addresses();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });

    it('should be able to parse payload', function() {
      var payload = new Buffer(Data.ADDR.payload, 'hex');
      new Messages.Addresses().fromBuffer(payload);
    });
  });

  describe('Ping', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Ping();
      message.command.should.equal('ping');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Ping();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Ping();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });

    it('should be able to parse payload', function() {
      var payload = new Buffer(Data.PING.payload, 'hex');
      new Messages.Ping().fromBuffer(payload);
    });
  });

  describe('Pong', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Pong();
      message.command.should.equal('pong');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Pong();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Pong();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });

    it('should be able to parse payload', function() {
      var payload = new Buffer(Data.PING.payload, 'hex');
      new Messages.Pong().fromBuffer(payload);
    });
  });

  describe('Alert', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Alert();
      message.command.should.equal('alert');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Alert();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Alert();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('Reject', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Reject();
      message.command.should.equal('reject');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Reject();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Reject();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('Block', function() {
    var blockHex = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';
    var block = new bitcore.Block(new Buffer(blockHex, 'hex'));

    it('should be able to create instance', function() {
      var message = new Messages.Block(block);
      message.command.should.equal('block');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Block(block);
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Block(block);
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('GetBlocks', function() {
    it('should be able to create instance', function() {
      var message = new Messages.GetBlocks();
      message.command.should.equal('getblocks');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.GetBlocks();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.GetBlocks();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('GetHeaders', function() {
    it('should be able to create instance', function() {
      var message = new Messages.GetHeaders();
      message.command.should.equal('getheaders');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.GetHeaders();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.GetHeaders();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('GetData', function() {
    it('should be able to create instance', function() {
      var message = new Messages.GetData();
      message.command.should.equal('getdata');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.GetData();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.GetData();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('GetData', function() {
    it('should be able to create instance', function() {
      var message = new Messages.GetData();
      message.command.should.equal('getdata');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.GetData();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.GetData();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('GetAddresses', function() {
    it('should be able to create instance', function() {
      var message = new Messages.GetAddresses();
      message.command.should.equal('getaddr');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.GetAddresses();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.GetAddresses();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('Headers', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Headers();
      message.command.should.equal('headers');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Headers();
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Headers();
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });

  describe('Transaction', function() {
    it('should be able to create instance', function() {
      var message = new Messages.Transaction(new bitcore.Transaction());
      message.command.should.equal('tx');
    });

    it('should be able to serialize the payload', function() {
      var message = new Messages.Transaction(new bitcore.Transaction());
      var payload = message.getPayload();
      should.exist(payload);
    });

    it('should be able to serialize the message', function() {
      var message = new Messages.Transaction(new bitcore.Transaction());
      var buffer = message.serialize(Networks.livenet);
      should.exist(buffer);
    });
  });
});
