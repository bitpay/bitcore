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

    uri = URI.parse('payto:');
    expect(uri.address).to.be.equal(undefined);
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);


    uri = URI.parse('payto:lotus_16PSJLk9W86KAZp26x3uM176w6N9vUU8YNQQnQTHN');
    uri.address.should.equal('lotus_16PSJLk9W86KAZp26x3uM176w6N9vUU8YNQQnQTHN');
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M?amount=123.22');
    uri.address.should.equal('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
    uri.amount.should.equal('123.22');
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('payto:lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M?amount=123.22' +
                    '&other-param=something&req-extra=param');
    uri.address.should.equal('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
    uri.amount.should.equal('123.22');
    uri['other-param'].should.equal('something');
    uri['req-extra'].should.equal('param');
  });

  // TODO: Split this and explain tests
  it('parses uri strings correctly for testnet network (test vector)', function() {
    var uri;

    URI.parse.bind(URI, 'badURI').should.throw(TypeError);

    uri = URI.parse('bchtest:');
    expect(uri.address).to.be.equal(undefined);
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
    uri.address.should.equal('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M?amount=123.22');
    uri.address.should.equal('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
    uri.amount.should.equal('123.22');
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M?amount=123.22' +
                    '&other-param=something&req-extra=param');
    uri.address.should.equal('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
    uri.amount.should.equal('123.22');
    uri['other-param'].should.equal('something');
    uri['req-extra'].should.equal('param');
  });

  it('Should return error if try to use an invalid bitcoin URI', function() {
    var uri;

    try {
      uri = URI.parse('lotus+1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
    } catch (e) {
        expect(e.message).to.equal('Invalid bitcoin URI');
    }
  });

  describe('xaddr', function() {
    URI.parse.bind(URI, 'badURI').should.throw(TypeError);

    // cashaddr
    it('address only', function() {
      var uri;
      var str = 'lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M';
      uri = URI.parse(str);
      uri.address.should.equal('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
      expect(uri.amount).to.be.equal(undefined);
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });

    it('address +amount', function() {
      var uri;
      var str = 'lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M?amount=123.22';
      uri = URI.parse(str);
      uri.address.should.equal('lotus_1PrRKWfK2D6rp5hPpgcb19MsZn3RR8rQFsMX1M');
      uri.amount.should.equal('123.22');
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });


    it('address +amount + opts', function() {
      var uri;
      var str = 'lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      URI.isValid(str).should.equal(false);
    });


    it('address +amount + opts', function() {
      var uri;
      var str = 'lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(false);
    });

    it('address +amount + opts', function() {
      var uri;
      var str = 'lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs?amount=123.22' +
                    '&message=Donation%20for%20project%20xyz&label=myLabel';
      uri = URI.parse(str);
      uri.address.should.equal('lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs');
      uri.amount.should.equal('123.22');
      uri.label.should.equal('myLabel');
      uri.message.should.equal('Donation for project xyz');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(true);
    });
  });

  // TODO: Split this and explain tests
  it('URIs can be validated statically (test vector)', function() {
    URI.isValid('lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV').should.equal(true);

    URI.isValid('lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV?amount=1.2')
                .should.equal(true);
    URI.isValid('lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV?amount=1.2&other=param')
                .should.equal(true);
    URI.isValid('lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV?amount=1.2&req-other=param',
                ['req-other']).should.equal(true);
    URI.isValid('lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV?amount=0.1&' +
                'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu').should.equal(true);

    URI.isValid('payto:').should.equal(false);
    URI.isValid('payto:badUri').should.equal(false);
    URI.isValid('payto:lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV?amount=bad').should.equal(false);
    URI.isValid('payto:lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV?amount=1.2&req-other=param')
                .should.equal(false);
    URI.isValid('payto:?r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu')
                .should.equal(false);
  });

  // TODO: Split this and explain tests
  it('URIs can be validated statically (test vector)', function() {
    URI.isValid('lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og').should.equal(true);

    URI.isValid('lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og?amount=1.2')
                .should.equal(true);
    URI.isValid('lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og?amount=1.2&other=param')
                .should.equal(true);
    URI.isValid('lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og?amount=1.2&req-other=param',
                ['req-other']).should.equal(true);

    // URI.isValid('bchtest:').should.equal(false);
    // URI.isValid('bchtest:badUri').should.equal(false);
    // URI.isValid('bchtest:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=bad').should.equal(false);
    // URI.isValid('bchtest:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=1.2&req-other=param')
    //             .should.equal(false);
    // URI.isValid('bchtest:?r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu')
    //             .should.equal(false);
  });

  it('fails on creation with no params', function() {
    (function(){
      return new URI();
    }).should.throw(TypeError);
  });

  it('do not need new keyword', function() {
    var uri = URI('lotus_1PrQAo6rZSfDwo8R6V8YnEkyjShiWqMuE6M6GV');
    uri.should.be.instanceof(URI);
  });

  it('do not need new keyword for testnet', function() {
    var uri = URI('lotus_1PrQAo6rZSfDwo8R6V8YnEkyjShiWqMuE6M6GV');
    uri.should.be.instanceof(URI);
  });

  describe('instantiation from bitcoin uri', function() {
    /* jshint maxstatements: 25 */
    var uri;

    it('parses address', function() {
      uri = new URI('lotus_1PrQAo6rZSfDwo8R6V8YnEkyjShiWqMuE6M6GV');
      uri.address.should.be.instanceof(bitcore.Address);
      uri.network.should.equal(Networks.livenet);
    });

    it('parses amount', function() {
      uri = URI.fromString('lotus_1PrQAo6rZSfDwo8R6V8YnEkyjShiWqMuE6M6GV?amount=123.22');
      uri.address.toString().should.equal('lotus_1PrQAo6rZSfDwo8R6V8YnEkyjShiWqMuE6M6GV');
      uri.amount.should.equal(123220000);
      expect(uri.otherParam).to.be.equal(undefined);
    });

    it('stores unknown parameters as "extras"', function() {
      uri = new URI('lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og?amount=1.2&other=param');
      uri.address.should.be.instanceof(bitcore.Address);
      expect(uri.other).to.be.equal(undefined);
      uri.extras.other.should.equal('param');
    });

    it('throws error when a required feature is not supported', function() {
      (function() {
        return new URI('lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og?amount=1.2&other=param&req-required=param');
      }).should.throw(Error);
    });

    it('has no false negative when checking supported features', function() {
      uri = new URI('lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og?amount=1.2&other=param&' +
                    'req-required=param', ['req-required']);
      uri.address.should.be.instanceof(bitcore.Address);
      uri.amount.should.equal(1200000);
      uri.extras.other.should.equal('param');
      uri.extras['req-required'].should.equal('param');
    });
  });

  // describe('instantiation from bitcoin uri for testnet', function() {
  //   /* jshint maxstatements: 25 */
  //   var uri;

  //   it('parses a testnet address', function() {
  //     uri = new URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
  //     uri.address.should.be.instanceof(bitcore.Address);
  //     uri.network.should.equal(Networks.testnet);
  //   });

  //   it('parses amount', function() {
  //     uri = URI.fromString('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=123.22');
  //     uri.address.toString().should.equal('lotusT16PSJJVhZeTDKVaZdpW3voH7GvDXgVdYNVWAzVvye');
  //     uri.amount.should.equal(12322000000);
  //     expect(uri.otherParam).to.be.equal(undefined);
  //   });

  //   it('stores unknown parameters as "extras"', function() {
  //     uri = new URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2&other=param');
  //     uri.address.should.be.instanceof(bitcore.Address);
  //     expect(uri.other).to.be.equal(undefined);
  //     uri.extras.other.should.equal('param');
  //   });

  //   it('throws error when a required feature is not supported', function() {
  //     (function() {
  //       return new URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2&other=param&req-required=param');
  //     }).should.throw(Error);
  //   });

  //   it('has no false negative when checking supported features', function() {
  //     uri = new URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2&other=param&' +
  //                   'req-required=param', ['req-required']);
  //     uri.address.should.be.instanceof(bitcore.Address);
  //     uri.amount.should.equal(120000000);
  //     uri.extras.other.should.equal('param');
  //     uri.extras['req-required'].should.equal('param');
  //   });
  // });

  // TODO: Split this and explain tests
  it('should create instance from object', function() {
    /* jshint maxstatements: 25 */
    var uri;

    uri = new URI({
      address: 'lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal(Networks.livenet);

    uri = new URI({
      address: 'lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal(Networks.livenet);

    uri = new URI({
      address: 'lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og',
      amount: 120000000,
      other: 'param'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    expect(uri.other).to.be.equal(undefined);
    uri.extras.other.should.equal('param');

    (function() {
      return new URI({
        address: 'lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og',
        'req-required': 'param'
      });
    }).should.throw(Error);

    uri = new URI({
      address: 'lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og',
      amount: 120000000,
      other: 'param',
      'req-required': 'param'
    }, ['req-required']);
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    uri.extras.other.should.equal('param');
    uri.extras['req-required'].should.equal('param');
  });

  it('should input/output JSON', function() {
    var json = JSON.stringify({
      address: 'lotus_16PSJMGfT7DYsDKPmvPDFpXWShE4Wpug8VYGD5r2u',
      message: 'Donation for project xyz',
      label: 'myLabel',
      other: 'xD'
    });
    JSON.stringify(URI.fromObject(JSON.parse(json))).should.equal(json);
  });

  it('should support numeric amounts', function() {
    var uri = new URI('lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs?amount=12.10001');
    expect(uri.amount).to.be.equal(12100010);
  });

  it('should generate a valid URI', function() {
    new URI({
      address: 'lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs',
    }).toString().should.equal(
      'payto:lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs'
    );

    new URI({
      address: 'lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV',
      amount: 110001000,
      message: 'Hello World',
      something: 'else'
    }).toString().should.equal(
      'payto:lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV?amount=110.001&message=Hello%20World&something=else'
    );

  });

  it('should be case insensitive to protocol', function() {
    var uri1 = new URI('lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV');
    var uri2 = new URI('lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV');

    uri1.address.toString().should.equal(uri2.address.toString());
  });

  it('displays nicely on the console (#inspect)', function() {
    var uri = 'lotus_1PrQz5R11Ae1YcbvUpGDSvzPP2GsVw6E7mthMV';
    var instance = new URI(uri);
    instance.inspect().should.equal('<URI: payto:' + uri + '>');
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
