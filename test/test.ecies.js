var ECIES = require('../lib/expmt/ecies');
var should = require('chai').should();
var Key = require('../lib/key');
var Hash = require('../lib/hash');

describe('#ECIES', function() {
  
  it('should make a new ECIES object', function() {
    var ecies = new ECIES();
    should.exist(ecies);
  });

  it('should make a new ECIES object when called without "new"', function() {
    var ecies = ECIES();
    should.exist(ecies);
  });

  var fromkey = Key().fromRandom();
  var tokey = Key().fromRandom();
  var messagebuf = Hash.sha256(new Buffer('my message is the hash of this string'));

  describe('@encrypt', function() {

    it('should return a buffer', function() {
      var encbuf = ECIES.encrypt(messagebuf, tokey, fromkey);
      Buffer.isBuffer(encbuf).should.equal(true);
    });

  });

  describe('@decrypt', function() {

    it('should decrypt that which was encrypted', function() {
      var encbuf = ECIES.encrypt(messagebuf, tokey, fromkey);
      var messagebuf2 = ECIES.decrypt(encbuf, tokey);
      messagebuf2.toString('hex').should.equal(messagebuf.toString('hex'));
    });

  });

});
