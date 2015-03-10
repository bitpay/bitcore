'use strict';

var should = require('chai').should();
var P2P = require('../');
var Commands = P2P.Commands;
var commandData = require('./data/messages.json');
var Data = require('./data/messages');//todo merge with commandData
var bitcore = require('bitcore');

function getPayloadBuffer(messageBuffer) {
  return new Buffer(messageBuffer.slice(48), 'hex');
}

describe('P2P Command Builder', function() {

  describe('@constructor', function() {

    it('should return commands based on default', function() {
      // instantiate
      var commands = new Commands();
      should.exist(commands);
    });

    it('should return commands with customizations', function() {
      // instantiate
      var commands = new Commands({
        magicNumber: 0xd9b4bef9,
        Block: bitcore.Block,
        Transaction: bitcore.Transaction
      });
      should.exist(commands);
    });

  });

  describe('Commands', function() {

    var commands = new Commands();

    describe('#fromBuffer/#toBuffer round trip for all commands', function() {
      Object.keys(commands).forEach(function(command) {

        it('should round trip buffers for command: ' + command, function(done) {
          var payloadBuffer = getPayloadBuffer(commandData[command].message);
          should.exist(commands[command]);
          var message = commands[command].fromBuffer(payloadBuffer);
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
        var message = commands.version.fromBuffer(payloadBuffer);
        message.relay.should.equal(true);
      });

      it('#relay setting works', function() {
        [true,false].forEach(function(relay) {
          var message = commands.version.fromObject({relay: relay});
          message.relay.should.equal(relay);
          var messageBuf = message.getPayload();
          var newMessage = commands.version.fromBuffer(messageBuf);
          newMessage.relay.should.equal(relay);
        });
      });

    });

  });

});
