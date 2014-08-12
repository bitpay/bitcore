'use strict';

var chai = chai || require('chai');
var should = chai.should();
var bitcore = bitcore || require('../bitcore');
var BIP21 = bitcore.BIP21;

describe('BIP21', function() {

  it('should support livent address', function() {
    var uri;

    uri = new BIP21('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.isValid().should.be.true;
    uri.address.network().name = 'livenet';
    uri.address.toString().should.equal('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');

    uri = new BIP21('bitcoin:3FDFgmroEu5EFxxhHUkZL8vNJ3xrjUF3mB');
    uri.isValid().should.be.true;
    uri.address.network().name = 'livenet';
    uri.address.toString().should.equal('3FDFgmroEu5EFxxhHUkZL8vNJ3xrjUF3mB');
  });

  it('should support testnet address', function() {
    var uri;

    uri = new BIP21('bitcoin:myNUd9RyL6VcLNdiTkYPDz9pQK6fo2JqYy');
    uri.isValid().should.be.true;
    uri.address.network().name = 'testnet';
    uri.address.toString().should.equal('myNUd9RyL6VcLNdiTkYPDz9pQK6fo2JqYy');

    uri = new BIP21('bitcoin:2N3EPfMSXoaEcNfuvLETKVfF4iddDsnwoYN');
    uri.isValid().should.be.true;
    uri.address.network().name = 'testnet';
    uri.address.toString().should.equal('2N3EPfMSXoaEcNfuvLETKVfF4iddDsnwoYN');
  });

  it('should support double slash scheme', function() {
    var uri = new BIP21('bitcoin://1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.isValid().should.be.true;
    uri.address.toString().should.equal('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
  });

  it('should support numeric amounts', function() {
    var uri = new BIP21('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=12.10001');
    uri.isValid().should.be.true;
    should.exist(uri.data.amount);
    uri.data.amount.should.equal(12.10001);
  });

  it('should support extra arguments', function() {
    var uri = new BIP21('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?message=Donation%20for%20project%20xyz&label=myLabel&other=xD');
    uri.isValid().should.be.true;

    should.exist(uri.data.message);
    uri.data.message.should.equal('Donation for project xyz');

    should.exist(uri.data.label);
    uri.data.label.should.equal('myLabel');

    should.exist(uri.data.other);
    uri.data.other.should.equal('xD');
  });

  it('should validate address', function() {
    var uri = new BIP21('bitcoin:invalidAddress');
    uri.isValid().should.be.false;
    uri.address.should.equal('invalidAddress');
  });

  it('should validate amount', function() {
    var uri = new BIP21('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=bad');
    uri.isValid().should.be.false;
    isNaN(uri.data.amount).should.be.true;
  });

  it('should support payment protocol', function() {
    var uri = new BIP21('bitcoin:?message=Hi');
    uri.isValid().should.be.false;

    uri = new BIP21('bitcoin:?message=Hi&r=some-data');
    uri.isValid().should.be.true;
  });

  it('should build from an object', function() {
    var uri = new BIP21({
      address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj',
      amount: 1.10001,
      message: 'Hello World'
    });

    uri.isValid().should.be.true;
    uri.address.toString().should.equal('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.data.amount.should.equal(1.10001);
    uri.data.message.should.equal('Hello World');
  });

  it('should build from an object', function() {
    var uri = new BIP21({
      address: new bitcore.Address('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj'),
      amount: 1.10001,
      message: 'Hello World'
    });

    uri.isValid().should.be.true;
    uri.address.toString().should.equal('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.data.amount.should.equal(1.10001);
    uri.data.message.should.equal('Hello World');
  });

  it('should generate a valid URI', function() {
    new BIP21({
      address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj',
    }).getURI().should.equal(
    'bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj'
    );

    new BIP21({
      address: '1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj',
      amount: 1.10001,
      message: 'Hello World'
    }).getURI().should.equal(
    'bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?amount=1.10001&message=Hello%20World'
    );

    new BIP21({
      r: 'payment-info'
    }).getURI().should.equal(
    'bitcoin:?r=payment-info'
    );
  });

  it('should be case insensitive to protocol', function() {
    var uri1 = new BIP21('bItcOin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    var uri2 = new BIP21('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');

    uri1.address.toString().should.equal(uri2.address.toString());
  });

  it('should setAddress correctly', function() {
    var uri = new BIP21();
    uri.isValid().should.be.false;

    uri.setAddress('1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj');
    uri.address.network().name.should.equal('livenet');
  });

  it('should check required arguments', function() {
    var uri = new BIP21('bitcoin:1DP69gMMvSuYhbnxsi4EJEFufUAbDrEQfj?req-somethingyoudontunderstand=50&req-somethingelseyoudontget=999');
    uri.isValid().should.be.false;
    uri.isValid([
      'req-somethingyoudontunderstand',
      'req-somethingelseyoudontget'
    ]).should.be.true;
  });
});
