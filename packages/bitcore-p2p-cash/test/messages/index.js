'use strict';

var chai = require('chai');
var should = chai.should();

var Buffers = require('buffers');
var P2P = require('../../');
var Messages = P2P.Messages;
var messages = new Messages();
var bitcore = require('bitcore-lib-cash');
var Data = require('../data/messages'); //todo merge with commandData
var commandData = require('../data/messages.json');

function getPayloadBuffer(messageBuffer) {
  return Buffer.from(messageBuffer.slice(48), 'hex');
}

describe('Messages', function() {

  var buildMessage = function(hex) {
    var m = Buffers();
    m.push(Buffer.from(hex, 'hex'));
    return m;
  };

  describe('@constructor', function() {
    it('sets properties correctly', function() {
      var network = bitcore.Networks.defaultNetwork;
      var messages = new Messages({
        network: network,
        Block: bitcore.Block,
        Transaction: bitcore.Transaction
      });
      should.exist(messages.builder.commands);
      should.exist(messages.builder.constructors);
      messages.builder.constructors.Block.should.equal(bitcore.Block);
      messages.builder.constructors.Transaction.should.equal(bitcore.Transaction);
      messages.network.should.deep.equal(network);
    });
    it('network should be unique for each set of messages', function() {
      var messages = new Messages({
        network: bitcore.Networks.livenet
      });
      var messages2 = new Messages({
        network: bitcore.Networks.testnet
      });
      messages.network.should.deep.equal(bitcore.Networks.livenet);
      messages2.network.should.deep.equal(bitcore.Networks.testnet);
      var message1 = messages.Version();
      message1.network.should.deep.equal(bitcore.Networks.livenet);
      var message2 = messages2.Version();
      message2.network.should.deep.equal(bitcore.Networks.testnet);
    });
  });

  describe('@constructor for all command messages', function() {
    var messages = new Messages();
    Object.keys(messages.builder.commandsMap).forEach(function(command) {
      var name = messages.builder.commandsMap[command];
      it('message.' + name, function(done) {
        should.exist(messages[name]);
        var message = messages[name]();
        should.exist(message);
        message.should.be.instanceof(messages[name]._constructor);
        done();
      });
    });
  });


  describe('#fromBuffer/#toBuffer round trip for all commands', function() {
    const skipped = ['xversion']; // TODO no fixtures for this yet
    var messages = new Messages();
    Object.keys(messages.builder.commandsMap).forEach(function(command) {
      if (skipped.includes(command)) return;

      var name = messages.builder.commandsMap[command];
      it(name, function(done) {
        var payloadBuffer = getPayloadBuffer(commandData[command].message);
        should.exist(messages[name]);
        var message = messages[name].fromBuffer(payloadBuffer);
        var outputBuffer = message.getPayload();
        outputBuffer.toString('hex').should.equal(payloadBuffer.toString('hex'));
        outputBuffer.should.deep.equal(payloadBuffer);
        var expectedBuffer = Buffer.from(commandData[command].message, 'hex');
        message.toBuffer().should.deep.equal(expectedBuffer);
        done();
      });
    });
  });

  describe('Default Network', function() {
    var messages = new Messages();
    Object.keys(messages.builder.commandsMap).forEach(function(command) {
      var name = messages.builder.commandsMap[command];
      it(name, function() {
        var message = messages[name]();
        message.network.should.deep.equal(bitcore.Networks.defaultNetwork);
      });
    });

  });

  describe('messages.Version', function() {
    var messages = new Messages();
    it('#fromBuffer works w/o fRelay arg', function() {
      var payloadBuffer = getPayloadBuffer(Data.version.messagenofrelay);
      var message = messages.Version.fromBuffer(payloadBuffer);
      message.relay.should.equal(true);
    });

    it('#relay setting works', function() {
      [true, false].forEach(function(relay) {
        var message = messages.Version({
          relay: relay
        });
        message.relay.should.equal(relay);
        var messageBuf = message.getPayload();
        var newMessage = messages.Version.fromBuffer(messageBuf);
        newMessage.relay.should.equal(relay);
      });
    });
  });

  describe('Inventory Helpers', function() {

    var messages = new Messages();

    var constructors = messages.builder.inventoryCommands;
    var fakeHash = 'e2dfb8afe1575bfacae1a0b4afc49af7ddda69285857267bae0e22be15f74a3a';

    describe('#forTransaction', function() {
      constructors.forEach(function(command) {
        var name = messages.builder.commandsMap[command];
        it(name, function() {
          should.exist(messages[name].forTransaction);
          var message = messages[name].forTransaction(fakeHash);
          should.exist(message);
          message.should.be.instanceof(messages[name]._constructor);
        });
      });
    });

    describe('#forBlock', function() {
      constructors.forEach(function(command) {
        var name = messages.builder.commandsMap[command];
        it(name, function() {
          var message = messages[name].forBlock(fakeHash);
          should.exist(message);
          message.should.be.instanceof(messages[name]._constructor);
        });
      });
    });

    describe('#forFilteredBlock', function() {
      constructors.forEach(function(command) {
        var name = messages.builder.commandsMap[command];
        it(name, function() {
          var message = messages[name].forFilteredBlock(fakeHash);
          should.exist(message);
          message.should.be.instanceof(messages[name]._constructor);
        });
      });
    });

  });

  describe('#parseBuffer', function() {
    it('fails with invalid command', function() {
      var invalidCommand = 'e3e1f3e86d616c6963696f757300000025000000bd5e830c' +
        '0102000000ec3995c1bf7269ff728818a65e53af00cbbee6b6eca8ac9ce7bc79d87' +
        '7041ed8';
      var fails = function() {
        var bufs = buildMessage(invalidCommand);
        messages.parseBuffer(bufs);
      };
      fails.should.throw('Unsupported message command: malicious');
    });

    it('ignores malformed messages', function() {
      var malformed1 = 'd8c4c3d976657273696f6e000000000065000000fc970f1772110' +
        '1000100000000000000ba6288540000000001000000000000000000000000000000' +
        '0000ffffba8886dceab0010000000000000000000000000000000000ffff0509552' +
        '2208de7e1c1ef80a1cea70f2f5361746f7368693a302e392e312fa317050001';
      var malformed2 = 'e3e1f3e867657464617461000000000089000000d88134740102' +
        '0000006308e4a380c949dbad182747b0f7b6a89e874328ca41f37287f74a81b8f84' +
        '86d';
      var malformed3 = 'e3e1f3e867657464617461000000000025000000616263640102' +
        '00000069ebcbc34a4f9890da9aea0f773beba883a9afb1ab9ad7647dd4a1cd346c3' +
        '728';
      [malformed1, malformed2, malformed3].forEach(function(malformed) {
        var ret = messages.parseBuffer(buildMessage(malformed));
        should.not.exist(ret);
      });
    });

  });

  describe('#add', function() {
    it('should add a custom message', function() {
      var network = bitcore.Networks.defaultNetwork;
      var messages = new Messages({
        network: network,
        Block: bitcore.Block,
        Transaction: bitcore.Transaction
      });

      var CustomMessage = function(arg, options) {
        this.arg = arg;
      };

      messages.add('custom', 'Custom', CustomMessage);
      should.exist(messages.Custom);

      var message = messages.Custom('hello');
      message.arg.should.equal('hello');
    });
  });

});
