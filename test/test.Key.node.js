var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = coinUtil || bitcore.util;
var buffertools = require('buffertools');

var should = chai.should();
var assert = chai.assert;

var Key = bitcore.Key;

//addUncompressed is a node-only interface feature
if (typeof process !== 'undefined' && process.versions) {
  describe('#Key.node', function() {
    describe('#addUncompressed', function() {
      it('should exist', function() {
        should.exist(Key.addUncompressed);
      });

      it('should add two uncompressed public keys', function() {
        var key1 = Key.generateSync();
        key1.compressed = false;
        var key2 = Key.generateSync();
        key2.compressed = false;
        var pubkey1 = key1.public;
        var pubkey2 = key2.public;
        var pubkey = Key.addUncompressed(pubkey1, pubkey2);
        pubkey.length.should.equal(65);
      });

      it('a + b should equal b + a', function() {
        var key1 = Key.generateSync();
        key1.compressed = false;
        var key2 = Key.generateSync();
        key2.compressed = false;
        var pubkey1 = key1.public;
        var pubkey2 = key2.public;
        var r1 = Key.addUncompressed(pubkey1, pubkey2);
        var r2 = Key.addUncompressed(pubkey2, pubkey1);
        r1.toString('hex').should.equal(r2.toString('hex'));
      });

      it('should be able to add these two public keys without error', function() {
        var key1 = new Key();
        key1.private = coinUtil.sha256("first " + 3);
        key1.compressed = false;
        key1.regenerateSync();
        var key2 = new Key();
        key2.private = coinUtil.sha256("second " + 3);
        key2.compressed = false;
        key2.regenerateSync();
        var pubkey1 = key1.public;
        var pubkey2 = key2.public;
        var pubkey = Key.addUncompressed(pubkey1, pubkey2);
        pubkey.length.should.equal(65);
        var key = new Key();
        key.public = pubkey;
        assert(key.public !== null);
      });

    });

    describe('node only Key functionality', function() {
      it('should not fail when called as Key() without "new"', function() {
        var key = Key();
        should.exist(key);
      });
      it('should not fail when called as Key() without "new" with some args', function() {
        var key = Key(1, 2, 3, 4, 5);
        should.exist(key);
      });
      it('should have correct properties when called with Key() without "new"', function() {
        var key = Key();
        key.compressed.should.equal(true);
        should.not.exist(key.public);
        should.not.exist(key.private);
        should.exist(key);
      });

    });
  });
}
