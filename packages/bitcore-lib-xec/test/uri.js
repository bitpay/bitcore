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

    uri = URI.parse('bitcoincash:');
    expect(uri.address).to.be.equal(undefined);
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);


    uri = URI.parse('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
    uri.address.should.equal('qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=123.22');
    uri.address.should.equal('qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
    uri.amount.should.equal('123.22');
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=123.22' +
                    '&other-param=something&req-extra=param');
    uri.address.should.equal('qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
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

    uri = URI.parse('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
    uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
    expect(uri.amount).to.be.equal(undefined);
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=123.22');
    uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
    uri.amount.should.equal('123.22');
    expect(uri.otherParam).to.be.equal(undefined);

    uri = URI.parse('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=123.22' +
                    '&other-param=something&req-extra=param');
    uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
    uri.amount.should.equal('123.22');
    uri['other-param'].should.equal('something');
    uri['req-extra'].should.equal('param');
  });

  it('Should return error if try to use an invalid bitcoin URI', function() {
    var uri;

    try {
      uri = URI.parse('badprefix:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
    } catch (e) {
        expect(e.message).to.equal('Invalid bitcoin URI');
    }
  });

  describe('cashaddr', function() {
    URI.parse.bind(URI, 'badURI').should.throw(TypeError);

    // cashaddr
    it('address only', function() {
      var uri;
      var str = 'bitcoincash:qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g');
      expect(uri.amount).to.be.equal(undefined);
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });

    it('address +amount', function() {
      var uri;
      var str = 'bitcoincash:qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g?amount=123.22';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g');
      uri.amount.should.equal('123.22');
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });


    it('address +amount + opts', function() {
      var uri;
      var str = 'bitcoincash:qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      URI.isValid(str).should.equal(false);
    });


    it('address +amount + opts', function() {
      var uri;
      var str = 'bitcoincash:qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(false);
    });

    it('address +amount + opts', function() {
      var uri;
      var str = 'bitcoincash:qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g?amount=123.22' +
                    '&message=Donation%20for%20project%20xyz&label=myLabel';
      uri = URI.parse(str);
      uri.address.should.equal('qryan2ur3ff2x4arg4zaemevmncgewwl6swgk4az9g');
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
      var str = 'bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
      expect(uri.amount).to.be.equal(undefined);
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });

    it('address +amount', function() {
      var uri;
      var str = 'bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=123.22';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
      uri.amount.should.equal('123.22');
      expect(uri.otherParam).to.be.equal(undefined);
      URI.isValid(str).should.equal(true);
    });


    it('address +amount + opts', function() {
      var uri;
      var str = 'bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      URI.isValid(str).should.equal(false);
    });

    it('address +amount + opts', function() {
      var uri;
      var str = 'bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=123.22' +
                    '&other-param=something&req-extra=param';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
      uri.amount.should.equal('123.22');
      uri['other-param'].should.equal('something');
      uri['req-extra'].should.equal('param');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(false);
    });

    it('address +amount + opts', function() {
      var uri;
      var str = 'bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=123.22' +
                    '&message=Donation%20for%20project%20xyz&label=myLabel';
      uri = URI.parse(str);
      uri.address.should.equal('qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
      uri.amount.should.equal('123.22');
      uri.label.should.equal('myLabel');
      uri.message.should.equal('Donation for project xyz');

      // becase other-; req-* was not supplied to validator
      URI.isValid(str).should.equal(true);
    });

  });



  // TODO: Split this and explain tests
  it('URIs can be validated statically (test vector)', function() {
    URI.isValid('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m').should.equal(true);

    URI.isValid('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=1.2')
                .should.equal(true);
    URI.isValid('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=1.2&other=param')
                .should.equal(true);
    URI.isValid('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=1.2&req-other=param',
                ['req-other']).should.equal(true);
    URI.isValid('bitcoincash:mmrqEBJxUCf42vdb3oozZtyz5mKr3Vb2Em?amount=0.1&' +
                'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu').should.equal(true);

    URI.isValid('bitcoincash:').should.equal(false);
    URI.isValid('bitcoincash:badUri').should.equal(false);
    URI.isValid('bitcoincash:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=bad').should.equal(false);
    URI.isValid('bitcoincash:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=1.2&req-other=param')
                .should.equal(false);
    URI.isValid('bitcoincash:?r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu')
                .should.equal(false);
  });

  // TODO: Split this and explain tests
  it('URIs can be validated statically (test vector)', function() {
    URI.isValid('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x').should.equal(true);

    URI.isValid('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2')
                .should.equal(true);
    URI.isValid('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2&other=param')
                .should.equal(true);
    URI.isValid('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2&req-other=param',
                ['req-other']).should.equal(true);
    URI.isValid('bchtest:mmrqEBJxUCf42vdb3oozZtyz5mKr3Vb2Em?amount=0.1&' +
                'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu').should.equal(true);

    URI.isValid('bchtest:').should.equal(false);
    URI.isValid('bchtest:badUri').should.equal(false);
    URI.isValid('bchtest:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=bad').should.equal(false);
    URI.isValid('bchtest:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfk?amount=1.2&req-other=param')
                .should.equal(false);
    URI.isValid('bchtest:?r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu')
                .should.equal(false);
  });

  it('fails on creation with no params', function() {
    (function(){
      return new URI();
    }).should.throw(TypeError);
  });

  it('do not need new keyword', function() {
    var uri = URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
    uri.should.be.instanceof(URI);
  });

  it('do not need new keyword for testnet', function() {
    var uri = URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
    uri.should.be.instanceof(URI);
  });

  describe('instantiation from bitcoin uri', function() {
    /* jshint maxstatements: 25 */
    var uri;

    it('parses address', function() {
      uri = new URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
      uri.address.should.be.instanceof(bitcore.Address);
      uri.network.should.equal(Networks.livenet);
    });

    it('parses amount', function() {
      uri = URI.fromString('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=123.22');
      uri.address.toString().should.equal('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
      uri.amount.should.equal(12322000000);
      expect(uri.otherParam).to.be.equal(undefined);
    });

    it('stores unknown parameters as "extras"', function() {
      uri = new URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=1.2&other=param');
      uri.address.should.be.instanceof(bitcore.Address);
      expect(uri.other).to.be.equal(undefined);
      uri.extras.other.should.equal('param');
    });

    it('throws error when a required feature is not supported', function() {
      (function() {
        return new URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=1.2&other=param&req-required=param');
      }).should.throw(Error);
    });

    it('has no false negative when checking supported features', function() {
      uri = new URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=1.2&other=param&' +
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
      uri = new URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
      uri.address.should.be.instanceof(bitcore.Address);
      uri.network.should.equal(Networks.testnet);
    });

    it('parses amount', function() {
      uri = URI.fromString('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=123.22');
      uri.address.toString().should.equal('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
      uri.amount.should.equal(12322000000);
      expect(uri.otherParam).to.be.equal(undefined);
    });

    it('stores unknown parameters as "extras"', function() {
      uri = new URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2&other=param');
      uri.address.should.be.instanceof(bitcore.Address);
      expect(uri.other).to.be.equal(undefined);
      uri.extras.other.should.equal('param');
    });

    it('throws error when a required feature is not supported', function() {
      (function() {
        return new URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2&other=param&req-required=param');
      }).should.throw(Error);
    });

    it('has no false negative when checking supported features', function() {
      uri = new URI('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?amount=1.2&other=param&' +
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
      address: 'qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal(Networks.livenet);

    uri = new URI({
      address: 'qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.network.should.equal(Networks.testnet);

    uri = new URI({
      address: 'qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m',
      amount: 120000000,
      other: 'param'
    });
    uri.address.should.be.instanceof(bitcore.Address);
    uri.amount.should.equal(120000000);
    expect(uri.other).to.be.equal(undefined);
    uri.extras.other.should.equal('param');

    (function() {
      return new URI({
        address: 'bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m',
        'req-required': 'param'
      });
    }).should.throw(Error);

    uri = new URI({
      address: 'bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m',
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
    var uri = new URI('bitcoincash://qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
    uri.address.toString().should.equal('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');

    uri = new URI('bchtest://qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
    uri.address.toString().should.equal('bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x');
  });

  it('should input/output String', function() {
    var str = 'bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?' +
              'message=Donation%20for%20project%20xyz&label=myLabel&other=xD';
    URI.fromString(str).toString().should.equal(str);

    str = 'bchtest:qqkj609un9sl896yezxj0j5hxagk7h7pnyyzaz887x?' +
              'message=Donation%20for%20project%20xyz&label=myLabel&other=xD';
    URI.fromString(str).toString().should.equal(str);
  });

  it('should input/output JSON', function() {
    var json = JSON.stringify({
      address: 'bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m',
      message: 'Donation for project xyz',
      label: 'myLabel',
      other: 'xD'
    });
    JSON.stringify(URI.fromObject(JSON.parse(json))).should.equal(json);
  });

  it('should support numeric amounts', function() {
    var uri = new URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=12.10001');
    expect(uri.amount).to.be.equal(1210001000);
  });

  it('should support extra arguments', function() {
    var uri = new URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?' +
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
      address: 'qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m',
    }).toString().should.equal(
      'bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m'
    );

    new URI({
      address: 'qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m',
      amount: 110001000,
      message: 'Hello World',
      something: 'else'
    }).toString().should.equal(
      'bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m?amount=1.10001&message=Hello%20World&something=else'
    );

  });

  it('should be case insensitive to protocol', function() {
    var uri1 = new URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');
    var uri2 = new URI('bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m');

    uri1.address.toString().should.equal(uri2.address.toString());
  });

  it('writes correctly the "r" parameter on string serialization', function() {
    var originalString = 'bchtest:qpzextxrtp4ettwsfru86fggmwf565h3jshdfuz5vj?amount=0.1&' +
                         'r=https%3A%2F%2Ftest.bitpay.com%2Fi%2F6DKgf8cnJC388irbXk5hHu';
    var uri = new URI(originalString);
    uri.toString().should.equal(originalString);
  });

  it('displays nicely on the console (#inspect)', function() {
    var uri = 'bitcoincash:qzruaav37d2hwqfaqvsktwdqjly502s06qfra0qe9m';
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
