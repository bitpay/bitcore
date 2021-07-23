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

    uri = URI.parse('ecash:');
    expect(uri.address).to.be.equal(undefined);
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);


    uri = URI.parse('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
    uri.address.should.equal('qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=123.22');
    uri.address.should.equal('qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
    uri.amount.should.equal('123.22');
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=123.22' +
                    '&other-param=something&req-extra=param');
    uri.address.should.equal('qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
    uri.amount.should.equal('123.22');
    uri['other-param'].should.equal('something');
    uri['req-extra'].should.equal('param');
  });

  // TODO: Split this and explain tests
  it('parses uri strings correctly for testnet network (test vector)', function() {
    var uri;

    URI.parse.bind(URI, 'badURI').should.throw(TypeError);

    uri = URI.parse('ectest:');
    expect(uri.address).to.be.equal(undefined);
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
    uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=123.22');
    uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
    uri.amount.should.equal('123.22');
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=123.22' +
                    '&other-param=something&req-extra=param');
    uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
    uri.amount.should.equal('123.22');
    uri['other-param'].should.equal('something');
    uri['req-extra'].should.equal('param');
  });

  it('Should return error if try to use an invalid bitcoin URI', function() {
    var uri;

    try {
      uri = URI.parse('badprefix:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
    } catch (e) {
        expect(e.message).to.equal('Invalid bitcoin URI');
    }
  });

  describe('cashaddr', function() {
    URI.parse.bind(URI, 'badURI').should.throw(TypeError);

    // cashaddr
    it('address only', function() {
      var uri;
      var str = 'ecash:qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl');
      expect(uri.amount).to.be.equal(undefined);
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });

    it('address +amount', function() {
      var uri;
      var str = 'ecash:qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl?amount=123.22';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl');
      uri.amount.should.equal('123.22');
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });


    it('address +amount + opts', function() {
      var uri;
      var str = 'ecash:qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      URI.isValid(str).should.equal(false);
    });


    it('address +amount + opts', function() {
      var uri;
      var str = 'ecash:qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(false);
    });

    it('address +amount + opts', function() {
      var uri;
      var str = 'ecash:qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl?amount=123.22' +
                    '&message=Donation%20for%20project%20xyz&label=myLabel';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6sh9z7xcrl');
      uri.amount.should.equal('123.22');
      uri.label.should.equal('myLabel');
      uri.message.should.equal('Donation for project xyz');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(true);
    });
  });

  describe('cashaddr for testnet', function() {
    URI.parse.bind(URI, 'badURI').should.throw(TypeError);

    // cashaddr
    it('address only', function() {
      var uri;
      var str = 'ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
      expect(uri.amount).to.be.equal(undefined);
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });

    it('address +amount', function() {
      var uri;
      var str = 'ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=123.22';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
      uri.amount.should.equal('123.22');
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });


    it('address +amount + opts', function() {
      var uri;
      var str = 'ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      URI.isValid(str).should.equal(false);
    });

    it('address +amount + opts', function() {
      var uri;
      var str = 'ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(false);
    });

    it('address +amount + opts', function() {
      var uri;
      var str = 'ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=123.22' +
                    '&message=Donation%20for%20project%20xyz&label=myLabel';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
      uri.amount.should.equal('123.22');
      uri.label.should.equal('myLabel');
      uri.message.should.equal('Donation for project xyz');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(true);
    });

  });



  // TODO: Split this and explain tests
  it('URIs can be validated statically (test vector)', function() {
    URI.isValid('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv').should.equal(true);

    URI.isValid('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=1.2')
                .should.equal(true);
    URI.isValid('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=1.2&other=param')
                .should.equal(true);
    URI.isValid('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=1.2&req-other=param',
                ['req-other']).should.equal(true);
    URI.isValid('ecash:mmrqEBJxUCf42vdb3oozZtyz5mKr3Vb2Em?amount=0.1&' +
                'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu').should.equal(true);

    URI.isValid('ecash:').should.equal(false);
    URI.isValid('ecash:badUri').should.equal(false);
    URI.isValid('ecash:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=bad').should.equal(false);
    URI.isValid('ecash:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=1.2&req-other=param')
                .should.equal(false);
    URI.isValid('ecash:?r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu')
                .should.equal(false);
  });

  // TODO: Split this and explain tests
  it('URIs can be validated statically (test vector)', function() {
    URI.isValid('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu').should.equal(true);

    URI.isValid('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=1.2')
                .should.equal(true);
    URI.isValid('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=1.2&other=param')
                .should.equal(true);
    URI.isValid('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=1.2&req-other=param',
                ['req-other']).should.equal(true);
    URI.isValid('ectest:mmrqEBJxUCf42vdb3oozZtyz5mKr3Vb2Em?amount=0.1&' +
                'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu').should.equal(true);

    URI.isValid('ectest:').should.equal(false);
    URI.isValid('ectest:badUri').should.equal(false);
    URI.isValid('ectest:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=bad').should.equal(false);
    URI.isValid('ectest:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=1.2&req-other=param')
                .should.equal(false);
    URI.isValid('ectest:?r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu')
                .should.equal(false);
  });

  it('fails on creation with no params', function() {
    (function(){
      return new URI();
    }).should.throw(TypeError);
  });

  it('do not need new keyword', function() {
    var uri = URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
    uri.should.be.instanceof(URI);
  });

  it('do not need new keyword for testnet', function() {
    var uri = URI('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
    uri.should.be.instanceof(URI);
  });

  describe('instantiation from bitcoin uri', function() {
    /* jshint maxstatements: 25 */
    var uri;

    it('parses address', function() {
      uri = new URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
      uri.address.should.be.instanceof(bitcore.Address);
      uri.network.should.equal(Networks.livenet);
    });

    it('parses amount', function() {
      uri = URI.fromString('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=123.22');
      uri.address.toString().should.equal('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
      uri.amount.should.equal(12322000000);
      expect(uri.otherParam).to.be.equal(undefined);
    });

    it('stores unknown parameters as "extras"', function() {
      uri = new URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=1.2&other=param');
      uri.address.should.be.instanceof(bitcore.Address);
      expect(uri.other).to.be.equal(undefined);
      uri.extras.other.should.equal('param');
    });

    it('throws error when a required feature is not supported', function() {
      (function() {
        return new URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=1.2&other=param&req-required=param');
      }).should.throw(Error);
    });

    it('has no false negative when checking supported features', function() {
      uri = new URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=1.2&other=param&' +
                    'req-required=param', ['req-required']);
      uri.address.should.be.instanceof(bitcore.Address);
      uri.amount.should.equal(120000000);
      uri.extras.other.should.equal('param');
      uri.extras['req-required'].should.equal('param');
    });
  });

  describe('instantiation from bitcoin uri for testnet', function() {
    /* jshint maxstatements: 25 */
    var uri;

    it('parses a testnet address', function() {
      uri = new URI('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
      uri.address.should.be.instanceof(bitcore.Address);
      uri.network.should.equal(Networks.testnet);
    });

    it('parses amount', function() {
      uri = URI.fromString('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=123.22');
      uri.address.toString().should.equal('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
      uri.amount.should.equal(12322000000);
      expect(uri.otherParam).to.be.equal(undefined);
    });

    it('stores unknown parameters as "extras"', function() {
      uri = new URI('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=1.2&other=param');
      uri.address.should.be.instanceof(bitcore.Address);
      expect(uri.other).to.be.equal(undefined);
      uri.extras.other.should.equal('param');
    });

    it('throws error when a required feature is not supported', function() {
      (function() {
        return new URI('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=1.2&other=param&req-required=param');
      }).should.throw(Error);
    });

    it('has no false negative when checking supported features', function() {
      uri = new URI('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?amount=1.2&other=param&' +
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
      address: 'qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal(Networks.livenet);

    uri = new URI({
      address: 'qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal(Networks.testnet);

    uri = new URI({
      address: 'qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv',
      amount: 120000000,
      other: 'param'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    expect(uri.other).to.be.equal(undefined);
    uri.extras.other.should.equal('param');

    (function() {
      return new URI({
        address: 'ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv',
        'req-required': 'param'
      });
    }).should.throw(Error);

    uri = new URI({
      address: 'ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv',
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
    var uri = new URI('ecash://qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
    uri.address.toString().should.equal('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');

    uri = new URI('ectest://qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
    uri.address.toString().should.equal('ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu');
  });

  it('should input/output String', function() {
    var str = 'ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?' +
              'message=Donation%20for%20project%20xyz&label=myLabel&other=xD';
    URI.fromString(str).toString().should.equal(str);

    str = 'ectest:qqkj609un9sl896yezxj0j5hxagk7h7pnylknwe8uu?' +
              'message=Donation%20for%20project%20xyz&label=myLabel&other=xD';
    URI.fromString(str).toString().should.equal(str);
  });

  it('should input/output JSON', function() {
    var json = JSON.stringify({
      address: 'ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv',
      message: 'Donation for project xyz',
      label: 'myLabel',
      other: 'xD'
    });
    JSON.stringify(URI.fromObject(JSON.parse(json))).should.equal(json);
  });

  it('should support numeric amounts', function() {
    var uri = new URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=12.10001');
    expect(uri.amount).to.be.equal(1210001000);
  });

  it('should support extra arguments', function() {
    var uri = new URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?' +
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
      address: 'qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv',
    }).toString().should.equal(
      'ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv'
    );

    new URI({
      address: 'qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv',
      amount: 110001000,
      message: 'Hello World',
      something: 'else'
    }).toString().should.equal(
      'ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv?amount=1.10001&message=Hello%20World&something=else'
    );

  });

  it('should be case insensitive to protocol', function() {
    var uri1 = new URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');
    var uri2 = new URI('ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv');

    uri1.address.toString().should.equal(uri2.address.toString());
  });

  it('writes correctly the "r" parameter on string serialization', function() {
    var originalString = 'ectest:qpzextxrtp4ettwsfru86fggmwf565h3jsve8su5wg?amount=0.1&' +
                         'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu';
    var uri = new URI(originalString);
    uri.toString().should.equal(originalString);
  });

  it('displays nicely on the console (#inspect)', function() {
    var uri = 'ecash:qzruaav37d2hwqfaqvsktwdqjly502s06qswfymrrv';
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
