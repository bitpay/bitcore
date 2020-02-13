'use strict';

var chai = chai || require('chai');
var bitcore = require('..');
var expect = chai.expect;
var Networks = bitcore.Networks;
var should = chai.should();
var URI = bitcore.URI;

describe('URI', function() {
  /* jshint maxstatements: 30 */

  // TODO: Split this and explain tests
  it('parses uri strings correctly (test vector)', function() {
    var uri;

    URI.parse.bind(URI, 'badURI').should.throw(TypeError);

    uri = URI.parse('litecoin:');
    expect(uri.address).to.be.undefined;
    expect(uri.amount).to.be.undefined;
    expect(uri.otherParam).to.be.undefined;

    uri = URI.parse('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
    uri.address.should.equal('LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
    expect(uri.amount).to.be.undefined;
    expect(uri.otherParam).to.be.undefined;

    uri = URI.parse('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=123.22');
    uri.address.should.equal('LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
    uri.amount.should.equal('123.22');
    expect(uri.otherParam).to.be.undefined;

    uri = URI.parse('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=123.22' +
                    '&other-param=something&req-extra=param');
    uri.address.should.equal('LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
    uri.amount.should.equal('123.22');
    uri['other-param'].should.equal('something');
    uri['req-extra'].should.equal('param');
  });

  // TODO: Split this and explain tests
  it('URIs can be validated statically (test vector)', function() {
    URI.isValid('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3').should.equal(true);
    URI.isValid('litecoin:mkYY5NRvikVBY1EPtaq9fAFgquesdjqECw').should.equal(true);

    URI.isValid('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=1.2')
                .should.equal(true);
    URI.isValid('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=1.2&other=param')
                .should.equal(true);
    URI.isValid('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=1.2&req-other=param',
                ['req-other']).should.equal(true);
    URI.isValid('litecoin:mmrqEBJxUCf42vdb3oozZtyz5mKr3Vb2Em?amount=0.1&' +
                'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu').should.equal(true);

    URI.isValid('litecoin:').should.equal(false);
    URI.isValid('litecoin:badUri').should.equal(false);
    URI.isValid('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=bad').should.equal(false);
    URI.isValid('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=1.2&req-other=param')
                .should.equal(false);
    URI.isValid('litecoin:?r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu')
                .should.equal(false);
  });

  it('fails on creation with no params', function() {
    (function(){
      return new URI();
    }).should.throw(TypeError);
  });

  it('do not need new keyword', function() {
    var uri = URI('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
    uri.should.be.instanceof(URI);
  });

  describe('instantiation from litecoin uri', function() {
    /* jshint maxstatements: 25 */
    var uri;

    it('parses address', function() {
      uri = new URI('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
      uri.address.should.be.instanceof(bitcore.Address);
      uri.network.should.equal(Networks.livenet);
    });

    it('parses amount', function() {
      uri = URI.fromString('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=123.22');
      uri.address.toString().should.equal('LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
      uri.amount.should.equal(12322000000);
      expect(uri.otherParam).to.be.undefined;
    });

    it('parses a testnet address', function() {
      uri = new URI('litecoin:mkYY5NRvikVBY1EPtaq9fAFgquesdjqECw');
      uri.address.should.be.instanceof(bitcore.Address);
      uri.network.should.equal(Networks.testnet);
    });

    it('stores unknown parameters as "extras"', function() {
      uri = new URI('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=1.2&other=param');
      uri.address.should.be.instanceof(bitcore.Address);
      expect(uri.other).to.be.undefined;
      uri.extras.other.should.equal('param');
    });

    it('throws error when a required feature is not supported', function() {
      (function() {
        return new URI('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=1.2&other=param&req-required=param');
      }).should.throw(Error);
    });

    it('has no false negative when checking supported features', function() {
      uri = new URI('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=1.2&other=param&' +
                    'req-required=param', ['req-required']);
      uri.address.should.be.instanceof(bitcore.Address);
      uri.amount.should.equal(120000000);
      uri.extras.other.should.equal('param');
      uri.extras['req-required'].should.equal('param');
    });
  });

  // TODO: Split this and explain tests
  it('should create instance from object', function() {
    /* jshint maxstatements: 25 */
    var uri;

    uri = new URI({
      address: 'LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal(Networks.livenet);

    uri = new URI({
      address: 'mkYY5NRvikVBY1EPtaq9fAFgquesdjqECw'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal(Networks.testnet);

    uri = new URI({
      address: 'LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3',
      amount: 120000000,
      other: 'param'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    expect(uri.other).to.be.undefined;
    uri.extras.other.should.equal('param');

    (function() {
      return new URI({
        address: 'LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3',
        'req-required': 'param'
      });
    }).should.throw(Error);

    uri = new URI({
      address: 'LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3',
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
    var uri = new URI('litecoin://LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
    uri.address.toString().should.equal('LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
  });

  it('should input/output String', function() {
    var str = 'litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?' +
              'message=Donation%20for%20project%20xyz&label=myLabel&other=xD';
    URI.fromString(str).toString().should.equal(str);
  });

  it('should input/output JSON', function() {
    var json = JSON.stringify({
      address: 'LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3',
      message: 'Donation for project xyz',
      label: 'myLabel',
      other: 'xD'
    });
    JSON.stringify(URI.fromObject(JSON.parse(json))).should.equal(json);
  });

  it('should support numeric amounts', function() {
    var uri = new URI('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=12.10001');
    expect(uri.amount).to.be.equal(1210001000);
  });

  it('should support extra arguments', function() {
    var uri = new URI('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?' +
                      'message=Donation%20for%20project%20xyz&label=myLabel&other=xD');

    should.exist(uri.message);
    uri.message.should.equal('Donation for project xyz');

    should.exist(uri.label);
    uri.label.should.equal('myLabel');

    should.exist(uri.extras.other);
    uri.extras.other.should.equal('xD');
  });

  it('should generate a valid URI', function() {
    new URI({
      address: 'LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3',
    }).toString().should.equal(
      'litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3'
    );

    new URI({
      address: 'LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3',
      amount: 110001000,
      message: 'Hello World',
      something: 'else'
    }).toString().should.equal(
      'litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3?amount=1.10001&message=Hello%20World&something=else'
    );

  });

  it('should be case insensitive to protocol', function() {
    var uri1 = new URI('lItEcOin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');
    var uri2 = new URI('litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3');

    uri1.address.toString().should.equal(uri2.address.toString());
  });

  it('writes correctly the "r" parameter on string serialization', function() {
    var originalString = 'litecoin:mmrqEBJxUCf42vdb3oozZtyz5mKr3Vb2Em?amount=0.1&' +
                         'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu';
    var uri = new URI(originalString);
    uri.toString().should.equal(originalString);
  });

  it('displays nicely on the console (#inspect)', function() {
    var uri = 'litecoin:LXc3QtfC179bxQV83r3XaFKfsgXsKGeZv3';
    var instance = new URI(uri);
    instance.inspect().should.equal('<URI: ' + uri + '>');
  });

  it('fails early when fromString isn\'t provided a string', function() {
    expect(function() {
      return URI.fromString(1);
    }).to.throw();
  });

  it('fails early when fromJSON isn\'t provided a valid JSON string', function() {
    expect(function() {
      return URI.fromJSON('¹');
    }).to.throw();
  });
});
