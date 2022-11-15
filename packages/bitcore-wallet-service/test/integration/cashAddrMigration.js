'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;

var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash')
};



var Common = require('../../ts_build/lib/common');
var Utils = Common.Utils;
var Constants = Common.Constants;
var Defaults = Common.Defaults;

var Model = require('../../ts_build/lib/model');

var WalletService = require('../../ts_build/lib/server');

var TestData = require('../testdata');
var helpers = require('./helpers');
var storage, blockchainExplorer, request;


describe('Cash address migration', function() {
  before(function(done) {
    helpers.before(function(res) {
      storage = res.storage;
      blockchainExplorer = res.blockchainExplorer;
      request = res.request;
      done();
    });
 
  });
  beforeEach(function(done) {
    log.level = 'error';
    helpers.beforeEach(function(res) {
      done();
    });
  });
  after(function(done) {
    helpers.after(done);
  });

  describe('Migrate wallets', function() {

    it('new BCH wallets should be  native cashAddr', function(done) {
      helpers.createAndJoinWallet(1, 1, {coin:'bch', earlyRet: true}, function(s, w) {
        let spy = sinon.spy(s.storage, 'migrateToCashAddr');
        s.getWallet({}, function(err, w) {
          let calls = spy.getCalls();
          calls.should.be.empty();
          helpers.stubUtxos(s, w, 1, function() {
            s.getStatus({}, function(err, a) {
              should.not.exist(err);
              spy.restore();
              done();
            });
          });
        });
      });
    });


    it('should create cashAddr addresses for new wallets', function(done) {
      helpers.createAndJoinWallet(1, 1, {coin:'bch'}, function(s, w) {
        helpers.createAddresses(s, w, 1, 1, function(main, change) {
          helpers.stubUtxos(s, w, 1, function() {
            s.getMainAddresses({}, function(err, a) {
              should.not.exist(err);
              a[0].address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
              done();
            });
          });
        });
      });
    });


    it('should migrate old wallets', function(done) {
      helpers.createAndJoinWallet(1, 1, {coin:'bch', earlyRet: true, nativeCashAddr: false}, function(s, w) {
        let spy = sinon.spy(s.storage, 'migrateToCashAddr');

        s.getWallet({}, function(err, w) {
          let calls = spy.getCalls();
          calls.length.should.equal(1);
          spy.restore();
          done();
        });
      });
    });


    it('should create cashAddr in migrated wallets', function(done) {
      helpers.createAndJoinWallet(1, 1, {coin:'bch', nativeCashAddr: false}, function(s, w) {
        helpers.createAddresses(s, w, 2, 2, function(main, change) {
          s.getMainAddresses({}, function(err, a) {
            should.not.exist(err);
            a[0].address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
            done();
          });
        });
      });
    });


    it('should migrate old addresses', function(done) {
      helpers.createAndJoinWallet(1, 1, {coin:'bch', earlyRet: true, nativeCashAddr: false}, function(s, w) {
      s.createAddress({doNotMigrate: true}, function(err, address) {
        address.address.should.equal('CbWsiNjh18ynQYc5jfYhhespEGrAaW8YUq');
        s.createAddress({doNotMigrate: true}, function(err, address) {
          address.address.should.equal('CbkZvkoMiBzxYDTzCvPUK9Mnbhv5FyQQCZ');
          s.createAddress({doNotMigrate: true}, function(err, address) {
            address.address.should.equal('CY6RRcu5Zwn25467jtXzGpmyxtJrDWmVG4');
            s.getWallet({}, function(err, w) {
              s.getMainAddresses({}, function(err, a) {
                a[0].address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
                a[1].address.should.equal('qrfere3rxlk3jjs7g28n952g8rjasjqcpgx3axq70t');
                a[2].address.should.equal('qz4h98slcsjhgxdkt3yd8dxz02x8s0u4l5hs80s0q8');
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });
      });
    });
  });
});

