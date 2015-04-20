'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var levelup = require('levelup');
var memdown = require('memdown');
var Storage = require('../lib/storage');

var Model = require('../lib/model');


describe.only('Storage', function() {
  var storage;
  beforeEach(function() {
    var db = levelup(memdown, {
      valueEncoding: 'json'
    });
    storage = new Storage({
      db: db
    });
  });
  describe('Store & fetch wallet', function() {
    it('should correctly store and fetch wallet', function(done) {
      var wallet = Model.Wallet.create({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
      });
      should.exist(wallet);
      storage.storeWallet(wallet, function(err) {
        should.not.exist(err);
        storage.fetchWallet('123', function(err, w) {
          should.not.exist(err);
          should.exist(w);
          w.id.should.equal(wallet.id);
          w.name.should.equal(wallet.name);
          w.m.should.equal(wallet.m);
          w.n.should.equal(wallet.n);
          done();
        })
      });
    });
    it('should not return error if wallet not found', function(done) {
      storage.fetchWallet('123', function(err, w) {
        should.not.exist(err);
        should.not.exist(w);
        done();
      });
    });
  });
});
