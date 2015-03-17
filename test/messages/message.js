'use strict';

var should = require('chai').should();
var P2P = require('../../');
var Message = P2P.Messages.Message;

describe('Message', function() {

  describe('@constructor', function() {
    it('construct with magic number and command', function() {
      var message = new Message({magicNumber: 0xd9b4bef9, command: 'command'});
      message.command.should.equal('command');
      message.magicNumber.should.equal(0xd9b4bef9);
    });
  });

  describe('#toBuffer', function() {
    it('serialize to a buffer', function() {
      var message = new Message({magicNumber: 0xd9b4bef9, command: 'command'});
      message.getPayload = function() {
        return new Buffer(0);
      };
      var buffer = message.toBuffer();
      var expectedBuffer = new Buffer('f9beb4d9636f6d6d616e640000000000000000005df6e0e2', 'hex');
      buffer.should.deep.equal(expectedBuffer);
    });
  });

});
