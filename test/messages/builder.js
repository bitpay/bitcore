'use strict';

var should = require('chai').should();
var P2P = require('../../');
var builder = P2P.Messages.builder;
var commandData = require('../data/messages.json');
var Data = require('../data/messages');//todo merge with commandData
var bitcore = require('bitcore');

function getPayloadBuffer(messageBuffer) {
  return new Buffer(messageBuffer.slice(48), 'hex');
}

describe('Messages Builder', function() {

  describe('@constructor', function() {

    it('should return commands based on default', function() {
      // instantiate
      var b = builder();
      should.exist(b);
    });

    it('should return commands with customizations', function() {
      // instantiate
      var b = builder({
        magicNumber: 0xd9b4bef9,
        Block: bitcore.Block,
        Transaction: bitcore.Transaction
      });
      should.exist(b);
    });

  });

  describe('Commands', function() {

    var b = builder();

    describe('#fromBuffer/#toBuffer round trip for all commands', function() {
      Object.keys(b.commands).forEach(function(command) {

        it(command, function(done) {
          var payloadBuffer = getPayloadBuffer(commandData[command].message);
          should.exist(b.commands[command]);
          var message = b.commands[command].fromBuffer(payloadBuffer);
          var outputBuffer = message.getPayload();
          outputBuffer.toString('hex').should.equal(payloadBuffer.toString('hex'));
          outputBuffer.should.deep.equal(payloadBuffer);
          var expectedBuffer = new Buffer(commandData[command].message, 'hex');
          message.toBuffer().should.deep.equal(expectedBuffer);
          done();
        });
      });
    });

    describe('version', function() {
      it('#fromBuffer works w/o fRelay arg', function() {
        var payloadBuffer = getPayloadBuffer(Data.version.messagenofrelay);
        var message = b.commands.version.fromBuffer(payloadBuffer);
        message.relay.should.equal(true);
      });

      it('#relay setting works', function() {
        [true,false].forEach(function(relay) {
          var message = new b.commands.version({relay: relay});
          message.relay.should.equal(relay);
          var messageBuf = message.getPayload();
          var newMessage = b.commands.version.fromBuffer(messageBuf);
          newMessage.relay.should.equal(relay);
        });
      });

    });

    describe('Inventory helpers for: ' + b.inventoryCommands.join(', '), function() {

      var constructors = b.inventoryCommands;
      var fakeHash = 'e2dfb8afe1575bfacae1a0b4afc49af7ddda69285857267bae0e22be15f74a3a';

      describe('#forTransaction', function() {
        constructors.forEach(function(name) {
          it(name, function() {
            should.exist(b.commands[name].forTransaction);
            var message = b.commands[name].forTransaction(fakeHash);
            should.exist(message);
            message.should.be.instanceof(b.commands[name]);
          });
        });
      });

      describe('#forBlock', function() {
        constructors.forEach(function(name) {
          it(name, function() {
            var message = b.commands[name].forBlock(fakeHash);
            should.exist(message);
            message.should.be.instanceof(b.commands[name]);
          });
        });
      });

      describe('#forFilteredBlock', function() {
        constructors.forEach(function(name) {
          it(name, function() {
            var message = b.commands[name].forFilteredBlock(fakeHash);
            should.exist(message);
            message.should.be.instanceof(b.commands[name]);
          });
        });
      });

    });
  });
});
