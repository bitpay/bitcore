'use strict';

var chai = require('chai');

var should = chai.should();

var bitcore = require('bitcore');
var Data = require('./data/messages');
var P2P = require('../');
var Messages = P2P.Messages;
var Networks = bitcore.Networks;

describe('Messages', function() {

  var commands = {
    Version: 'version',
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
    Transaction: 'tx',
    NotFound: 'notfound'
  };
  // TODO: add data for these 
  var noPayload = ['Alert', 'Reject', 'GetBlocks', 'GetHeaders'];
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
            var m = new Messages[name]().fromBuffer(payload);
            should.exist(m);
          });
        }
      });
    });
  });

});
