'use strict';

var chai = require('chai');
var should = chai.should();

var Buffers = require('buffers');
var P2P = require('../../');
var Messages = P2P.Messages;
var messages = new Messages();
var bitcore = require('bitcore');

describe('Messages', function() {

  var buildMessage = function(hex) {
    var m = Buffers();
    m.push(new Buffer(hex, 'hex'));
    return m;
  };

  describe('@constructor', function() {
    it('sets properties correctly', function() {
      var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);
      var messages = new Messages({
        magicNumber: magicNumber,
        Block: bitcore.Block,
        Transaction: bitcore.Transaction
      });
      should.exist(messages.builder.commands);
      should.exist(messages.builder.constructors);
      messages.builder.constructors.Block.should.equal(bitcore.Block);
      messages.builder.constructors.Transaction.should.equal(bitcore.Transaction);
      messages.magicNumber.should.equal(magicNumber);
    });
  });

  describe('@constructor for all command messages', function() {
    var messages = new Messages();
    Object.keys(messages.builder.commandsMap).forEach(function(command) {
      var name = messages.builder.commandsMap[command];
      it('message.' + name, function(done) {
        should.exist(messages[name]);
        messages[name].super_.should.equal(Messages.Message);
        var message = messages[name]();
        should.exist(message);
        message.should.be.instanceof(messages[name]);
        done();
      });
    });
  });

  describe('#parseBuffer', function() {
    it('fails with invalid command', function() {
      var invalidCommand = 'f9beb4d96d616c6963696f757300000025000000bd5e830c' +
        '0102000000ec3995c1bf7269ff728818a65e53af00cbbee6b6eca8ac9ce7bc79d87' +
        '7041ed8';
      var fails = function() {
        messages.parseBuffer(buildMessage(invalidCommand));
      };
      fails.should.throw('Unsupported message command: malicious');
    });

    it('ignores malformed messages', function() {
      var malformed1 = 'd8c4c3d976657273696f6e000000000065000000fc970f1772110' +
        '1000100000000000000ba6288540000000001000000000000000000000000000000' +
        '0000ffffba8886dceab0010000000000000000000000000000000000ffff0509552' +
        '2208de7e1c1ef80a1cea70f2f5361746f7368693a302e392e312fa317050001';
      var malformed2 = 'f9beb4d967657464617461000000000089000000d88134740102' +
        '0000006308e4a380c949dbad182747b0f7b6a89e874328ca41f37287f74a81b8f84' +
        '86d';
      var malformed3 = 'f9beb4d967657464617461000000000025000000616263640102' +
        '00000069ebcbc34a4f9890da9aea0f773beba883a9afb1ab9ad7647dd4a1cd346c3' +
        '728';
      [malformed1, malformed2, malformed3].forEach(function(malformed) {
        var ret = messages.parseBuffer(buildMessage(malformed));
        should.not.exist(ret);
      });
    });

  });

});
