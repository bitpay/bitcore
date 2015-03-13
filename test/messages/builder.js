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
          var message = b.commands.version.fromObject({relay: relay});
          message.relay.should.equal(relay);
          var messageBuf = message.getPayload();
          var newMessage = b.commands.version.fromBuffer(messageBuf);
          newMessage.relay.should.equal(relay);
        });
      });

    });

  });

});
