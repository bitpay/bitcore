'use strict';

var chai = chai || require('chai');
var should = chai.should();
var expect = chai.expect;
var bitcore = require('..');
var URI = bitcore.URI;

describe('URI', function() {

  it('should parse uris strings', function() {
    var uri;

    URI.parse.bind(URI, 'badURI').should.throw(TypeError);

    uri = URI.parse('bitcoin:');
    expect(uri.address).to.be.undefined;
    expect(uri.amount).to.be.undefined;
    expect(uri.otherParam).to.be.undefined;

    uri = URI.parse('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.address.should.equal('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    expect(uri.amount).to.be.undefined;
    expect(uri.otherParam).to.be.undefined;

    uri = URI.parse('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=123.22');
    uri.address.should.equal('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.amount.should.equal('123.22');
    expect(uri.otherParam).to.be.undefined;

    uri = URI.parse('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=123.22&other-param=something&req-extra=param');
    uri.address.should.equal('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.amount.should.equal('123.22');
    uri['other-param'].should.equal('something');
    uri['req-extra'].should.equal('param');
  });

  it('should statically validate uris', function() {
    URI.isValid('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj').should.be.true;
    URI.isValid('bitcoin:mkYY5NRvikVBY1EPtaq9fAFgquesdjqECw').should.be.true;

    URI.isValid('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=1.2').should.be.true;
    URI.isValid('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=1.2&other=param').should.be.true;
    URI.isValid('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=1.2&req-other=param', ['req-other']).should.be.true;
    URI.isValid('bitcoin:mmrqEBJxUCf42vdb3oozZtyz5mKr3Vb2Em?amount=0.1&r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu').should.be.true;

    URI.isValid('bitcoin:').should.be.false;
    URI.isValid('bitcoin:badUri').should.be.false;
    URI.isValid('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=bad').should.be.false;
    URI.isValid('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=1.2&req-other=param').should.be.false;
    URI.isValid('bitcoin:?r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu').should.be.false;
  });

  it('should fail creation with no params', function() {
    (function(){
      new URI();
    }).should.throw(TypeError);
  });

  it('should create instance from bitcoin uri', function() {
    var uri;

    uri = new URI('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal('livenet');

    uri = new URI('bitcoin:mkYY5NRvikVBY1EPtaq9fAFgquesdjqECw');
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal('testnet');

    uri = new URI('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=1.2&other=param');
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    expect(uri.other).to.be.undefined;
    uri.extras.other.should.equal('param');

    (function() {
      new URI('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=1.2&other=param&req-required=param');
    }).should.throw(Error);

    uri = new URI('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=1.2&other=param&req-required=param', ['req-required']);
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    uri.extras.other.should.equal('param');
    uri.extras['req-required'].should.equal('param');
  });

  it('should create instance from object', function() {
    var uri;

    uri = new URI({
      address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal('livenet');

    uri = new URI({
      address: 'mkYY5NRvikVBY1EPtaq9fAFgquesdjqECw'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal('testnet');


    uri = new URI({
      address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj',
      amount: 120000000,
      other: 'param'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    expect(uri.other).to.be.undefined;
    uri.extras.other.should.equal('param');

    (function() {
      new URI({
        address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj',
        'req-required': param
      });
    }).should.throw(Error);

    uri = new URI({
      address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj',
      amount: 120000000,
      other: 'param',
      'req-required': 'param'
    }, ['req-required']);
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    uri.extras.other.should.equal('param');
    uri.extras['req-required'].should.equal('param');
  });

  it('should support double slash scheme', function() {
    var uri = new URI('bitcoin://1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.address.toString().should.equal('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
  });

  it('should support numeric amounts', function() {
    var uri = new URI('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=12.10001');
    expect(uri.amount).to.be.equal(1210001000);
  });

  it('should support extra arguments', function() {
    var uri = new URI('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?message=Donation%20for%20project%20xyz&label=myLabel&other=xD');

    should.exist(uri.message);
    uri.message.should.equal('Donation for project xyz');

    should.exist(uri.label);
    uri.label.should.equal('myLabel');

    should.exist(uri.extras.other);
    uri.extras.other.should.equal('xD');
  });

  it('should generate a valid URI', function() {
    new URI({
      address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj',
    }).toString().should.equal(
      'bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj'
    );

    new URI({
      address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj',
      amount: 110001000,
      message: 'Hello World',
      something: 'else'
    }).toString().should.equal(
      'bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?something=else&amount=1.10001&message=Hello%20World'
    );

  });

  it('should be case insensitive to protocol', function() {
    var uri1 = new URI('bItcOin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    var uri2 = new URI('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');

    uri1.address.toString().should.equal(uri2.address.toString());
  });
});
