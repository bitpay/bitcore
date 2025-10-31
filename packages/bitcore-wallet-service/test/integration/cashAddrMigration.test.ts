'use strict';

import chai from 'chai';
import sinon from 'sinon';
import log from 'npmlog';
import helpers from './helpers';

log.debug = log.verbose;
const should = chai.should();


describe('Cash address migration', function() {
  let storage;
  let blockchainExplorer;
  let request;

  before(async function() {
    const res = await helpers.before();
    storage = res.storage;
    blockchainExplorer = res.blockchainExplorer;
    request = res.request;
  });

  beforeEach(async function() {
    log.level = 'error';
    await helpers.beforeEach();
  });

  afterEach(function() {
    sinon.restore();
  });

  after(async function() {
    await helpers.after();
  });

  describe('Migrate wallets', function() {
    it('new BCH wallets should be native cashAddr', function(done) {
      helpers.createAndJoinWallet(1, 1, { coin: 'bch', earlyRet: true }).then(({ server: s }) => {
        const spy = sinon.spy(s.storage, 'migrateToCashAddr');
        s.getWallet({}, function(err, w) {
          should.not.exist(err);
          const calls = spy.getCalls();
          calls.should.be.empty;
          helpers.stubUtxos(s, w, 1).then(() => {
            s.getStatus({}, function(err, a) {
              should.not.exist(err);
              should.exist(a);
              done();
            });
          });
        });
      });
    });


    it('should create cashAddr addresses for new wallets', function(done) {
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(({ server: s, wallet: w }) => {
        helpers.createAddresses(s, w, 1, 1).then(({ main, change }) => {
          helpers.stubUtxos(s, w, 1).then(() => {
            s.getAddresses({ noChange: true }, function(err, a) {
              should.not.exist(err);
              a[0].address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
              done();
            });
          });
        });
      });
    });


    it('should migrate old wallets', function(done) {
      helpers.createAndJoinWallet(1, 1, { coin: 'bch', earlyRet: true, nativeCashAddr: false }).then(({ server: s }) => {
        const spy = sinon.spy(s.storage, 'migrateToCashAddr');
        s.getWallet({}, function(err, w) {
          should.not.exist(err);
          should.exist(w);
          const calls = spy.getCalls();
          calls.length.should.equal(1);
          done();
        });
      });
    });


    it('should create cashAddr in migrated wallets', function(done) {
      helpers.createAndJoinWallet(1, 1, { coin: 'bch', nativeCashAddr: false }).then(({ server: s, wallet: w }) => {
        helpers.createAddresses(s, w, 2, 2).then(({ main, change }) => {
          s.getAddresses({ noChange: true }, function(err, a) {
            should.not.exist(err);
            a[0].address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
            done();
          });
        });
      });
    });


    it('should migrate old addresses', function(done) {
      helpers.createAndJoinWallet(1, 1, { coin: 'bch', earlyRet: true, nativeCashAddr: false }).then(({ server: s }) => {
        s.createAddress({ doNotMigrate: true }, function(err, address) {
          should.not.exist(err);
          address.address.should.equal('CbWsiNjh18ynQYc5jfYhhespEGrAaW8YUq');
          s.createAddress({ doNotMigrate: true }, function(err, address) {
            should.not.exist(err);
            address.address.should.equal('CbkZvkoMiBzxYDTzCvPUK9Mnbhv5FyQQCZ');
            s.createAddress({ doNotMigrate: true }, function(err, address) {
              should.not.exist(err);
              address.address.should.equal('CY6RRcu5Zwn25467jtXzGpmyxtJrDWmVG4');
              s.getWallet({}, function(err, w) {
                should.not.exist(err);
                s.getAddresses({ noChange: true }, function(err, a) {
                  should.not.exist(err);
                  a[0].address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
                  a[1].address.should.equal('qrfere3rxlk3jjs7g28n952g8rjasjqcpgx3axq70t');
                  a[2].address.should.equal('qz4h98slcsjhgxdkt3yd8dxz02x8s0u4l5hs80s0q8');
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

