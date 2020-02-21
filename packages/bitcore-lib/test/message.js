'use strict';

/* jshint maxstatements: 30 */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

var bitcore = require('..');
var Address = bitcore.Address;
var Signature = bitcore.crypto.Signature;
var Message = require('../lib/message');

describe('Message', function() {

  var address = 'n1ZCYg9YXtB5XCZazLxSmPDa8iwJRZHhGx';
  var badAddress = 'mmRcrB5fTwgxaFJmVLNtaG8SV454y1E3kC';
  var privateKey = bitcore.PrivateKey.fromWIF('cPBn5A4ikZvBTQ8D7NnvHZYCAxzDZ5Z2TSGW2LkyPiLxqYaJPBW4');
  var text = 'hello, world';
  var signatureString = 'H/DIn8uA1scAuKLlCx+/9LnAcJtwQQ0PmcPrJUq90aboLv3fH5fFvY+vmbfOSFEtGarznYli6ShPr9RXwY9UrIY=';

  var badSignatureString = 'H69qZ4mbZCcvXk7CWjptD5ypnYVLvQ3eMXLM8+1gX21SLH/GaFnAjQrDn37+TDw79i9zHhbiMMwhtvTwnPigZ6k=';

  var signature = Signature.fromCompact(Buffer.from(signatureString, 'base64'));
  var badSignature = Signature.fromCompact(Buffer.from(badSignatureString, 'base64'));

  var publicKey = privateKey.toPublicKey();

  it('will error with incorrect message type', function() {
    expect(function() {
      return new Message(new Date());
    }).to.throw('First argument should be a string');
  });

  it('will instantiate without "new"', function() {
    var message = Message(text);
    should.exist(message);
  });

  var signature2;
  var signature3;

  it('can sign a message', function() {
    var message2 = new Message(text);
    signature2 = message2._sign(privateKey);
    signature3 = Message(text).sign(privateKey);
    should.exist(signature2);
    should.exist(signature3);
  });

  it('sign will error with incorrect private key argument', function() {
    expect(function() {
      var message3 = new Message(text);
      return message3.sign('not a private key');
    }).to.throw('First argument should be an instance of PrivateKey');
  });

  it('can verify a message with signature', function() {
    var message4 = new Message(text);
    var verified = message4._verify(publicKey, signature2);
    verified.should.equal(true);
  });

  it('can verify a message with existing signature', function() {
    var message5 = new Message(text);
    var verified = message5._verify(publicKey, signature);
    verified.should.equal(true);
  });

  it('verify will error with incorrect public key argument', function() {
    expect(function() {
      var message6 = new Message(text);
      return message6._verify('not a public key', signature);
    }).to.throw('First argument should be an instance of PublicKey');
  });

  it('verify will error with incorrect signature argument', function() {
    expect(function() {
      var message7 = new Message(text);
      return message7._verify(publicKey, 'not a signature');
    }).to.throw('Second argument should be an instance of Signature');
  });

  it('verify will correctly identify a bad signature', function() {
    var message8 = new Message(text);
    var verified = message8._verify(publicKey, badSignature);
    should.exist(message8.error);
    verified.should.equal(false);
  });

  it('can verify a message with address and generated signature string', function() {
    var message9 = new Message(text);
    var verified = message9.verify(address, signature3);
    should.not.exist(message9.error);
    verified.should.equal(true);
  });

  it('will not verify with address mismatch', function() {
    var message10 = new Message(text);
    var verified = message10.verify(badAddress, signatureString);
    should.exist(message10.error);
    verified.should.equal(false);
  });

  it('will verify with an uncompressed pubkey', function() {
    var privateKey = new bitcore.PrivateKey('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss');
    var message = new Message('This is an example of a signed message.');
    var signature = message.sign(privateKey);
    var verified = message.verify(privateKey.toAddress(), signature);
    verified.should.equal(true);
  });

  it('can chain methods', function() {
    var verified = Message(text).verify(address, signatureString);
    verified.should.equal(true);
  });

  describe('#json', function() {

    it('roundtrip to-from-to', function() {
      var json = new Message(text).toJSON();
      var message = Message.fromJSON(json);
      message.toString().should.equal(text);
    });

    it('checks that the string parameter is valid JSON', function() {
      expect(function() {
        return Message.fromJSON('¹');
      }).to.throw();
    });

  });

  describe('#toString', function() {

    it('message string', function() {
      var message = new Message(text);
      message.toString().should.equal(text);
    });

    it('roundtrip to-from-to', function() {
      var str = new Message(text).toString();
      var message = Message.fromString(str);
      message.toString().should.equal(text);
    });

  });

  describe('#inspect', function() {

    it('should output formatted output correctly', function() {
      var message = new Message(text);
      var output = '<Message: '+text+'>';
      message.inspect().should.equal(output);
    });

  });


  it('accepts Address for verification', function() {
    var verified = Message(text)
      .verify(new Address(address), signatureString);
    verified.should.equal(true);
  });

});
