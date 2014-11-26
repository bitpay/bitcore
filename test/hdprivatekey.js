'use strict';
/* jshint unused: false */
var should = require('chai').should();
var bitcore = require('..');
var HDPrivateKey = bitcore.HDPrivateKey;

var xprivkey = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';

describe('HDPrivate key interface', function() {

  it('should make a new private key from random', function() {
    new HDPrivateKey().should.exist();
  });

  it('allows no-new calling', function() {
    HDPrivateKey(xprivkey).toString().should.equal(xprivkey);
  });

  it('allows the use of a copy constructor', function() {
    HDPrivateKey(HDPrivateKey(xprivkey))
      .xprivkey.should.equal(xprivkey);
  });

  it('shouldn\'t matter if derivations are made with strings or numbers', function() {
    var privateKey = new HDPrivateKey(xprivkey);
    var derivedByString = privateKey.derive('m/0\'/1/2\'');
    var derivedByNumber = privateKey.derive(0, true).derive(1).derive(2, true);
    derivedByNumber.xprivkey.should.equal(derivedByString.xprivkey);
  });

});
