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
      var m = Messages.Version.fromBuffer(payload);
      should.exist(m);
    });
  });

  var commands = {
    VerAck: 'verack',
    Inventory: 'inv',
    Addresses: 'addr',
    Ping: 'ping',
    Pong: 'pong',
    Alert: 'alert',
    Reject: 'reject',
    Block: 'block',
    GetBlocks: 'getblocks',
    GetHeaders: 'getheaders',
    GetData: 'getdata',
    GetAddresses: 'getaddr',
    Headers: 'headers',
    Transaction: 'tx'
  };
  // TODO: add data for these 
  var noPayload = ['Alert', 'Reject', 'GetBlocks', 'GetHeaders', 'GetData', 'Headers'];
  var names = Object.keys(commands);
  describe('named', function() {
    names.forEach(function(name) {
      var command = commands[name];
      var data = Data[command.toUpperCase()];
      it('should have data for ' + name, function() {
        should.exist(data);
      });
      describe(name, function() {
        var message = new Messages[name]();
        it('should be able to create instance', function() {
          message.command.should.equal(command);
        });

        it('should be able to serialize the payload', function() {
          var payload = message.getPayload();
          should.exist(payload);
        });

        it('should be able to serialize the message', function() {
          var buffer = message.serialize(Networks.livenet);
          should.exist(buffer);
        });

        if (noPayload.indexOf(name) === -1) {
          it('should be able to parse payload', function() {
            var payload = new Buffer(data.payload, 'hex');
            var m = Messages[name].fromBuffer(payload);
            should.exist(m);
          });
        }
      });
    });
  });

});
