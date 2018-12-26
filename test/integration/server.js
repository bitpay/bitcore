'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;
log.level = 'info';

var config = require('../test-config');

var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash')
};



var Common = require('../../lib/common');
var Utils = Common.Utils;
var Constants = Common.Constants;
var Defaults = Common.Defaults;

var Model = require('../../lib/model');
var BCHAddressTranslator= require('../../lib/bchaddresstranslator');

var WalletService = require('../../lib/server');

var HugeTxs = require('./hugetx');
var TestData = require('../testdata');
var helpers = require('./helpers');
var storage, blockchainExplorer, request;


describe('Wallet service', function() {

  before(function(done) {
    helpers.before(done);
  });
  beforeEach(function(done) {
    helpers.beforeEach(function(res) {
      storage = res.storage;
      blockchainExplorer = res.blockchainExplorer;
      request = res.request;
      done();
    });
  });
  after(function(done) {
    helpers.after(done);
  });

  describe('#getServiceVersion', function() {
    it('should get version from package', function() {
      WalletService.getServiceVersion().should.equal('bws-' + require('../../package').version);
    });
  });

  describe('#getInstance', function() {
    it('should get server instance', function() {
      var server = WalletService.getInstance({
        clientVersion: 'bwc-2.9.0',
      });
      server.clientVersion.should.equal('bwc-2.9.0');
    });
    it('should not get server instance for BWC lower than v1.2', function() {
      var err;
      try {
        var server = WalletService.getInstance({
          clientVersion: 'bwc-1.1.99',
        });
      } catch (ex) {
        err = ex;
      }
      should.exist(err);
      err.code.should.equal('UPGRADE_NEEDED');
    });
    it('should get server instance for non-BWC clients', function() {
      var server = WalletService.getInstance({
        clientVersion: 'dummy-1.0.0',
      });
      server.clientVersion.should.equal('dummy-1.0.0');
      server = WalletService.getInstance({});
      (server.clientVersion == null).should.be.true;
    });
  });

  describe('#getInstanceWithAuth', function() {
    it('should not get server instance for BWC lower than v1.2', function(done) {
      var server = WalletService.getInstanceWithAuth({
        copayerId: '1234',
        message: 'hello world',
        signature: 'xxx',
        clientVersion: 'bwc-1.1.99',
      }, function(err, server) {
        should.exist(err);
        should.not.exist(server);
        err.code.should.equal('UPGRADE_NEEDED');
        done();
      });
    });
    it('should get server instance for existing copayer', function(done) {
      helpers.createAndJoinWallet(1, 2, function(s, wallet) {
        var xpriv = TestData.copayers[0].xPrivKey;
        var priv = TestData.copayers[0].privKey_1H_0;

        var sig = helpers.signMessage('hello world', priv);

        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: 'hello world',
          signature: sig,
          clientVersion: 'bwc-2.0.0',
          walletId: '123',
        }, function(err, server) {
          should.not.exist(err);
          server.walletId.should.equal(wallet.id);
          server.copayerId.should.equal(wallet.copayers[0].id);
          server.clientVersion.should.equal('bwc-2.0.0');
          done();
        });
      });
    });

    it('should fail when requesting for non-existent copayer', function(done) {
      var message = 'hello world';
      var opts = {
        copayerId: 'dummy',
        message: message,
        signature: helpers.signMessage(message, TestData.copayers[0].privKey_1H_0),
      };
      WalletService.getInstanceWithAuth(opts, function(err, server) {
        err.code.should.equal('NOT_AUTHORIZED');
        err.message.should.contain('Copayer not found');
        done();
      });
    });

    it('should fail when message signature cannot be verified', function(done) {
      helpers.createAndJoinWallet(1, 2, function(s, wallet) {
        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: 'dummy',
          signature: 'dummy',
        }, function(err, server) {
          err.code.should.equal('NOT_AUTHORIZED');
          err.message.should.contain('Invalid signature');
          done();
        });
      });
    });

    it('should get server instance for support staff', function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, wallet) {
        var collections = require('../../lib/storage').collections;
        s.storage.db.collection(collections.COPAYERS_LOOKUP).update({
          copayerId: wallet.copayers[0].id
        }, {
          $set: {
            isSupportStaff: true
          }
        });

        var xpriv = TestData.copayers[0].xPrivKey;
        var priv = TestData.copayers[0].privKey_1H_0;

        var sig = helpers.signMessage('hello world', priv);

        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: 'hello world',
          signature: sig,
          walletId: '123',
        }, function(err, server) {
          should.not.exist(err);
          server.walletId.should.equal('123');
          server.copayerId.should.equal(wallet.copayers[0].id);
          done();
        });
      });
    });
  });

  describe('Session management (#login, #logout, #authenticate)', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get a new session & authenticate', function(done) {
      WalletService.getInstanceWithAuth({
        copayerId: server.copayerId,
        session: 'dummy',
      }, function(err, server2) {
        should.exist(err);
        err.code.should.equal('NOT_AUTHORIZED');
        err.message.toLowerCase().should.contain('session');
        should.not.exist(server2);
        server.login({}, function(err, token) {
          should.not.exist(err);
          should.exist(token);
          WalletService.getInstanceWithAuth({
            copayerId: server.copayerId,
            session: token,
          }, function(err, server2) {
            should.not.exist(err);
            should.exist(server2);
            server2.copayerId.should.equal(server.copayerId);
            server2.walletId.should.equal(server.walletId);
            done();
          });
        });
      });
    });
    it('should get the same session token for two requests in a row', function(done) {
      server.login({}, function(err, token) {
        should.not.exist(err);
        should.exist(token);
        server.login({}, function(err, token2) {
          should.not.exist(err);
          token2.should.equal(token);
          done();
        });
      });
    });
    it('should create a new session if the previous one has expired', function(done) {
      var timer = sinon.useFakeTimers({toFake: ['Date']});
      var token;
      async.series([

        function(next) {
          server.login({}, function(err, t) {
            should.not.exist(err);
            should.exist(t);
            token = t;
            next();
          });
        },
        function(next) {
          WalletService.getInstanceWithAuth({
            copayerId: server.copayerId,
            session: token,
          }, function(err, server2) {
            should.not.exist(err);
            should.exist(server2);
            next();
          });
        },
        function(next) {
          timer.tick((Defaults.SESSION_EXPIRATION + 1) * 1000);
          next();
        },
        function(next) {
          server.login({}, function(err, t) {
            should.not.exist(err);
            t.should.not.equal(token);
            next();
          });
        },
        function(next) {
          WalletService.getInstanceWithAuth({
            copayerId: server.copayerId,
            session: token,
          }, function(err, server2) {
            should.exist(err);
            err.code.should.equal('NOT_AUTHORIZED');
            err.message.should.contain('expired');
            next();
          });
        },
      ], function(err) {
        should.not.exist(err);
        timer.restore();
        done();
      });
    });
  });

  describe('#createWallet', function() {
    var server;
    beforeEach(function() {
      server = new WalletService();
    });

    it('should create and store wallet', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet(walletId, function(err, wallet) {
          should.not.exist(err);
          wallet.id.should.equal(walletId);
          wallet.name.should.equal('my wallet');
          done();
        });
      });
    });

    it('should create wallet with given id', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
        id: '1234',
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet('1234', function(err, wallet) {
          should.not.exist(err);
          wallet.id.should.equal(walletId);
          wallet.name.should.equal('my wallet');
          done();
        });
      });
    });

    it('should fail to create wallets with same id', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
        id: '1234',
      };
      server.createWallet(opts, function(err, walletId) {
        server.createWallet(opts, function(err, walletId) {
          err.message.should.contain('Wallet already exists');
          done();
        });
      });
    });

    it('should fail to create wallet with no name', function(done) {
      var opts = {
        name: '',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(walletId);
        should.exist(err);
        err.message.should.contain('name');
        done();
      });
    });

    it('should check m-n combination', function(done) {
      var pairs = [{
        m: 0,
        n: 0,
        valid: false,
      }, {
        m: 1,
        n: 1,
        valid: true,
      }, {
        m: 2,
        n: 3,
        valid: true,
      }, {
        m: 0,
        n: 2,
        valid: false,
      }, {
        m: 2,
        n: 1,
        valid: false,
      }, {
        m: 0,
        n: 10,
        valid: false,
      }, {
        m: 1,
        n: 20,
        valid: false,
      }, {
        m: 10,
        n: 10,
        valid: true,
      }, {
        m: 15,
        n: 15,
        valid: true,
      }, {
        m: 16,
        n: 16,
        valid: false,
      }, {
        m: 1,
        n: 15,
        valid: true,
      }, {
        m: -2,
        n: -2,
        valid: false,
      }, ];
      var opts = {
        id: '123',
        name: 'my wallet',
        pubKey: TestData.keyPair.pub,
      };
      async.each(pairs, function(pair, cb) {
        opts.m = pair.m;
        opts.n = pair.n;
        server.createWallet(opts, function(err) {
          if (!pair.valid) {
            should.exist(err);
            err.message.should.equal('Invalid combination of required copayers / total copayers');
          } else {
console.log('[server.js.425:err:]',err); //TODO
            should.not.exist(err);
          }
          return cb();
        });
      }, function(err) {
        done();
      });
    });

    it('should fail to create wallet with invalid pubKey argument', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: 'dummy',
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(walletId);
        should.exist(err);
        err.message.should.contain('Invalid public key');
        done();
      });
    });

    it('should create wallet for another coin', function(done) {
      var opts = {
        coin: 'bch',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet(walletId, function(err, wallet) {
          should.not.exist(err);
          wallet.coin.should.equal('bch');
          done();
        });
      });
    });


    describe('Address derivation strategy', function() {
      var server;
      beforeEach(function() {
        server = WalletService.getInstance();
      });
      it('should use BIP44 & P2PKH for 1-of-1 wallet if supported', function(done) {
        var walletOpts = {
          name: 'my wallet',
          m: 1,
          n: 1,
          pubKey: TestData.keyPair.pub,
        };
        server.createWallet(walletOpts, function(err, wid) {
          should.not.exist(err);
          server.storage.fetchWallet(wid, function(err, wallet) {
            should.not.exist(err);
            wallet.derivationStrategy.should.equal('BIP44');
            wallet.addressType.should.equal('P2PKH');
            done();
          });
        });
      });
      it('should use BIP45 & P2SH for 1-of-1 wallet if not supported', function(done) {
        var walletOpts = {
          name: 'my wallet',
          m: 1,
          n: 1,
          pubKey: TestData.keyPair.pub,
          supportBIP44AndP2PKH: false,
        };
        server.createWallet(walletOpts, function(err, wid) {
          should.not.exist(err);
          server.storage.fetchWallet(wid, function(err, wallet) {
            should.not.exist(err);
            wallet.derivationStrategy.should.equal('BIP45');
            wallet.addressType.should.equal('P2SH');
            done();
          });
        });
      });
      it('should use BIP44 & P2SH for shared wallet if supported', function(done) {
        var walletOpts = {
          name: 'my wallet',
          m: 2,
          n: 3,
          pubKey: TestData.keyPair.pub,
        };
        server.createWallet(walletOpts, function(err, wid) {
          should.not.exist(err);
          server.storage.fetchWallet(wid, function(err, wallet) {
            should.not.exist(err);
            wallet.derivationStrategy.should.equal('BIP44');
            wallet.addressType.should.equal('P2SH');
            done();
          });
        });
      });
      it('should use BIP45 & P2SH for shared wallet if supported', function(done) {
        var walletOpts = {
          name: 'my wallet',
          m: 2,
          n: 3,
          pubKey: TestData.keyPair.pub,
          supportBIP44AndP2PKH: false,
        };
        server.createWallet(walletOpts, function(err, wid) {
          should.not.exist(err);
          server.storage.fetchWallet(wid, function(err, wallet) {
            should.not.exist(err);
            wallet.derivationStrategy.should.equal('BIP45');
            wallet.addressType.should.equal('P2SH');
            done();
          });
        });
      });
    });
  });

  describe('#joinWallet', function() {
    describe('New clients', function() {

      var server, walletId;
      beforeEach(function(done) {
        server = new WalletService();
        var walletOpts = {
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
        };
        server.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletId = wId;
          should.exist(walletId);
          done();
        });
      });

      it('should join existing wallet', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          customData: 'dummy custom data',
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          var copayerId = result.copayerId;
          helpers.getAuthServer(copayerId, function(server) {
            server.getWallet({}, function(err, wallet) {
              wallet.id.should.equal(walletId);
              wallet.copayers.length.should.equal(1);
              var copayer = wallet.copayers[0];
              copayer.name.should.equal('me');
              copayer.id.should.equal(copayerId);
              copayer.customData.should.equal('dummy custom data');
              server.getNotifications({}, function(err, notifications) {
                should.not.exist(err);
                var notif = _.find(notifications, {
                  type: 'NewCopayer'
                });
                should.exist(notif);
                notif.data.walletId.should.equal(walletId);
                notif.data.copayerId.should.equal(copayerId);
                notif.data.copayerName.should.equal('me');

                notif = _.find(notifications, {
                  type: 'WalletComplete'
                });
                should.not.exist(notif);
                done();
              });
            });
          });
        });
      });

      it('should fail join existing wallet with bad xpub', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: 'Ttub4pHUfyVU2mpjaM6YDGDJXWP6j5SL5AJzbViBuTaJEsybcrWZZoGkW7RSUSH9VRQKJtjqY2LfC2bF3FM4UqC1Ba9EP5M64SdTsv9575VAUwh',
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          customData: 'dummy custom data',
        });
        server.joinWallet(copayerOpts, function(err, result) {
          err.message.should.match(/Invalid extended public key/);
          done();
        });
      });

      it('should fail join existing wallet with wrong network xpub', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: 'tpubD6NzVbkrYhZ4Wbwwqah5kj1RGPK9BYeGbowB1jegxMoAkKbNhYUAcRTZ5fyxDcpjNXxziiy2ZkUQ3kR1ycPNycTD7Q2Dr6UfLcNTYHrzS3U',
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          customData: 'dummy custom data',
        });
        server.joinWallet(copayerOpts, function(err, result) {
          err.message.should.match(/different network/);
          done();
        });
      });

      it('should fail to join with no name', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: '',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(result);
          should.exist(err);
          err.message.should.contain('name');
          done();
        });
      });

      it('should fail to join non-existent wallet', function(done) {
        var copayerOpts = {
          walletId: '123',
          name: 'me',
          xPubKey: 'dummy',
          requestPubKey: 'dummy',
          copayerSignature: 'dummy',
        };
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          done();
        });
      });

      it('should fail to join full wallet', function(done) {
        helpers.createAndJoinWallet(1, 1, function(s, wallet) {
          var copayerOpts = helpers.getSignedCopayerOpts({
            walletId: wallet.id,
            name: 'me',
            xPubKey: TestData.copayers[1].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[1].pubKey_1H_0,
          });
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.code.should.equal('WALLET_FULL');
            err.message.should.equal('Wallet full');
            done();
          });
        });
      });

      it('should fail to join wallet for different coin', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          coin: 'bch',
        });
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          err.message.should.contain('different coin');
          done();
        });
      });

      it('should return copayer in wallet error before full wallet', function(done) {
        helpers.createAndJoinWallet(1, 1, function(s, wallet) {
          var copayerOpts = helpers.getSignedCopayerOpts({
            walletId: wallet.id,
            name: 'me',
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0,
          });
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.code.should.equal('COPAYER_IN_WALLET');
            done();
          });
        });
      });

      it('should fail to re-join wallet', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err) {
          should.not.exist(err);
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.code.should.equal('COPAYER_IN_WALLET');
            err.message.should.equal('Copayer already in wallet');
            done();
          });
        });
      });

      it('should be able to get wallet info without actually joining', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          customData: 'dummy custom data',
          dryRun: true,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          should.not.exist(result.copayerId);
          result.wallet.id.should.equal(walletId);
          result.wallet.m.should.equal(1);
          result.wallet.n.should.equal(2);
          result.wallet.copayers.should.be.empty;
          server.storage.fetchWallet(walletId, function(err, wallet) {
            should.not.exist(err);
            wallet.id.should.equal(walletId);
            wallet.copayers.should.be.empty;
            done();
          });
        });
      });

      it('should fail to join two wallets with same xPubKey', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err) {
          should.not.exist(err);

          var walletOpts = {
            name: 'my other wallet',
            m: 1,
            n: 1,
            pubKey: TestData.keyPair.pub,
          };
          server.createWallet(walletOpts, function(err, walletId) {
            should.not.exist(err);
            copayerOpts = helpers.getSignedCopayerOpts({
              walletId: walletId,
              name: 'me',
              xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
              requestPubKey: TestData.copayers[0].pubKey_1H_0,
            });
            server.joinWallet(copayerOpts, function(err) {
              should.exist(err);
              err.code.should.equal('COPAYER_REGISTERED');
              err.message.should.equal('Copayer ID already registered on server');
              done();
            });
          });
        });
      });

      it('should fail to join with bad formated signature', function(done) {
        var copayerOpts = {
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          copayerSignature: 'bad sign',
        };
        server.joinWallet(copayerOpts, function(err) {
          err.message.should.equal('Bad request');
          done();
        });
      });

      it('should fail to join with invalid xPubKey', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'copayer 1',
          xPubKey: 'invalid',
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(result);
          should.exist(err);
          err.message.should.contain('extended public key');
          done();
        });
      });

      it('should fail to join with null signature', function(done) {
        var copayerOpts = {
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        };
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          err.message.should.contain('argument: copayerSignature missing');
          done();
        });
      });

      it('should fail to join with wrong signature', function(done) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        copayerOpts.name = 'me2';
        server.joinWallet(copayerOpts, function(err) {
          err.message.should.equal('Bad request');
          done();
        });
      });

      it('should set pkr and status = complete on last copayer joining (2-3)', function(done) {
        helpers.createAndJoinWallet(2, 3, function(server) {
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.status.should.equal('complete');
            wallet.publicKeyRing.length.should.equal(3);
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var notif = _.find(notifications, {
                type: 'WalletComplete'
              });
              should.exist(notif);
              notif.data.walletId.should.equal(wallet.id);
              done();
            });
          });
        });
      });

      it('should not notify WalletComplete if 1-of-1', function(done) {
        helpers.createAndJoinWallet(1, 1, function(server) {
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notif = _.find(notifications, {
              type: 'WalletComplete'
            });
            should.not.exist(notif);
            done();
          });
        });
      });
    });

    describe('Interaction new/legacy clients', function() {
      var server;
      beforeEach(function() {
        server = new WalletService();
      });

      it('should fail to join legacy wallet from new client', function(done) {
        var walletOpts = {
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
          supportBIP44AndP2PKH: false,
        };
        server.createWallet(walletOpts, function(err, walletId) {
          should.not.exist(err);
          should.exist(walletId);
          var copayerOpts = helpers.getSignedCopayerOpts({
            walletId: walletId,
            name: 'me',
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0,
          });
          server.joinWallet(copayerOpts, function(err, result) {
            should.exist(err);
            err.message.should.contain('The wallet you are trying to join was created with an older version of the client app');
            done();
          });
        });
      });

      it('should fail to join new wallet from legacy client', function(done) {
        var walletOpts = {
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
        };
        server.createWallet(walletOpts, function(err, walletId) {
          should.not.exist(err);
          should.exist(walletId);
          var copayerOpts = helpers.getSignedCopayerOpts({
            walletId: walletId,
            name: 'me',
            xPubKey: TestData.copayers[0].xPubKey_45H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0,
            supportBIP44AndP2PKH: false,
          });
          server.joinWallet(copayerOpts, function(err, result) {
            should.exist(err);
            err.code.should.equal('UPGRADE_NEEDED');
            done();
          });
        });
      });
    });
  });

  describe('#removeWallet', function() {
    var server, wallet, clock;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;

        helpers.stubUtxos(server, wallet, [1, 2], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.1e8,
            }],
            feePerKb: 100e2,
          };
          async.eachSeries(_.range(2), function(i, next) {
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function() {
              next();
            });
          }, done);
        });
      });
    });

    it('should delete a wallet', function(done) {
      server.removeWallet({}, function(err) {
        should.not.exist(err);
        server.getWallet({}, function(err, w) {
          should.exist(err);
          err.code.should.equal('WALLET_NOT_FOUND');
          should.not.exist(w);
          async.parallel([

            function(next) {
              server.storage.fetchAddresses(wallet.id, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
            function(next) {
              server.storage.fetchTxs(wallet.id, {}, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
            function(next) {
              server.storage.fetchNotifications(wallet.id, null, 0, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
          ], function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    // creates 2 wallet, and deletes only 1.
    it('should delete a wallet, and only that wallet', function(done) {
      var server2, wallet2;
      async.series([

        function(next) {
          helpers.createAndJoinWallet(1, 1, {
            offset: 1
          }, function(s, w) {
            server2 = s;
            wallet2 = w;

            helpers.stubUtxos(server2, wallet2, [1, 2, 3], function() {
              var txOpts = {
                outputs: [{
                  toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                  amount: 0.1e8,
                }],
                feePerKb: 100e2,
              };
              async.eachSeries(_.range(2), function(i, next) {
                helpers.createAndPublishTx(server2, txOpts, TestData.copayers[1].privKey_1H_0, function() {
                  next();
                });
              }, next);
            });
          });
        },
        function(next) {
          server.removeWallet({}, next);
        },
        function(next) {
          server.getWallet({}, function(err, wallet) {
            should.exist(err);
            err.code.should.equal('WALLET_NOT_FOUND');
            next();
          });
        },
        function(next) {
          server2.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            should.exist(wallet);
            wallet.id.should.equal(wallet2.id);
            next();
          });
        },
        function(next) {
          server2.getMainAddresses({}, function(err, addresses) {
            should.not.exist(err);
            should.exist(addresses);
            addresses.length.should.above(0);
            next();
          });
        },
        function(next) {
          server2.getTxs({}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(2);
            next();
          });
        },
        function(next) {
          server2.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            should.exist(notifications);
            notifications.length.should.above(0);
            next();
          });
        },
      ], function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('#getStatus', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get status', function(done) {
      server.getStatus({}, function(err, status) {
        should.not.exist(err);
        should.exist(status);
        should.exist(status.wallet);
        status.wallet.name.should.equal(wallet.name);
        should.exist(status.wallet.copayers);
        status.wallet.copayers.length.should.equal(2);
        should.exist(status.balance);
        status.balance.totalAmount.should.equal(0);
        should.exist(status.preferences);
        should.exist(status.pendingTxps);
        status.pendingTxps.should.be.empty;

        should.not.exist(status.wallet.publicKeyRing);
        should.not.exist(status.wallet.pubKey);
        should.not.exist(status.wallet.addressManager);
        _.each(status.wallet.copayers, function(copayer) {
          should.not.exist(copayer.xPubKey);
          should.not.exist(copayer.requestPubKey);
          should.not.exist(copayer.signature);
          should.not.exist(copayer.requestPubKey);
          should.not.exist(copayer.addressManager);
          should.not.exist(copayer.customData);
        });
        done();
      });
    });
    it('should get status including extended info', function(done) {
      server.getStatus({
        includeExtendedInfo: true
      }, function(err, status) {
        should.not.exist(err);
        should.exist(status);
        should.exist(status.wallet.publicKeyRing);
        should.exist(status.wallet.pubKey);
        should.exist(status.wallet.addressManager);
        should.exist(status.wallet.copayers[0].xPubKey);
        should.exist(status.wallet.copayers[0].requestPubKey);
        should.exist(status.wallet.copayers[0].signature);
        should.exist(status.wallet.copayers[0].requestPubKey);
        should.exist(status.wallet.copayers[0].customData);
        // Do not return other copayer's custom data
        _.each(_.tail(status.wallet.copayers), function(copayer) {
          should.not.exist(copayer.customData);
        });
        done();
      });
    });
    it('should get status after tx creation', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2], function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.8e8
          }],
          feePerKb: 100e2
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
          should.exist(tx);
          server.getStatus({}, function(err, status) {
            should.not.exist(err);
            status.pendingTxps.length.should.equal(1);
            var balance = status.balance;
            balance.totalAmount.should.equal(3e8);
            balance.lockedAmount.should.equal(tx.inputs[0].satoshis);
            balance.availableAmount.should.equal(balance.totalAmount - balance.lockedAmount);
            done();
          });
        });
      });
    });
  });

  describe('#verifyMessageSignature', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should successfully verify message signature', function(done) {
      var message = 'hello world';
      var opts = {
        message: message,
        signature: helpers.signMessage(message, TestData.copayers[0].privKey_1H_0),
      };
      server.verifyMessageSignature(opts, function(err, isValid) {
        should.not.exist(err);
        isValid.should.be.true;
        done();
      });
    });

    it('should fail to verify message signature for different copayer', function(done) {
      var message = 'hello world';
      var opts = {
        message: message,
        signature: helpers.signMessage(message, TestData.copayers[0].privKey_1H_0),
      };
      helpers.getAuthServer(wallet.copayers[1].id, function(server) {
        server.verifyMessageSignature(opts, function(err, isValid) {
          should.not.exist(err);
          isValid.should.be.false;
          done();
        });
      });
    });
  });

  describe('#createAddress', function() {
    var server, wallet;

    describe('shared wallets (BIP45)', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(2, 2, {
          supportBIP44AndP2PKH: false
        }, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('3BVJZ4CYzeTtawDtgwHvWV5jbvnXtYe97i');
          address.isChange.should.be.false;
          address.path.should.equal('m/2147483647/0/0');
          address.type.should.equal('P2SH');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notif = _.find(notifications, {
              type: 'NewAddress'
            });
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create many addresses on simultaneous requests', function(done) {
        var N = 5;
        async.mapSeries(_.range(N), function(i, cb) {
          server.createAddress({}, cb);
        }, function(err, addresses) {
          var x = _.map(addresses, 'path');
          addresses.length.should.equal(N);
          _.each(_.range(N), function(i) {
            addresses[i].path.should.equal('m/2147483647/0/' + i);
          });
          // No two identical addresses
          _.uniq(_.map(addresses, 'address')).length.should.equal(N);
          done();
        });
      });
    });

    describe('shared wallets (BIP44)', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(2, 2, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });

      it('should create address ', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
          address.isChange.should.be.false;
          address.coin.should.equal('btc');
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2SH');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notif = _.find(notifications, {
              type: 'NewAddress'
            });
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create many addresses on simultaneous requests', function(done) {
        var N = 5;
        async.mapSeries(_.range(N), function(i, cb) {
          server.createAddress({}, cb);
        }, function(err, addresses) {
          addresses.length.should.equal(N);
          _.each(_.range(N), function(i) {
            addresses[i].path.should.equal('m/0/' + i);
          });
          // No two identical addresses
          _.uniq(_.map(addresses, 'address')).length.should.equal(N);
          done();
        });
      });

      it('should not create address if unable to store it', function(done) {
        sinon.stub(server.storage, 'storeAddressAndWallet').yields('dummy error');
        server.createAddress({}, function(err, address) {
          should.exist(err);
          should.not.exist(address);

          server.getMainAddresses({}, function(err, addresses) {
            addresses.length.should.equal(0);

            server.storage.storeAddressAndWallet.restore();
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              should.exist(address);
              done();
            });
          });
        });
      });
    });


    describe('shared wallets (BIP44/BCH)', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(2, 2, {
          coin: 'bch'
        }, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2SH');
          address.coin.should.equal('bch');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notif = _.find(notifications, {
              type: 'NewAddress'
            });
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create many addresses on simultaneous requests', function(done) {
        var N = 5;
        async.mapSeries(_.range(N), function(i, cb) {
          server.createAddress({}, cb);
        }, function(err, addresses) {
          addresses.length.should.equal(N);
          _.each(_.range(N), function(i) {
            addresses[i].path.should.equal('m/0/' + i);
          });
          // No two identical addresses
          _.uniq(_.map(addresses, 'address')).length.should.equal(N);
          done();
        });
      });

      it('should not create address if unable to store it', function(done) {
        sinon.stub(server.storage, 'storeAddressAndWallet').yields('dummy error');
        server.createAddress({}, function(err, address) {
          should.exist(err);
          should.not.exist(address);

          server.getMainAddresses({}, function(err, addresses) {
            addresses.length.should.equal(0);

            server.storage.storeAddressAndWallet.restore();
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              should.exist(address);
              done();
            });
          });
        });
      });
    });

    describe('shared wallets (BIP44/BCH)', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(2, 2, {
          coin: 'bch'
        }, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2SH');
          address.coin.should.equal('bch');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notif = _.find(notifications, {
              type: 'NewAddress'
            });
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create many addresses on simultaneous requests', function(done) {
        var N = 5;
        async.mapSeries(_.range(N), function(i, cb) {
          server.createAddress({}, cb);
        }, function(err, addresses) {
          addresses.length.should.equal(N);
          _.each(_.range(N), function(i) {
            addresses[i].path.should.equal('m/0/' + i);
          });
          // No two identical addresses
          _.uniq(_.map(addresses, 'address')).length.should.equal(N);
          done();
        });
      });

      it('should not create address if unable to store it', function(done) {
        sinon.stub(server.storage, 'storeAddressAndWallet').yields('dummy error');
        server.createAddress({}, function(err, address) {
          should.exist(err);
          should.not.exist(address);

          server.getMainAddresses({}, function(err, addresses) {
            addresses.length.should.equal(0);

            server.storage.storeAddressAndWallet.restore();
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              should.exist(address);
              done();
            });
          });
        });
      });
    });


    describe('1-1 wallet (BIP44/BCH/Testnet)', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(1, 1, {
          coin: 'bch',
          network: 'testnet',
        }, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('testnet');
          address.address.should.equal('mrM5kMkqZccK5MxZYSsM3SjqdMaNKLJgrJ');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2PKH');
          address.coin.should.equal('bch');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notif = _.find(notifications, {
              type: 'NewAddress'
            });
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });
    });


    describe('1-of-1 (BIP44 & P2PKH)', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(1, 1, function(s, w) {
          server = s;
          wallet = w;
          w.copayers[0].id.should.equal(TestData.copayers[0].id44btc);
          done();
        });
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2PKH');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notif = _.find(notifications, {
              type: 'NewAddress'
            });
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create many addresses on simultaneous requests', function(done) {
        var N = 5;
        async.mapSeries(_.range(N), function(i, cb) {
          server.createAddress({}, cb);
        }, function(err, addresses) {
          addresses = _.sortBy(addresses, 'path');
          addresses.length.should.equal(N);
          _.each(_.range(N), function(i) {
            addresses[i].path.should.equal('m/0/' + i);
          });
          // No two identical addresses
          _.uniq(_.map(addresses, 'address')).length.should.equal(N);
          done();
        });
      });

      it('should fail to create more consecutive addresses with no activity than allowed', function(done) {
        var MAX_MAIN_ADDRESS_GAP_old = Defaults.MAX_MAIN_ADDRESS_GAP;
        Defaults.MAX_MAIN_ADDRESS_GAP = 2;
        helpers.stubAddressActivity([]);
        async.map(_.range(2), function(i, next) {
          server.createAddress({}, next);
        }, function(err, addresses) {
          addresses.length.should.equal(2);

          server.createAddress({}, function(err, address) {
            should.exist(err);
            should.not.exist(address);
            err.code.should.equal('MAIN_ADDRESS_GAP_REACHED');
            server.createAddress({
              ignoreMaxGap: true
            }, function(err, address) {
              should.not.exist(err);
              should.exist(address);
              address.path.should.equal('m/0/2');

              helpers.stubAddressActivity([
                '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
              ]);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                should.exist(address);
                address.path.should.equal('m/0/3');

                Defaults.MAX_MAIN_ADDRESS_GAP = MAX_MAIN_ADDRESS_GAP_old;
                done();
              });
            });
          });
        });
      });

      it('should cache address activity', function(done) {
        var MAX_MAIN_ADDRESS_GAP_old = Defaults.MAX_MAIN_ADDRESS_GAP;
        Defaults.MAX_MAIN_ADDRESS_GAP = 2;
        helpers.stubAddressActivity([]);
        async.mapSeries(_.range(2), function(i, next) {
          server.createAddress({}, next);
        }, function(err, addresses) {
          addresses.length.should.equal(2);

          helpers.stubAddressActivity([addresses[1].address]);
          var getAddressActivitySpy = sinon.spy(blockchainExplorer, 'getAddressActivity');
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              getAddressActivitySpy.callCount.should.equal(1);
              Defaults.MAX_MAIN_ADDRESS_GAP = MAX_MAIN_ADDRESS_GAP_old;
              done();
            });
          });
        });
      });
    });
  });

  describe('#getMainAddresses', function() {
    var server, wallet;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, {}, function(s, w) {
        server = s;
        wallet = w;
        helpers.createAddresses(server, wallet, 5, 0, function() {
          done();
        });
      });
    });

    it('should get all addresses', function(done) {
      server.getMainAddresses({}, function(err, addresses) {
        should.not.exist(err);
        addresses.length.should.equal(5);
        addresses[0].path.should.equal('m/0/0');
        addresses[4].path.should.equal('m/0/4');
        done();
      });
    });
    it('should get first N addresses', function(done) {
      server.getMainAddresses({
        limit: 3
      }, function(err, addresses) {
        should.not.exist(err);
        addresses.length.should.equal(3);
        addresses[0].path.should.equal('m/0/0');
        addresses[2].path.should.equal('m/0/2');
        done();
      });
    });
    it('should get last N addresses in reverse order', function(done) {
      server.getMainAddresses({
        limit: 3,
        reverse: true,
      }, function(err, addresses) {
        should.not.exist(err);
        addresses.length.should.equal(3);
        addresses[0].path.should.equal('m/0/4');
        addresses[2].path.should.equal('m/0/2');
        done();
      });
    });
  });

  describe('Preferences', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should save & retrieve preferences', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com',
        language: 'es',
        unit: 'bit',
        dummy: 'ignored',
      }, function(err) {
        should.not.exist(err);
        server.getPreferences({}, function(err, preferences) {
          should.not.exist(err);
          should.exist(preferences);
          preferences.email.should.equal('dummy@dummy.com');
          preferences.language.should.equal('es');
          preferences.unit.should.equal('bit');
          should.not.exist(preferences.dummy);
          done();
        });
      });
    });
    it('should save preferences only for requesting copayer', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com'
      }, function(err) {
        should.not.exist(err);
        helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
          server2.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.not.exist(preferences.email);
            done();
          });
        });
      });
    });
    it('should save preferences incrementally', function(done) {
      async.series([

        function(next) {
          server.savePreferences({
            email: 'dummy@dummy.com',
          }, next);
        },
        function(next) {
          server.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.exist(preferences);
            preferences.email.should.equal('dummy@dummy.com');
            should.not.exist(preferences.language);
            next();
          });
        },
        function(next) {
          server.savePreferences({
            language: 'es',
          }, next);
        },
        function(next) {
          server.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.exist(preferences);
            preferences.language.should.equal('es');
            preferences.email.should.equal('dummy@dummy.com');
            next();
          });
        },
        function(next) {
          server.savePreferences({
            language: null,
            unit: 'bit',
          }, next);
        },
        function(next) {
          server.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.exist(preferences);
            preferences.unit.should.equal('bit');
            should.not.exist(preferences.language);
            preferences.email.should.equal('dummy@dummy.com');
            next();
          });
        },
      ], function(err) {
        should.not.exist(err);
        done();
      });
    });
    it.skip('should save preferences only for requesting wallet', function(done) {});
    it('should validate entries', function(done) {
      var invalid = [{
        preferences: {
          email: ' ',
        },
        expected: 'email'
      }, {
        preferences: {
          email: 'dummy@' + _.repeat('domain', 50),
        },
        expected: 'email'
      }, {
        preferences: {
          language: 'xxxxx',
        },
        expected: 'language'
      }, {
        preferences: {
          language: 123,
        },
        expected: 'language'
      }, {
        preferences: {
          unit: 'xxxxx',
        },
        expected: 'unit'
      }, ];
      async.each(invalid, function(item, next) {
        server.savePreferences(item.preferences, function(err) {
          should.exist(err);
          err.message.should.contain(item.expected);
          next();
        });
      }, done);
    });
  });

  describe('#getUtxos', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get UTXOs for wallet addresses', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2], function() {
        server.getUtxos({}, function(err, utxos) {
          should.not.exist(err);
          should.exist(utxos);
          utxos.length.should.equal(2);
          _.sumBy(utxos, 'satoshis').should.equal(3 * 1e8);
          server.getMainAddresses({}, function(err, addresses) {
            var utxo = utxos[0];
            var address = _.find(addresses, {
              address: utxo.address
            });
            should.exist(address);
            utxo.path.should.equal(address.path);
            utxo.publicKeys.should.deep.equal(address.publicKeys);
            done();
          });
        });
      });
    });
    it('should get UTXOs for specific addresses', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2, 3], function(utxos) {
        _.uniqBy(utxos, 'address').length.should.be.above(1);
        var address = utxos[0].address;
        var amount = _.sumBy(_.filter(utxos, {
          address: address
        }), 'satoshis');
        server.getUtxos({
          addresses: [address]
        }, function(err, utxos) {
          err.message.should.contain('no longer supported');
          done();
        });
      });
    });
    it('should not fail when getting UTXOs for wallet with 0 UTXOs and pending txps', function(done) {
      helpers.stubUtxos(server, wallet, [1, 1], function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 1e8,
          }],
          feePerKb: 100e2,
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
          blockchainExplorer.getUtxos = function(addresses, cb) {
            return cb(null, []);
          };

          server.getUtxos({}, function(err, utxos) {
            should.not.exist(err);
            utxos.should.be.empty;
            done();
          });
        });
      });
    });
  });

  describe('Multiple request Pub Keys', function() {
    var server, wallet;
    var opts, reqPrivKey, ws;
    var getAuthServer = function(copayerId, privKey, cb) {
      var msg = 'dummy';
      var sig = helpers.signMessage(msg, privKey);
      WalletService.getInstanceWithAuth({
        copayerId: copayerId,
        message: msg,
        signature: sig,
        clientVersion: helpers.CLIENT_VERSION,
      }, function(err, server) {
        return cb(err, server);
      });
    };

    beforeEach(function() {
      reqPrivKey = new Bitcore.PrivateKey();
      var requestPubKey = reqPrivKey.toPublicKey();

      var xPrivKey = TestData.copayers[0].xPrivKey_44H_0H_0H;
      var requestPubKeyStr = requestPubKey.toString();
      var sig = helpers.signRequestPubKey(requestPubKeyStr, xPrivKey);

      var copayerId = Model.Copayer._xPubToCopayerId('btc', TestData.copayers[0].xPubKey_44H_0H_0H);
      opts = {
        copayerId: copayerId,
        requestPubKey: requestPubKeyStr,
        signature: sig,
      };
      ws = new WalletService();
    });

    describe('#addAccess 1-1', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(1, 1, function(s, w) {
          server = s;
          wallet = w;

          helpers.stubUtxos(server, wallet, 1, function() {
            done();
          });
        });
      });

      it('should be able to re-gain access from xPrivKey', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          res.wallet.copayers[0].requestPubKeys.length.should.equal(2);
          res.wallet.copayers[0].requestPubKeys[0].selfSigned.should.equal(true);

          server.getBalance(res.wallet.walletId, function(err, bal) {
            should.not.exist(err);
            bal.totalAmount.should.equal(1e8);
            getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {

              server2.getBalance(res.wallet.walletId, function(err, bal2) {
                should.not.exist(err);
                bal2.totalAmount.should.equal(1e8);
                done();
              });
            });
          });
        });
      });

      it('should fail to gain access with wrong xPrivKey', function(done) {
        opts.signature = 'xx';
        ws.addAccess(opts, function(err, res) {
          err.code.should.equal('NOT_AUTHORIZED');
          done();
        });
      });

      it('should fail to access with wrong privkey after gaining access', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          server.getBalance(res.wallet.walletId, function(err, bal) {
            should.not.exist(err);
            var privKey = new Bitcore.PrivateKey();
            (getAuthServer(opts.copayerId, privKey, function(err, server2) {
              err.code.should.equal('NOT_AUTHORIZED');
              done();
            }));
          });
        });
      });

      it('should be able to create TXs after regaining access', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {
            var txOpts = {
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 0.8e8
              }],
              feePerKb: 100e2
            };
            server2.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    describe('#addAccess 2-2', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(2, 2, function(s, w) {
          server = s;
          wallet = w;
          helpers.stubUtxos(server, wallet, 1, function() {
            done();
          });
        });
      });

      it('should be able to re-gain access from  xPrivKey', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          server.getBalance(res.wallet.walletId, function(err, bal) {
            should.not.exist(err);
            bal.totalAmount.should.equal(1e8);
            getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {
              server2.getBalance(res.wallet.walletId, function(err, bal2) {
                should.not.exist(err);
                bal2.totalAmount.should.equal(1e8);
                done();
              });
            });
          });
        });
      });

      it('TX proposals should include info to be verified', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {
            var txOpts = {
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 0.8e8
              }],
              feePerKb: 100e2,
            };
            helpers.createAndPublishTx(server, txOpts, reqPrivKey, function() {
              server2.getPendingTxs({}, function(err, txs) {
                should.not.exist(err);
                should.exist(txs[0].proposalSignaturePubKey);
                should.exist(txs[0].proposalSignaturePubKeySig);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('#getBalance', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get balance', function(done) {
      helpers.stubUtxos(server, wallet, [1, 'u2', 3], function() {
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          should.exist(balance);
          balance.totalAmount.should.equal(helpers.toSatoshi(6));
          balance.lockedAmount.should.equal(0);
          balance.availableAmount.should.equal(helpers.toSatoshi(6));

          balance.totalConfirmedAmount.should.equal(helpers.toSatoshi(4));
          balance.lockedConfirmedAmount.should.equal(0);
          balance.availableConfirmedAmount.should.equal(helpers.toSatoshi(4));

          should.exist(balance.byAddress);
          balance.byAddress.length.should.equal(2);
          balance.byAddress[0].amount.should.equal(helpers.toSatoshi(4));
          balance.byAddress[1].amount.should.equal(helpers.toSatoshi(2));
          server.getMainAddresses({}, function(err, addresses) {
            should.not.exist(err);
            var addresses = _.uniq(_.map(addresses, 'address'));
            _.intersection(addresses, _.map(balance.byAddress, 'address')).length.should.equal(2);
            done();
          });
        });
      });
    });
    it('should get balance when there are no addresses', function(done) {
      server.getBalance({}, function(err, balance) {
        should.not.exist(err);
        should.exist(balance);
        balance.totalAmount.should.equal(0);
        balance.lockedAmount.should.equal(0);
        balance.availableAmount.should.equal(0);
        should.exist(balance.byAddress);
        balance.byAddress.length.should.equal(0);
        done();
      });
    });
    it('should get balance when there are no funds', function(done) {
      blockchainExplorer.getUtxos = sinon.stub().callsArgWith(1, null, []);
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          should.exist(balance);
          balance.totalAmount.should.equal(0);
          balance.lockedAmount.should.equal(0);
          balance.availableAmount.should.equal(0);
          should.exist(balance.byAddress);
          balance.byAddress.length.should.equal(0);
          done();
        });
      });
    });
    it('should only include addresses with balance', function(done) {
      helpers.stubUtxos(server, wallet, 1, function(utxos) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          server.getBalance({}, function(err, balance) {
            should.not.exist(err);
            balance.byAddress.length.should.equal(1);
            balance.byAddress[0].amount.should.equal(helpers.toSatoshi(1));
            balance.byAddress[0].address.should.equal(utxos[0].address);
            done();
          });
        });
      });
    });
    it('should fail gracefully when blockchain is unreachable', function(done) {
      blockchainExplorer.getUtxos = sinon.stub().callsArgWith(1, 'dummy error');
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        server.getBalance({}, function(err, balance) {
          should.exist(err);
          err.toString().should.equal('dummy error');
          done();
        });
      });
    });
    it('should get balance for a different coin', function(done) {
      helpers.stubUtxos(server, wallet, 1, function() {
        var spy = sinon.spy(server, '_getBlockchainExplorer');
        server.getBalance({
          coin: 'bch'
        }, function(err, balance) {
          err.message.should.contain('no longer supported');
          done();
        });
      });
    });
  });


  describe('#getBalance fast cache', function() {
    var server, wallet, clock;
    var _old = Defaults.BALANCE_CACHE_ADDRESS_THRESOLD;
    beforeEach(function(done) {
      clock = sinon.useFakeTimers({now: Date.now(), toFake: ['Date']});
      Defaults.BALANCE_CACHE_ADDRESS_THRESOLD = 0;

      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });
    afterEach(function() {
      clock.restore();
      Defaults.BALANCE_CACHE_ADDRESS_THRESOLD = _old;
    });

    function checkBalance(balance) {
      should.exist(balance);
      balance.totalAmount.should.equal(helpers.toSatoshi(6));
      should.exist(balance.byAddress);
      balance.byAddress.length.should.equal(2);
      balance.byAddress[1].amount.should.equal(helpers.toSatoshi(2));
    };

    it('should get balance from insight and store cache', function(done) {
      helpers.stubUtxos(server, wallet, [1, 'u2', 3], function() {
        server.getBalance({
        }, function(err, balance, cacheUsed) {
          should.not.exist(err);
          should.not.exist(cacheUsed);
          checkBalance(balance);
          done();
        });
      });
    });

    it('should get balance from cache', function(done) {
      helpers.stubUtxos(server, wallet, [1, 'u2', 3], function() {
        server.getBalance({
        }, function(err, balance, cacheUsed) {
          should.not.exist(err);
          should.not.exist(cacheUsed);
          server.getBalance({
          }, function(err, balance, cacheUsed) {
            should.not.exist(err);
            cacheUsed.should.equal(true);
            checkBalance(balance);
            done();
          });
        });
      });
    });


    it('should not get balance from cache, after X secs, on a direct hit', function(done) {
      helpers.stubUtxos(server, wallet, [1, 'u2', 3], function() {
        server.getBalance({
        }, function(err, balance, cacheUsed) {
          should.not.exist(err);
          should.not.exist(cacheUsed);
          clock.tick(( Defaults.BALANCE_CACHE_DIRECT_DURATION +1) * 1000);
          server.getBalance({
          }, function(err, balance, cacheUsed) {
            should.not.exist(err);
            should.not.exist(cacheUsed);
            checkBalance(balance);
            done();
          });
        });
      });
    });
  });


  describe('#getFeeLevels', function() {
    var server, wallet, levels;
    before(function() {
      levels = Defaults.FEE_LEVELS;
      Defaults.FEE_LEVELS = {
        btc: [{
          name: 'urgent',
          nbBlocks: 1,
          multiplier: 1.5,
          defaultValue: 50000,
        }, {
          name: 'priority',
          nbBlocks: 1,
          defaultValue: 50000
        }, {
          name: 'normal',
          nbBlocks: 2,
          defaultValue: 40000
        }, {
          name: 'economy',
          nbBlocks: 6,
          defaultValue: 25000
        }, {
          name: 'superEconomy',
          nbBlocks: 24,
          defaultValue: 10000
        }]
      };
    });
    after(function() {
      Defaults.FEE_LEVELS = levels;
    });
    var clock;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
      clock = sinon.useFakeTimers({now: Date.now(), toFake: ['Date']});
    });

    afterEach(function() {
      clock.restore();
    });
 

    it('should get current fee levels', function(done) {
      helpers.stubFeeLevels({
        1: 40000,
        2: 20000,
        6: 18000,
        24: 9000,
      });
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = _.fromPairs(_.map(fees, function(item) {
          return [item.level, item];
        }));
        fees.urgent.feePerKb.should.equal(60000);
        fees.urgent.nbBlocks.should.equal(1);

        fees.priority.feePerKb.should.equal(40000);
        fees.priority.nbBlocks.should.equal(1);

        fees.normal.feePerKb.should.equal(20000);
        fees.normal.nbBlocks.should.equal(2);

        fees.economy.feePerKb.should.equal(18000);
        fees.economy.nbBlocks.should.equal(6);

        fees.superEconomy.feePerKb.should.equal(9000);
        fees.superEconomy.nbBlocks.should.equal(24);
        done();
      });
    });
    it('should get default fees if network cannot be accessed', function(done) {
      blockchainExplorer.estimateFee = sinon.stub().yields('dummy error');
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = _.fromPairs(_.map(fees, function(item) {
          return [item.level, item.feePerKb];
        }));
        var defaults = _.fromPairs(_.map(Defaults.FEE_LEVELS['btc'], function(item) {
          return [item.name, item.defaultValue];
        }));
        fees.priority.should.equal(defaults.priority);
        fees.normal.should.equal(defaults.normal);
        fees.economy.should.equal(defaults.economy);
        done();
      });
    });
    it('should fallback to slower confirmation times if network cannot estimate (returns -1)', function(done) {
      helpers.stubFeeLevels({
        1: -1,
        2: 18000,
        6: -1,
        7: 11000,
        24: 9000,
      });
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = _.fromPairs(_.map(fees, function(item) {
          return [item.level, item];
        }));
        fees.priority.feePerKb.should.equal(18000);
        fees.priority.nbBlocks.should.equal(2);

        fees.normal.feePerKb.should.equal(18000);
        fees.normal.nbBlocks.should.equal(2);

        fees.economy.feePerKb.should.equal(11000);
        fees.economy.nbBlocks.should.equal(7);

        fees.superEconomy.feePerKb.should.equal(9000);
        fees.superEconomy.nbBlocks.should.equal(24);
        done();
      });
    });
    it('should get default fees if network cannot estimate (returns -1 including fallback)', function(done) {
      helpers.stubFeeLevels({
        1: 45000,
        2: 36000,
        6: -1,
        7: -1,
        8: -1,
        24: 9000,
      });
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = _.fromPairs(_.map(fees, function(item) {
          return [item.level, item];
        }));

        fees.priority.feePerKb.should.equal(45000);
        fees.priority.nbBlocks.should.equal(1);

        fees.normal.feePerKb.should.equal(36000);
        fees.normal.nbBlocks.should.equal(2);

        fees.economy.feePerKb.should.equal(25000);
        should.not.exist(fees.economy.nbBlocks);
        done();
      });
    });
    it('should get monotonically decreasing fee values', function(done) {
      _.find(Defaults.FEE_LEVELS['btc'], {
        nbBlocks: 6
      }).defaultValue.should.equal(25000);
      helpers.stubFeeLevels({
        1: 45000,
        2: 18000,
        6: -1,
        7: -1,
        8: -1,
        24: 9000,
      });
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = _.fromPairs(_.map(fees, function(item) {
          return [item.level, item];
        }));

        fees.priority.feePerKb.should.equal(45000);
        fees.priority.nbBlocks.should.equal(1);

        fees.normal.feePerKb.should.equal(18000);
        fees.normal.nbBlocks.should.equal(2);

        fees.economy.feePerKb.should.equal(18000);
        should.not.exist(fees.economy.nbBlocks);

        fees.superEconomy.feePerKb.should.equal(9000);
        fees.superEconomy.nbBlocks.should.equal(24);
        done();
      });
    });

    it('should get current fee levels FROM CACHE', function(done) {
      helpers.stubFeeLevels({
        1: 40000,
        2: 20000,
      });
      server.getFeeLevels({}, function(err, fees, fromCache) {
        should.not.exist(err);
        fees = _.fromPairs(_.map(fees, function(item) {
          return [item.level, item];
        }));
        fees.urgent.feePerKb.should.equal(60000);
        fees.priority.feePerKb.should.equal(40000);
        should.not.exist(fromCache);
        server.getFeeLevels({}, function(err, fees, fromCache) {
          should.not.exist(err);
          fees = _.fromPairs(_.map(fees, function(item) {
            return [item.level, item];
          }));
          fees.urgent.feePerKb.should.equal(60000);
          fees.priority.feePerKb.should.equal(40000);
          fromCache.should.equal(true);
          done();
        });
      });
    });


    it('should expire CACHE', function(done) {
      helpers.stubFeeLevels({
        1: 40000,
        2: 20000,
      });
      server.getFeeLevels({}, function(err, fees, fromCache) {
        should.not.exist(err);
        fees = _.fromPairs(_.map(fees, function(item) {
          return [item.level, item];
        }));
        fees.urgent.feePerKb.should.equal(60000);
        fees.priority.feePerKb.should.equal(40000);
        should.not.exist(fromCache);
        clock.tick(6*60*1000);
        server.getFeeLevels({}, function(err, fees, fromCache) {
          should.not.exist(err);
          fees = _.fromPairs(_.map(fees, function(item) {
            return [item.level, item];
          }));
          fees.urgent.feePerKb.should.equal(60000);
          fees.priority.feePerKb.should.equal(40000);
          should.not.exist(fromCache);
          done();
        });
      });
    });


    it('should not use cache on different opts', function(done) {
      helpers.stubFeeLevels({
        1: 40000,
        2: 20000,
      });
      server.getFeeLevels({}, function(err, fees, fromCache) {
        should.not.exist(err);
        should.not.exist(fromCache);
        server.getFeeLevels({coin:'bch'}, function(err, fees, fromCache) {
          should.not.exist(err);
          should.not.exist(fromCache);
          server.getFeeLevels({coin:'bch', network:'testnet'}, function(err, fees, fromCache) {
            should.not.exist(err);
            should.not.exist(fromCache);
            done();
          });
        });
      });
    });


  });

  describe('Wallet not complete tests', function() {
    it('should fail to create address when wallet is not complete', function(done) {
      var server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_45H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server) {
            server.createAddress({}, function(err, address) {
              should.not.exist(address);
              should.exist(err);
              err.code.should.equal('WALLET_NOT_COMPLETE');
              err.message.should.equal('Wallet is not complete');
              done();
            });
          });
        });
      });
    });

    it('should fail to create tx when wallet is not complete', function(done) {
      var server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_45H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server, wallet) {
            var txOpts = {
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 0.8e8
              }],
              feePerKb: 100e2
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(tx);
              should.exist(err);
              err.code.should.equal('WALLET_NOT_COMPLETE');
              done();
            });
          });
        });
      });
    });
  });

  var addrMap = {
    btc: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
    bch: 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X',
  }

  var idKeyMap = {
      btc: 'id44btc',
      bch: 'id44bch',
  };

  _.each(['bch', 'btc'], function(coin) {
  
    describe('#createTx ' + coin, function() {
      var addressStr, idKey;
      before(function() {
        addressStr = addrMap[coin];
        idKey = idKeyMap[coin];
      });



      describe('Tx proposal creation & publishing ' + coin, function() {
        var server, wallet;
        beforeEach(function(done) {
          helpers.createAndJoinWallet(1, 1, { 
            coin: coin,
          },  function(s, w) {
            server = s;
            wallet = w;
            done();
          });
        });


        it('should create a tx', function(done) {
          helpers.stubUtxos(server, wallet, [1, 2], function() {
            let amount = 0.8 * 1e8;
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: amount,
              }],
              message: 'some message',
              customData: 'some custom data',
              feePerKb: 123e2,
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              tx.walletM.should.equal(1);
              tx.walletN.should.equal(1);
              tx.requiredRejections.should.equal(1);
              tx.requiredSignatures.should.equal(1);
              tx.isAccepted().should.equal.false;
              tx.isRejected().should.equal.false;
              tx.isPending().should.equal.true;
              tx.isTemporary().should.equal.true;
              tx.amount.should.equal(helpers.toSatoshi(0.8));
              tx.feePerKb.should.equal(123e2);
              tx.outputs.should.deep.equal([{
                toAddress: addressStr,
                amount: amount,
              }]);

              should.not.exist(tx.feeLevel);
              server.getPendingTxs({}, function(err, txs) {
                should.not.exist(err);
                txs.should.be.empty;
                done();
              });
            });
          });
        });

        describe('Validations', function() {
          it('should fail to create a tx without outputs', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], function() {
              var txOpts = {
                outputs: [],
                feePerKb: 123e2,
              };
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                should.not.exist(tx);
                err.message.should.equal('No outputs were specified');
                done();
              });
            });
          });
          it('should fail to create tx for invalid address', function(done) {
            helpers.stubUtxos(server, wallet, 1, function() {
              var txOpts = {
                outputs: [{
                  toAddress: 'invalid address',
                  amount: 0.5e8
                }],
                feePerKb: 100e2,
              };
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                should.not.exist(tx);
                // may fail due to Non-base58 character, or Checksum mismatch, or other
                done();
              });
            });
          });
          it('should fail to create tx for address of different network', function(done) {
            helpers.stubUtxos(server, wallet, 1, function() {
              var txOpts = {
                outputs: [{
                  toAddress: 'myE38JHdxmQcTJGP1ZiX4BiGhDxMJDvLJD',
                  amount: 0.5e8
                }],
                feePerKb: 100e2,
              };
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(tx);
                should.exist(err);
                err.code.should.equal('INCORRECT_ADDRESS_NETWORK');
                err.message.should.equal('Incorrect address network');
                done();
              });
            });
          });
          it('should fail to create tx for invalid amount', function(done) {
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 0,
              }],
              feePerKb: 100e2,
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(tx);
              should.exist(err);
              err.message.should.equal('Invalid amount');
              done();
            });
          });
          it('should fail to specify both feeLevel & feePerKb', function(done) {
            helpers.stubUtxos(server, wallet, 2, function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
                feeLevel: 'normal',
                feePerKb: 123e2,
              };
              server.createTx(txOpts, function(err, txp) {
                should.exist(err);
                should.not.exist(txp);
                err.toString().should.contain('Only one of feeLevel/feePerKb');
                done();
              });
            });
          });
          it('should be able to create tx with inputs argument', function(done) {
            helpers.stubUtxos(server, wallet, [1, 3, 2], function(utxos) {
              server.getUtxos({}, function(err, utxos) {
                should.not.exist(err);
                var inputs = [utxos[0], utxos[2]];
                var txOpts = {
                  outputs: [{
                    toAddress: addressStr,
                    amount: 2.5e8,
                  }],
                  feePerKb: 100e2,
                  inputs: inputs,
                };
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(err);
                  should.exist(tx);
                  tx.inputs.length.should.equal(2);
                  var txids = _.map(tx.inputs, 'txid');
                  txids.should.contain(utxos[0].txid);
                  txids.should.contain(utxos[2].txid);
                  done();
                });
              });
            });
          });
          it('should be able to specify change address', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], function(utxos) {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8e8,
                }],
                feePerKb: 100e2,
                changeAddress: utxos[0].address,
              };
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                should.exist(tx);
                var t = tx.getBitcoreTx();

                if (coin == 'bch') { 
                  t.getChangeOutput().script.toAddress().toLegacyAddress().should.equal(txOpts.changeAddress);
                } else {
                  t.getChangeOutput().script.toAddress().toString().should.equal(txOpts.changeAddress);
                }
                done();
              });
            });
          });
          it('should be fail if specified change address is not from the wallet', function(done) {

            helpers.stubUtxos(server, wallet, [1, 2], function(utxos) {

              var addr = (new Bitcore_[coin].PrivateKey()).toAddress();
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8e8,
                }],
                feePerKb: 100e2,
                changeAddress: addr.toString(),
              };
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                err.code.should.equal('INVALID_CHANGE_ADDRESS');
                done();
              });
            });
          });
 
          it('should be able to specify inputs & absolute fee', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], function(utxos) {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8e8,
                }],
                inputs: utxos,
                fee: 1000e2,
              };
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                should.exist(tx);
                tx.amount.should.equal(helpers.toSatoshi(0.8));
                should.not.exist(tx.feePerKb);
                tx.fee.should.equal(1000e2);
                var t = tx.getBitcoreTx();
                t.getFee().should.equal(1000e2);
                t.getChangeOutput().satoshis.should.equal(3e8 - 0.8e8 - 1000e2);
                done();
              });
            });
          });
        });

        describe('Foreign ID', function() {
          it('should create a tx with foreign ID', function(done) {
            helpers.stubUtxos(server, wallet, 2, function() {
              var txOpts = {
                txProposalId: '123',
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
                feePerKb: 100e2,
              };
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                should.exist(tx);
                tx.id.should.equal('123');
                done();
              });
            });
          });
          it('should return already created tx if same foreign ID is specified and tx still unpublished', function(done) {
            helpers.stubUtxos(server, wallet, 2, function() {
              var txOpts = {
                txProposalId: '123',
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
                feePerKb: 100e2,
              };
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                should.exist(tx);
                tx.id.should.equal('123');
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(err);
                  should.exist(tx);
                  tx.id.should.equal('123');
                  server.storage.fetchTxs(wallet.id, {}, function(err, txs) {
                    should.not.exist(err);
                    should.exist(txs);
                    txs.length.should.equal(1);
                    done();
                  });
                });
              });
            });
          });
          it('should return already published tx if same foreign ID is specified and tx already published', function(done) {
            helpers.stubUtxos(server, wallet, [2, 2, 2], function() {
              var txOpts = {
                txProposalId: '123',
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
                feePerKb: 100e2,
              };
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                should.exist(tx);
                tx.id.should.equal('123');
                var publishOpts = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, function(err, tx) {
                  should.not.exist(err);
                  should.exist(tx);
                  server.createTx(txOpts, function(err, tx) {
                    should.not.exist(err);
                    should.exist(tx);
                    tx.id.should.equal('123');
                    tx.status.should.equal('pending');
                    server.storage.fetchTxs(wallet.id, {}, function(err, txs) {
                      should.not.exist(err);
                      txs.length.should.equal(1);
                      done();
                    });
                  });
                });
              });
            });
          });
        });

        describe('Publishing', function() {
          it('should be able to publish a temporary tx proposal', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8 * 1e8,
                }],
                feePerKb: 100e2,
                message: 'some message',
                customData: 'some custom data',
              };
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                var publishOpts = helpers.getProposalSignatureOpts(txp, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, function(err) {
                  should.not.exist(err);
                  server.getPendingTxs({}, function(err, txs) {
                    should.not.exist(err);
                    txs.length.should.equal(1);
                    should.exist(txs[0].proposalSignature);
                    done();
                  });
                });
              });
            });
          });
          it('should not be able to publish a temporary tx proposal created in a dry run', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8 * 1e8,
                }],
                feePerKb: 100e2,
                dryRun: true,
              };
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                var publishOpts = helpers.getProposalSignatureOpts(txp, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, function(err) {
                  should.exist(err);
                  err.code.should.equal('TX_NOT_FOUND');
                  server.getPendingTxs({}, function(err, txs) {
                    should.not.exist(err);
                    txs.length.should.equal(0);
                    done();
                  });
                });
              });
            });
          });
          it('should delay NewTxProposal notification until published', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8 * 1e8,
                }],
                feePerKb: 100e2,
                message: 'some message',
              };
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                server.getNotifications({}, function(err, notifications) {
                  should.not.exist(err);
                  _.map(notifications, 'type').should.not.contain('NewTxProposal');
                  var publishOpts = helpers.getProposalSignatureOpts(txp, TestData.copayers[0].privKey_1H_0);
                  server.publishTx(publishOpts, function(err) {
                    should.not.exist(err);
                    server.getNotifications({}, function(err, notifications) {
                      should.not.exist(err);

                      var n = _.find(notifications, {
                        'type': 'NewTxProposal'
                      });
                      should.exist(n);
                      should.exist(n.data.txProposalId);
                      should.exist(n.data.message);
                      should.exist(n.data.creatorId);
                      n.data.creatorId.should.equal(server.copayerId);
                      done();
                    });
                  });
                });
              });
            });
          });
          it('should fail to publish non-existent tx proposal', function(done) {
            server.publishTx({
              txProposalId: 'wrong-id',
              proposalSignature: 'dummy',
            }, function(err) {
              should.exist(err);
              server.getPendingTxs({}, function(err, txs) {
                should.not.exist(err);
                txs.should.be.empty;
                done();
              });
            });
          });
          it('should fail to publish tx proposal with wrong signature', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8 * 1e8,
                }],
                feePerKb: 100e2,
                message: 'some message',
              };
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                server.publishTx({
                  txProposalId: txp.id,
                  proposalSignature: 'dummy'
                }, function(err) {
                  should.exist(err);
                  err.message.should.contain('Invalid proposal signature');
                  done();
                });
              });
            });
          });
          it('should fail to publish tx proposal not signed by the creator', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8 * 1e8,
                }],
                feePerKb: 100e2,
                message: 'some message',
              };
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);

                var publishOpts = {
                  txProposalId: txp.id,
                  proposalSignature: helpers.signMessage(txp.getRawTx(), TestData.copayers[1].privKey_1H_0),
                }

                server.publishTx(publishOpts, function(err) {
                  should.exist(err);
                  err.message.should.contain('Invalid proposal signature');
                  done();
                });
              });
            });
          });
          it('should fail to publish a temporary tx proposal if utxos are locked by other pending proposals', function(done) {
            var txp1, txp2;
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 0.8 * 1e8,
              }],
              message: 'some message',
              feePerKb: 100e2,
            };

            async.waterfall([

              function(next) {
                helpers.stubUtxos(server, wallet, [1, 2], function() {
                  next();
                });
              },
              function(next) {
                server.createTx(txOpts, next);
              },
              function(txp, next) {
                txp1 = txp;
                server.createTx(txOpts, next);
              },
              function(txp, next) {
                txp2 = txp;
                should.exist(txp1);
                should.exist(txp2);
                var publishOpts = helpers.getProposalSignatureOpts(txp1, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, next);
              },
              function(txp, next) {
                var publishOpts = helpers.getProposalSignatureOpts(txp2, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, function(err) {
                  should.exist(err);
                  err.code.should.equal('UNAVAILABLE_UTXOS');
                  next();
                });
              },
              function(next) {
                server.getPendingTxs({}, function(err, txs) {
                  should.not.exist(err);
                  txs.length.should.equal(1);
                  next();
                });
              },
              function(next) {
                // A new tx proposal should use the next available UTXO
                server.createTx(txOpts, next);
              },
              function(txp3, next) {
                should.exist(txp3);
                var publishOpts = helpers.getProposalSignatureOpts(txp3, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, next);
              },
              function(txp, next) {
                server.getPendingTxs({}, function(err, txs) {
                  should.not.exist(err);
                  txs.length.should.equal(2);
                  next();
                });
              },
            ], function(err) {
              should.not.exist(err);
              done();
            });
          });
          it('should fail to publish a temporary tx proposal if utxos are already spent', function(done) {
            var txp1, txp2;
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 0.8 * 1e8,
              }],
              message: 'some message',
              feePerKb: 100e2,
            };

            async.waterfall([

              function(next) {
                helpers.stubUtxos(server, wallet, [1, 2], function() {
                  next();
                });
              },
              function(next) {
                server.createTx(txOpts, next);
              },
              function(txp, next) {
                txp1 = txp;
                server.createTx(txOpts, next);
              },
              function(txp, next) {
                txp2 = txp;
                should.exist(txp1);
                should.exist(txp2);
                var publishOpts = helpers.getProposalSignatureOpts(txp1, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, next);
              },
              function(txp, next) {
                // Sign & Broadcast txp1
                var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
                server.signTx({
                  txProposalId: txp.id,
                  signatures: signatures,
                }, function(err, txp) {
                  should.not.exist(err);

                  helpers.stubBroadcast();
                  server.broadcastTx({
                    txProposalId: txp.id
                  }, function(err, txp) {
                    should.not.exist(err);
                    should.exist(txp.txid);
                    txp.status.should.equal('broadcasted');
                    next();
                  });
                });
              },
              function(next) {
                var publishOpts = helpers.getProposalSignatureOpts(txp2, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, function(err) {
                  should.exist(err);
                  err.code.should.equal('UNAVAILABLE_UTXOS');
                  next();
                });
              },
            ], function(err) {
              should.not.exist(err);
              done();
            });
          });
        });

        describe('Fee levels', function() {
          it('should create a tx specifying feeLevel', function(done) {
            //ToDo
            var level = wallet.coin == 'btc' ? 'economy' : 'normal';
            var expected = wallet.coin == 'btc' ? 180e2 : 200e2;
            helpers.stubFeeLevels({
              1: 400e2,
              2: 200e2,
              6: 180e2,
              24: 90e2,
            });
            helpers.stubUtxos(server, wallet, 2, function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
                // ToDo
                feeLevel: level,
              };
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                txp.feePerKb.should.equal(expected);
                txp.feeLevel.should.equal(level);
                done();
              });
            });
          });
          it('should fail if the specified fee level does not exist', function(done) {
            helpers.stubUtxos(server, wallet, 2, function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
                feeLevel: 'madeUpLevel',
              };
              server.createTx(txOpts, function(err, txp) {
                should.exist(err);
                should.not.exist(txp);
                err.toString().should.contain('Invalid fee level');
                done();
              });
            });
          });
          it('should assume "normal" fee level if no feeLevel and no feePerKb/fee is specified', function(done) {
            helpers.stubFeeLevels({
              1: 400e2,
              2: 200e2,
              6: 180e2,
              24: 90e2,
            });
            helpers.stubUtxos(server, wallet, 2, function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
              };
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                txp.feePerKb.should.equal(200e2);
                txp.feeLevel.should.equal('normal');
                done();
              });
            });
          });
        });
        it('should generate new change address for each created tx', function(done) {
          helpers.stubUtxos(server, wallet, [1, 2], function() {
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 0.8e8,
              }],
              feePerKb: 100e2,
            };
            server.createTx(txOpts, function(err, tx1) {
              should.not.exist(err);
              should.exist(tx1);
              server.createTx(txOpts, function(err, tx2) {
                should.not.exist(err);
                should.exist(tx2);
                tx1.changeAddress.address.should.not.equal(tx2.changeAddress.address);
                done();
              });
            });
          });
        });
        it('should support creating a tx with no change address', function(done) {
          helpers.stubUtxos(server, wallet, [1, 2], function() {
            var max = 3e8 - 7000; // Fees for this tx at 100bits/kB = 7000 sat
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: max,
              }],
              feePerKb: 100e2,
            };
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              var t = txp.getBitcoreTx().toObject();
              t.outputs.length.should.equal(1);
              t.outputs[0].satoshis.should.equal(max);
              done();
            });
          });
        });
        it('should fail gracefully if unable to reach the blockchain', function(done) {
          blockchainExplorer.getUtxos = sinon.stub().callsArgWith(1, 'dummy error');
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 1e8
              }],
              feePerKb: 100e2,
            };
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.toString().should.equal('dummy error');
              done();
            });
          });
        });
        it('should fail gracefully when bitcore throws exception on raw tx creation', function(done) {
          helpers.stubUtxos(server, wallet, 1,  function() {
            var bitcoreStub = sinon.stub(Bitcore_[coin], 'Transaction');
            bitcoreStub.throws({
              name: 'dummy',
              message: 'dummy exception'
            });
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 0.5e8,
              }],
              feePerKb: 100e2,
            };
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.message.should.equal('dummy exception');
              bitcoreStub.restore();
              done();
            });
          });
        });
        it('should fail to create a tx exceeding max size in kb', function(done) {
          var _oldDefault = Defaults.MAX_TX_SIZE_IN_KB;
          Defaults.MAX_TX_SIZE_IN_KB = 1;
          helpers.stubUtxos(server, wallet, _.range(1, 10, 0), function() {
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 8e8,
              }],
              feePerKb: 100e2,
            };
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('TX_MAX_SIZE_EXCEEDED');
              Defaults.MAX_TX_SIZE_IN_KB = _oldDefault;
              done();
            });
          });
        });
        it('should fail with different error for insufficient funds and locked funds', function(done) {
          helpers.stubUtxos(server, wallet, [1, 1], function() {
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 1.1e8,
              }],
              feePerKb: 100e2,
            };
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.totalAmount.should.equal(2e8);
                balance.lockedAmount.should.equal(2e8);
                txOpts.outputs[0].amount = 0.8e8;
                server.createTx(txOpts, function(err, tx) {
                  should.exist(err);
                  err.code.should.equal('LOCKED_FUNDS');
                  err.message.should.equal('Funds are locked by pending transaction proposals');
                  done();
                });
              });
            });
          });
        });
        it('should fail to create tx for dust amount in outputs', function(done) {
          helpers.stubUtxos(server, wallet, 1, function() {
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 20e2,
              }],
              feePerKb: 100e2,
            };
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('DUST_AMOUNT');
              err.message.should.equal('Amount below dust threshold');
              done();
            });
          });
        });
        it('should create tx with 0 change output', function(done) {
          helpers.stubUtxos(server, wallet, 1, function() {
            var fee = 4100; // The exact fee of the resulting tx
            var amount = 1e8 - fee;

            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: amount,
              }],
              feePerKb: 100e2,
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              var bitcoreTx = tx.getBitcoreTx();
              bitcoreTx.outputs.length.should.equal(1);
              bitcoreTx.outputs[0].satoshis.should.equal(tx.amount);
              done();
            });
          });
        });
        it('should create tx when there is a pending tx and enough UTXOs', function(done) {
          helpers.stubUtxos(server, wallet, [1.1, 1.2, 1.3], function() {
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 1.5e8,
              }],
              feePerKb: 100e2,
            };
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              should.exist(tx);
              txOpts.outputs[0].amount = 0.8e8;
              helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
                should.exist(tx);
                server.getPendingTxs({}, function(err, txs) {
                  should.not.exist(err);
                  txs.length.should.equal(2);
                  server.getBalance({}, function(err, balance) {
                    should.not.exist(err);
                    balance.totalAmount.should.equal(3.6e8);
                    balance.lockedAmount.should.equal(3.6e8);
                    done();
                  });
                });
              });
            });
          });
        });
        it('should fail to create tx when there is a pending tx and not enough UTXOs', function(done) {
          helpers.stubUtxos(server, wallet, [1.1, 1.2, 1.3], function() {
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: 1.5e8,
              }],
              feePerKb: 100e2,
            };
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              should.exist(tx);
              txOpts.outputs[0].amount = 1.8e8;
              server.createTx(txOpts, function(err, tx) {
                err.code.should.equal('LOCKED_FUNDS');
                should.not.exist(tx);
                server.getPendingTxs({}, function(err, txs) {
                  should.not.exist(err);
                  txs.length.should.equal(1);
                  server.getBalance({}, function(err, balance) {
                    should.not.exist(err);
                    balance.totalAmount.should.equal(3.6e8);
                    var amountInputs = _.sumBy(txs[0].inputs, 'satoshis');
                    balance.lockedAmount.should.equal(amountInputs);
                    balance.lockedAmount.should.be.below(balance.totalAmount);
                    balance.availableAmount.should.equal(balance.totalAmount - balance.lockedAmount);
                    done();
                  });
                });
              });
            });
          });
        });
        it('should accept a tx proposal signed with a custom key', function(done) {
          var reqPrivKey = new Bitcore.PrivateKey();
          var reqPubKey = reqPrivKey.toPublicKey().toString();

          var xPrivKey = TestData.copayers[0].xPrivKey_44H_0H_0H;

          var accessOpts = {
            copayerId: TestData.copayers[0][idKey],
            requestPubKey: reqPubKey,
            signature: helpers.signRequestPubKey(reqPubKey, xPrivKey),
          };

          server.addAccess(accessOpts, function(err) {
            should.not.exist(err);

            helpers.stubUtxos(server, wallet, [1, 2], function() {
              var txOpts = {
                outputs: [{
                  toAddress: addressStr,
                  amount: 0.8 * 1e8,
                }],
                message: 'some message',
                feePerKb: 100e2,
              };
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);

                var publishOpts = {
                  txProposalId: txp.id,
                  proposalSignature: helpers.signMessage(txp.getRawTx(), reqPrivKey),
                }

                server.publishTx(publishOpts, function(err) {
                  should.not.exist(err);
                  server.getTx({
                    txProposalId: txp.id
                  }, function(err, x) {
                    should.not.exist(err);
                    x.proposalSignature.should.equal(publishOpts.proposalSignature);
                    x.proposalSignaturePubKey.should.equal(accessOpts.requestPubKey);
                    x.proposalSignaturePubKeySig.should.equal(accessOpts.signature);
                    done();
                  });
                });
              });
            });
          });
        });
        it('should be able to send max funds', function(done) {
          helpers.stubUtxos(server, wallet, [1, 2], function() {
            var txOpts = {
              outputs: [{
                toAddress: addressStr,
                amount: null,
              }],
              feePerKb: 10000,
              sendMax: true,
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              should.not.exist(tx.changeAddress);
              tx.amount.should.equal(3e8 - tx.fee);

              var t = tx.getBitcoreTx();
              t.getFee().should.equal(tx.fee);
              should.not.exist(t.getChangeOutput());
              t.toObject().inputs.length.should.equal(tx.inputs.length);
              t.toObject().outputs[0].satoshis.should.equal(tx.amount);
              done();
            });
          });
        });
        it('should shuffle outputs unless specified', function(done) {
          helpers.stubUtxos(server, wallet, 1, function() {
            var txOpts = {
              outputs: _.times(30, function(i) {
                return {
                  toAddress: addressStr,
                  amount: (i + 1) * 100e2,
                };
              }),
              feePerKb: 123e2,
            };
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              var t = txp.getBitcoreTx();
              var changeOutput = t.getChangeOutput().satoshis;
              var outputs = _.without(_.map(t.outputs, 'satoshis'), changeOutput);

              outputs.should.not.deep.equal(_.map(txOpts.outputs, 'amount'));
              txOpts.noShuffleOutputs = true;
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);

                t = txp.getBitcoreTx();
                changeOutput = t.getChangeOutput().satoshis;
                outputs = _.without(_.map(t.outputs, 'satoshis'), changeOutput);

                outputs.should.deep.equal(_.map(txOpts.outputs, 'amount'));
                done();
              });
            });
          });
        });
      });
    });

    describe('Backoff time', function(done) {
      var server, wallet, txid, clock;
      var _oldBackoffOffset = Defaults.BACKOFF_OFFSET;
      beforeEach(function(done) {
        Defaults.BACKOFF_OFFSET = 3;
        helpers.createAndJoinWallet(2, 2, function(s, w) {
          server = s;
          wallet = w;
          helpers.stubUtxos(server, wallet, _.range(2, 6), function() {
            done();
          });
        });
      });
      afterEach(function(done) {
        Defaults.BACKOFF_OFFSET = _oldBackoffOffset;
        clock.restore();
        done();
      });

      it('should follow backoff time after consecutive rejections', function(done) {
        clock = sinon.useFakeTimers({now: Date.now(), toFake: ['Date']});
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 1e8,
          }],
          feePerKb: 100e2,
        };
        async.series([

          function(next) {
            async.each(_.range(3), function(i, next) {
                helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
                  server.rejectTx({
                    txProposalId: tx.id,
                    reason: 'some reason',
                  }, next);
                });
              },
              next);
          },
          function(next) {
            // Allow a 4th tx
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              server.rejectTx({
                txProposalId: tx.id,
                reason: 'some reason',
              }, next);
            });
          },
          function(next) {
            // Do not allow before backoff time
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('TX_CANNOT_CREATE');
              next();
            });
          },
          function(next) {
            clock.tick((Defaults.BACKOFF_TIME + 1) * 1000);
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              server.rejectTx({
                txProposalId: tx.id,
                reason: 'some reason',
              }, next);
            });
          },
          function(next) {
            // Do not allow a 5th tx before backoff time
            clock.tick((Defaults.BACKOFF_TIME - 1) * 1000);
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('TX_CANNOT_CREATE');
              next();
            });
          },
          function(next) {
            clock.tick(2000);
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              server.rejectTx({
                txProposalId: tx.id,
                reason: 'some reason',
              }, next);
            });
          },
        ], function(err) {
          should.not.exist(err);
          done();
        });
      });
    });

    describe('UTXO Selection', function() {
      var server, wallet;
      beforeEach(function(done) {
        // log.level = 'debug';
        helpers.createAndJoinWallet(1, 2, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });
      afterEach(function() {
        log.level = 'info';
      });

      it('should exclude unconfirmed utxos if specified', function(done) {
        helpers.stubUtxos(server, wallet, [1.3, 'u2', 'u0.1', 1.2], function(utxos) {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 3e8
            }],
            feePerKb: 100e2,
            excludeUnconfirmedUtxos: true,
          };
          server.createTx(txOpts, function(err, tx) {
            should.exist(err);
            err.code.should.equal('INSUFFICIENT_FUNDS');
            err.message.should.equal('Insufficient funds');
            txOpts.outputs[0].amount = 2.5e8;
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
              err.message.should.equal('Insufficient funds for fee');
              done();
            });
          });
        });
      });
      it('should use non-locked confirmed utxos when specified', function(done) {
        helpers.stubUtxos(server, wallet, [1.3, 'u2', 'u0.1', 1.2], function(utxos) {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 1.4e8
            }],
            feePerKb: 100e2,
            excludeUnconfirmedUtxos: true,
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
            should.exist(tx);
            tx.inputs.length.should.equal(2);
            server.getBalance({}, function(err, balance) {
              should.not.exist(err);
              balance.lockedConfirmedAmount.should.equal(helpers.toSatoshi(2.5));
              balance.availableConfirmedAmount.should.equal(0);
              txOpts.outputs[0].amount = 0.01e8;
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                err.code.should.equal('LOCKED_FUNDS');
                done();
              });
            });
          });
        });
      });
      it('should not use UTXO provided in utxosToExclude option', function(done) {
        helpers.stubUtxos(server, wallet, [1, 2, 3], function(utxos) {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 3.5e8,
            }],
            feePerKb: 100e2,
            utxosToExclude: [utxos[2].txid + ':' + utxos[2].vout],
          };
          server.createTx(txOpts, function(err, tx) {
            should.exist(err);
            err.code.should.equal('INSUFFICIENT_FUNDS');
            err.message.should.equal('Insufficient funds');
            txOpts.utxosToExclude = [utxos[0].txid + ':' + utxos[0].vout];
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              done();
            });
          });
        });
      });
      it('should select a single utxo if within thresholds relative to tx amount', function(done) {
        helpers.stubUtxos(server, wallet, [1, '350bit', '100bit', '100bit', '100bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 200e2,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(1);
            txp.inputs[0].satoshis.should.equal(35000);

            done();
          });
        });
      });
      it('should return inputs in random order', function(done) {
        // NOTE: this test has a chance of failing of 1 in 1'073'741'824 :P
        helpers.stubUtxos(server, wallet, _.range(1, 31), function(utxos) {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: _.sumBy(utxos, 'satoshis') - 0.5e8,
            }],
            feePerKb: 100e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            var amounts = _.map(txp.inputs, 'satoshis');
            amounts.length.should.equal(30);
            _.every(amounts, function(amount, i) {
              if (i == 0) return true;
              return amount < amounts[i - 1];
            }).should.be.false;
            done();
          });
        });
      });
      it('should select a confirmed utxos if within thresholds relative to tx amount', function(done) {
        helpers.stubUtxos(server, wallet, [1, 'u 350bit', '100bit', '100bit', '100bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 200e2,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(3);
            txp.inputs[0].satoshis.should.equal(10000);

            done();
          });
        });
      });
      it('should select smaller utxos if within fee constraints', function(done) {
        helpers.stubUtxos(server, wallet, [1, '800bit', '800bit', '800bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 2000e2,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(3);
            _.every(txp.inputs, function(input) {
              return input == 100e2;
            });
            done();
          });
        });
      });
      it('should select smallest big utxo if small utxos are insufficient', function(done) {
        helpers.stubUtxos(server, wallet, [3, 1, 2, '100bit', '100bit', '100bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 300e2,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(1);
            txp.inputs[0].satoshis.should.equal(1e8);
            done();
          });
        });
      });
      it('should account for fee when selecting smallest big utxo', function(done) {
        var _old = Defaults.UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR;
        Defaults.UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR = 2;
        // The 605 bits input cannot be selected even if it is > 2 * tx amount
        // because it cannot cover for fee on its own.
        helpers.stubUtxos(server, wallet, [1, '605bit', '100bit', '100bit', '100bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 300e2,
            }],
            feePerKb: 1200e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(1);
            txp.inputs[0].satoshis.should.equal(1e8);
            Defaults.UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR = _old;
            done();
          });
        });
      });
      it('should select smallest big utxo if small utxos exceed maximum fee', function(done) {
        helpers.stubUtxos(server, wallet, [3, 1, 2].concat(_.times(20, function() {
          return '1000bit';
        })), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 12000e2,
            }],
            feePerKb: 20e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(1);
            txp.inputs[0].satoshis.should.equal(1e8);

            done();
          });
        });
      });
      it('should select smallest big utxo if small utxos are below accepted ratio of txp amount', function(done) {
        helpers.stubUtxos(server, wallet, [9, 1, 1, 0.5, 0.2, 0.2, 0.2], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 3e8,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(1);
            txp.inputs[0].satoshis.should.equal(9e8);
            done();
          });
        });
      });
      it('should not fail with tx exceeded max size if there is at least 1 big input', function(done) {
        var _old1 = Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR;
        var _old2 = Defaults.MAX_TX_SIZE_IN_KB;
        Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR = 0.0001;
        Defaults.MAX_TX_SIZE_IN_KB = 2;

        helpers.stubUtxos(server, wallet, [100].concat(_.range(1, 20, 0)), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 15e8,
            }],
            feePerKb: 120e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(1);
            txp.inputs[0].satoshis.should.equal(100e8);
            Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR = _old1;
            Defaults.MAX_TX_SIZE_IN_KB = _old2;
            done();
          });
        });
      });
      it('should ignore utxos not contributing enough to cover increase in fee', function(done) {
        helpers.stubUtxos(server, wallet, ['100bit', '100bit', '100bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 200e2,
            }],
            feePerKb: 80e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(3);
            txOpts.feePerKb = 160e2;
            server.createTx(txOpts, function(err, txp) {
              should.exist(err);
              should.not.exist(txp);
              done();
            });
          });
        });
      });
      it('should fail to select utxos if not enough to cover tx amount', function(done) {
        helpers.stubUtxos(server, wallet, ['100bit', '100bit', '100bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 400e2,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.exist(err);
            should.not.exist(txp);
            err.code.should.equal('INSUFFICIENT_FUNDS');
            done();
          });
        });
      });
      it('should fail to select utxos if not enough to cover fees', function(done) {
        helpers.stubUtxos(server, wallet, ['100bit', '100bit', '100bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 299e2,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.exist(err);
            should.not.exist(txp);
            err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
            done();
          });
        });
      });
      it('should prefer a higher fee (breaking all limits) if inputs have 6+ confirmations', function(done) {
        helpers.stubUtxos(server, wallet, ['2c 2000bit'].concat(_.times(20, function() {
          return '100bit';
        })), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 1500e2,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            _.every(txp.inputs, function(input) {
              return input == 100e2;
            });
            done();
          });
        });
      });
      it('should select unconfirmed utxos if not enough confirmed utxos', function(done) {
        helpers.stubUtxos(server, wallet, ['u 1btc', '0.5btc'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.8e8,
            }],
            feePerKb: 100e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(1);
            txp.inputs[0].satoshis.should.equal(1e8);
            done();
          });
        });
      });
      it('should ignore utxos too small to pay for fee', function(done) {
        helpers.stubUtxos(server, wallet, ['1c200bit', '200bit'].concat(_.times(20, function() {
          return '1bit';
        })), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 200e2,
            }],
            feePerKb: 90e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(2);
            done();
          });
        });
      });
      it('should use small utxos if fee is low', function(done) {
        helpers.stubUtxos(server, wallet, [].concat(_.times(10, function() {
          return '30bit';
        })), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 200e2,
            }],
            feePerKb: 10e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txp.inputs.length.should.equal(8);
            done();
          });
        });
      });
      it('should correct fee if resulting change would be below threshold', function(done) {
        helpers.stubUtxos(server, wallet, ['200bit', '500sat'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 150e2,
            }],
            feePerKb: 100e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            txp.inputs.length.should.equal(1);
            (_.sumBy(txp.inputs, 'satoshis') - txp.outputs[0].amount - txp.fee).should.equal(0);
            var changeOutput = txp.getBitcoreTx().getChangeOutput();
            should.not.exist(changeOutput);
            done();
          });
        });
      });
      it('should ignore small utxos if fee is higher', function(done) {
        helpers.stubUtxos(server, wallet, [].concat(_.times(10, function() {
          return '30bit';
        })), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 200e2,
            }],
            feePerKb: 80e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.exist(err);
            err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
            done();
          });
        });
      });
      it('should always select inputs as long as there are sufficient funds', function(done) {
        helpers.stubUtxos(server, wallet, [80, '50bit', '50bit', '50bit', '50bit', '50bit'], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 101e2,
            }],
            feePerKb: 100e2,
          };
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            done();
          });
        });
      });
      it('should not use UTXOs of recently broadcasted txs', function(done) {
        helpers.stubUtxos(server, wallet, [1, 1], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 1.5e8,
            }],
            feePerKb: 100e2,
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
            should.exist(txp);
            var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
            server.signTx({
              txProposalId: txp.id,
              signatures: signatures,
            }, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);

              helpers.stubBroadcast();
              server.broadcastTx({
                txProposalId: txp.id
              }, function(err, txp) {
                should.not.exist(err);
                should.exist(txp.txid);
                txp.status.should.equal('broadcasted');
                server.createTx(txOpts, function(err, txp) {
                  should.exist(err);
                  err.code.should.equal('INSUFFICIENT_FUNDS');
                  should.not.exist(txp);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('should create a BCH tx proposal with cashaddr outputs (w/o prefix) and return Copay addr', function(done) {

    let copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
    let cashAddr = BCHAddressTranslator.translate(copayAddr,'cashaddr');
    let amount =  0.8 * 1e8;
    helpers.createAndJoinWallet(1, 1, { 
      coin: 'bch',
    },  function(s, w) {
      helpers.stubUtxos(s, w, [1, 2], function() {
        var txOpts = {
          outputs: [{
            toAddress: cashAddr,
            amount: amount,
          }],
          message: 'some message',
          customData: 'some custom data',
          feePerKb: 123e2,
        };
        s.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.walletM.should.equal(1);
          tx.walletN.should.equal(1);
          tx.requiredRejections.should.equal(1);
          tx.requiredSignatures.should.equal(1);
          tx.isAccepted().should.equal.false;
          tx.isRejected().should.equal.false;
          tx.isPending().should.equal.true;
          tx.isTemporary().should.equal.true;
          tx.outputs.should.deep.equal([{
            toAddress: cashAddr,
            amount: amount,
          }]);
          tx.amount.should.equal(helpers.toSatoshi(0.8));
          tx.feePerKb.should.equal(123e2);
          should.not.exist(tx.feeLevel);
          var publishOpts = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
          s.publishTx(publishOpts, function(err) {
            s.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(1);
              txs[0].outputs.should.deep.equal([{
                toAddress: copayAddr,
                amount: amount,
              }]);

              done();
            });
          });
        });
      });
    });
  });

  it('should create a BCH tx proposal with cashaddr outputs (w/ prefix) and return Copay addr', function(done) {

    let copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
    let cashAddr = BCHAddressTranslator.translate(copayAddr,'cashaddr');
    let amount =  0.8 * 1e8;
    helpers.createAndJoinWallet(1, 1, { 
      coin: 'bch',
    },  function(s, w) {
      helpers.stubUtxos(s, w, [1, 2], function() {
        var txOpts = {
          outputs: [{
            toAddress: 'bitcoincash:'+cashAddr,
            amount: amount,
          }],
          message: 'some message',
          customData: 'some custom data',
          feePerKb: 123e2,
        };
        s.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.walletM.should.equal(1);
          tx.walletN.should.equal(1);
          tx.requiredRejections.should.equal(1);
          tx.requiredSignatures.should.equal(1);
          tx.isAccepted().should.equal.false;
          tx.isRejected().should.equal.false;
          tx.isPending().should.equal.true;
          tx.isTemporary().should.equal.true;
          tx.outputs.should.deep.equal([{
            toAddress: 'bitcoincash:'+cashAddr,
            amount: amount,
          }]);
          tx.amount.should.equal(helpers.toSatoshi(0.8));
          tx.feePerKb.should.equal(123e2);
          should.not.exist(tx.feeLevel);

          var publishOpts = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
          s.publishTx(publishOpts, function(err) {
            s.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(1);
              txs[0].outputs.should.deep.equal([{
                toAddress: copayAddr,
                amount: amount,
              }]);

              done();
            });
          });
        });
      });
    });
  });

  it('should create a BCH tx proposal with cashaddr and keep message', function(done) {

    let copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
    let cashAddr = BCHAddressTranslator.translate(copayAddr,'cashaddr');
    let amount =  0.8 * 1e8;
    helpers.createAndJoinWallet(1, 1, { 
      coin: 'bch',
    },  function(s, w) {
      helpers.stubUtxos(s, w, [1, 2], function() {
        var txOpts = {
          outputs: [{
            toAddress: cashAddr,
            amount: amount,
            message: 'xxx',
          }],
          message: 'some message',
          customData: 'some custom data',
          feePerKb: 123e2,
        };
        s.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.walletM.should.equal(1);
          tx.walletN.should.equal(1);
          tx.requiredRejections.should.equal(1);
          tx.requiredSignatures.should.equal(1);
          tx.isAccepted().should.equal.false;
          tx.isRejected().should.equal.false;
          tx.isPending().should.equal.true;
          tx.isTemporary().should.equal.true;
          tx.outputs.should.deep.equal([{
            toAddress: cashAddr,
            amount: amount,
            message: 'xxx',
          }]);
          tx.amount.should.equal(helpers.toSatoshi(0.8));
          tx.feePerKb.should.equal(123e2);
          should.not.exist(tx.feeLevel);
          var publishOpts = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
          s.publishTx(publishOpts, function(err) {
            s.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(1);
              txs[0].outputs.should.deep.equal([{
                toAddress: copayAddr,
                message: 'xxx',
                amount: amount,
              }]);

              done();
            });
          });
        });
      });
    });
  });


  describe('Transaction notes', function(done) {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should edit a note for an arbitrary txid', function(done) {
      server.editTxNote({
        txid: '123',
        body: 'note body'
      }, function(err, note) {
        should.not.exist(err);
        note.txid.should.equal('123');
        note.walletId.should.equal(wallet.id);
        note.body.should.equal('note body');
        note.editedBy.should.equal(server.copayerId);
        note.editedByName.should.equal('copayer 1');
        note.createdOn.should.equal(note.editedOn);
        server.getTxNote({
          txid: '123',
        }, function(err, note) {
          should.not.exist(err);
          should.exist(note);
          note.body.should.equal('note body');
          note.editedBy.should.equal(server.copayerId);
          done();
        });
      });
    });
    it('should preserve last edit', function(done) {
      var clock = sinon.useFakeTimers({toFake: ['Date']});
      server.editTxNote({
        txid: '123',
        body: 'note body'
      }, function(err) {
        should.not.exist(err);
        server.getTxNote({
          txid: '123',
        }, function(err, note) {
          should.not.exist(err);
          should.exist(note);
          note.editedBy.should.equal(server.copayerId);
          note.createdOn.should.equal(note.editedOn);
          var creator = note.editedBy;
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            clock.tick(60 * 1000);
            server.editTxNote({
              txid: '123',
              body: 'edited text'
            }, function(err) {
              should.not.exist(err);
              server.getTxNote({
                txid: '123',
              }, function(err, note) {
                should.not.exist(err);
                should.exist(note);
                note.editedBy.should.equal(server.copayerId);
                note.createdOn.should.be.below(note.editedOn);
                creator.should.not.equal(note.editedBy);
                clock.restore();
                done();
              });
            });
          });
        });
      });
    });
    it('should edit a note for an outgoing tx and retrieve it', function(done) {
      helpers.stubUtxos(server, wallet, 2, function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 1e8,
          }],
          message: 'some message',
          feePerKb: 100e2,
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
          should.exist(txp);
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txp.id,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            should.exist(txp.txid);
            server.editTxNote({
              txid: txp.txid,
              body: 'note body'
            }, function(err) {
              should.not.exist(err);
              server.getTx({
                txProposalId: txp.id,
              }, function(err, txp) {
                should.not.exist(err);
                should.exist(txp.note);
                txp.note.txid.should.equal(txp.txid);
                txp.note.walletId.should.equal(wallet.id);
                txp.note.body.should.equal('note body');
                txp.note.editedBy.should.equal(server.copayerId);
                done();
              });
            });
          });
        });
      });
    });
    it('should share notes between copayers', function(done) {
      server.editTxNote({
        txid: '123',
        body: 'note body'
      }, function(err) {
        should.not.exist(err);
        server.getTxNote({
          txid: '123',
        }, function(err, note) {
          should.not.exist(err);
          should.exist(note);
          note.editedBy.should.equal(server.copayerId);
          var creator = note.editedBy;
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.getTxNote({
              txid: '123',
            }, function(err, note) {
              should.not.exist(err);
              should.exist(note);
              note.body.should.equal('note body');
              note.editedBy.should.equal(creator);
              done();
            });
          });
        });
      });
    });
    it('should be possible to set an empty note', function(done) {
      server.editTxNote({
        txid: '123',
        body: 'note body'
      }, function(err) {
        should.not.exist(err);
        server.getTxNote({
          txid: '123',
        }, function(err, note) {
          should.not.exist(err);
          should.exist(note);
          server.editTxNote({
            txid: '123',
            body: null,
          }, function(err) {
            should.not.exist(err);
            server.getTxNote({
              txid: '123',
            }, function(err, note) {
              should.not.exist(err);
              should.exist(note);
              note.should.have.property('body');
              should.equal(note.body, null);
              server.getTxNotes({
                minTs: 0
              }, function(err, notes) {
                should.not.exist(err);
                should.exist(notes);
                notes.length.should.equal(1);
                should.equal(notes[0].body, null);
                done();
              });
            });
          });
        });
      });
    });
    it('should include the note in tx history listing', function(done) {
      helpers.createAddresses(server, wallet, 1, 1, function(mainAddresses, changeAddress) {
        blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
        server._normalizeTxHistory = sinon.stub().returnsArg(0);
        var txs = [{
          txid: '123',
          confirmations: 1,
          fees: 100,
          time: 20,
          inputs: [{
            address: 'external',
            amount: 500,
          }],
          outputs: [{
            address: mainAddresses[0].address,
            amount: 200,
          }],
        }];
        helpers.stubHistory(txs);
        helpers.stubFeeLevels({
          24: 10000,
        });
        server.editTxNote({
          txid: '123',
          body: 'just some note'
        }, function(err) {
          should.not.exist(err);
          server.getTxHistory({}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(1);
            var tx = txs[0];
            should.exist(tx.note);
            tx.note.body.should.equal('just some note');
            tx.note.editedBy.should.equal(server.copayerId);
            should.exist(tx.note.editedOn);
            done();
          });
        });
      });
    });
    it('should get all notes edited past a given date', function(done) {
      var clock = sinon.useFakeTimers({toFake: ['Date']});
      async.series([

        function(next) {
          server.getTxNotes({}, function(err, notes) {
            should.not.exist(err);
            notes.should.be.empty;
            next();
          });
        },
        function(next) {
          server.editTxNote({
            txid: '123',
            body: 'note body'
          }, next);
        },
        function(next) {
          server.getTxNotes({
            minTs: 0,
          }, function(err, notes) {
            should.not.exist(err);
            notes.length.should.equal(1);
            notes[0].txid.should.equal('123');
            next();
          });
        },
        function(next) {
          clock.tick(60 * 1000);
          server.editTxNote({
            txid: '456',
            body: 'another note'
          }, next);
        },
        function(next) {
          server.getTxNotes({
            minTs: 0,
          }, function(err, notes) {
            should.not.exist(err);
            notes.length.should.equal(2);
            _.difference(_.map(notes, 'txid'), ['123', '456']).should.be.empty;
            next();
          });
        },
        function(next) {
          server.getTxNotes({
            minTs: 50,
          }, function(err, notes) {
            should.not.exist(err);
            notes.length.should.equal(1);
            notes[0].txid.should.equal('456');
            next();
          });
        },
        function(next) {
          clock.tick(60 * 1000);
          server.editTxNote({
            txid: '123',
            body: 'an edit'
          }, next);
        },
        function(next) {
          server.getTxNotes({
            minTs: 100,
          }, function(err, notes) {
            should.not.exist(err);
            notes.length.should.equal(1);
            notes[0].txid.should.equal('123');
            notes[0].body.should.equal('an edit');
            next();
          });
        },
        function(next) {
          server.getTxNotes({}, function(err, notes) {
            should.not.exist(err);
            notes.length.should.equal(2);
            next();
          });
        },
      ], function(err) {
        should.not.exist(err);
        clock.restore();
        done();
      });
    });
  });

  describe('Single-address wallet', function() {
    var server, wallet, firstAddress;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 2, {
        singleAddress: true,
      }, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, a) {
          should.not.exist(err);
          should.exist(a.address);
          firstAddress = a;
          blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
          done();
        });
      });
    });
    it('should include singleAddress property', function(done) {
      server.getWallet({}, function(err, wallet) {
        should.not.exist(err);
        wallet.singleAddress.should.be.true;
        done();
      });
    });
    it('should always return same address', function(done) {
      firstAddress.path.should.equal('m/0/0');
      server.createAddress({}, function(err, x) {
        should.not.exist(err);
        should.exist(x);
        x.path.should.equal('m/0/0');
        x.address.should.equal(firstAddress.address);
        server.getMainAddresses({}, function(err, addr) {
          should.not.exist(err);
          addr.length.should.equal(1);
          done();
        });
      });
    });
    it('should reuse address as change address on tx proposal creation', function(done) {
      helpers.stubUtxos(server, wallet, 2, function() {
        var toAddress = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';
        var opts = {
          outputs: [{
            amount: 1e8,
            toAddress: toAddress,
          }],
          feePerKb: 100e2,
        };
        server.createTx(opts, function(err, txp) {
          should.not.exist(err);
          should.exist(txp);
          should.exist(txp.changeAddress);
          txp.changeAddress.address.should.equal(firstAddress.address);
          txp.changeAddress.path.should.equal(firstAddress.path);
          done();
        });
      });
    });

    it('should not duplicate address on storage after TX creation', function(done) {
      helpers.stubUtxos(server, wallet, 2, function() {
        var toAddress = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';
        var opts = {
          outputs: [{
            amount: 1e8,
            toAddress: toAddress,
          }],
          feePerKb: 100e2,
        };
        server.createTx(opts, function(err, txp) {
          should.not.exist(err);
          server.storage.fetchAddresses(wallet.id, function(err, addresses) {
            should.not.exist(err);
            addresses.length.should.equal(1);
            done();
          });
        });
      });
    });





    it('should not be able to specify custom changeAddress', function(done) {
      helpers.stubUtxos(server, wallet, 2, function() {
        var toAddress = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';
        var opts = {
          outputs: [{
            amount: 1e8,
            toAddress: toAddress,
          }],
          feePerKb: 100e2,
          changeAddress: firstAddress.address,
        };
        server.createTx(opts, function(err, txp) {
          should.exist(err);
          err.message.should.contain('single-address');
          done();
        });
      });
    });
    it('should correctly handle change in tx history', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      helpers.stubUtxos(server, wallet, 2, function() {
        var txs = [{
          txid: '1',
          confirmations: 1,
          fees: 150,
          time: Math.floor(Date.now() / 1000),
          inputs: [{
            address: firstAddress.address,
            amount: 550,
          }],
          outputs: [{
            address: firstAddress.address,
            amount: 100,
          }, {
            address: 'external',
            amount: 300,
          }],
        }];
        helpers.stubHistory(txs);
        helpers.stubFeeLevels({
          24: 10000,
        });
        server.getTxHistory({}, function(err, txs) {
          should.not.exist(err);
          should.exist(txs);
          txs.length.should.equal(1);
          var tx = txs[0];
          tx.action.should.equal('sent');
          tx.amount.should.equal(300);
          tx.fees.should.equal(150);
          tx.outputs.length.should.equal(1);
          tx.outputs[0].address.should.equal('external');
          tx.outputs[0].amount.should.equal(300);
          done();
        });
      });
    });
  });

  describe('#getSendMaxInfo', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    function sendTx(info, cb) {
      var txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: info.amount,
        }],
        inputs: info.inputs,
        fee: info.fee,
      };
      server.createTx(txOpts, function(err, tx) {
        should.not.exist(err);
        should.exist(tx);
        var t = tx.getBitcoreTx();
        t.toObject().inputs.length.should.equal(info.inputs.length);
        t.getFee().should.equal(info.fee);
        should.not.exist(t.getChangeOutput());
        return cb();
      });
    };

    it('should be able to get send max info on 0 utxo wallet', function(done) {
      server.getSendMaxInfo({
        feePerKb: 10000,
        returnInputs: true,
      }, function(err, info) {
        should.not.exist(err);
        should.exist(info);
        info.size.should.equal(0);
        info.amount.should.equal(0);
        info.fee.should.equal(0);
        info.inputs.should.be.empty;
        info.utxosBelowFee.should.equal(0);
        info.amountBelowFee.should.equal(0);
        info.utxosAboveMaxSize.should.equal(0);
        info.amountAboveMaxSize.should.equal(0);
        done();
      });
    });
    it('should correctly get send max info', function(done) {
      helpers.stubUtxos(server, wallet, [0.1, 0.2, 0.3, 0.4], function() {
        server.getSendMaxInfo({
          feePerKb: 10000,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.inputs.length.should.equal(4);
          info.size.should.equal(1304);
          info.fee.should.equal(info.size * 10000 / 1000.);
          info.amount.should.equal(1e8 - info.fee);
          info.utxosBelowFee.should.equal(0);
          info.amountBelowFee.should.equal(0);
          info.utxosAboveMaxSize.should.equal(0);
          info.amountAboveMaxSize.should.equal(0);
          sendTx(info, done);
        });
      });
    });
    it('should correctly get send max info when resulting amount is below dust', function(done) {
      helpers.stubUtxos(server, wallet, [300e-6, 300e-6], function() {
        server.getSendMaxInfo({
          feePerKb: 500e2,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.size.should.equal(700);
          info.fee.should.equal(350e2);
          info.amount.should.equal(250e2);

          var _min_output_amount = Defaults.MIN_OUTPUT_AMOUNT;
          Defaults.MIN_OUTPUT_AMOUNT = 300e2;
          server.getSendMaxInfo({
            feePerKb: 500e2,
            returnInputs: true,
          }, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.size.should.equal(0);
            info.amount.should.equal(0);
            Defaults.MIN_OUTPUT_AMOUNT = _min_output_amount;
            done();
          });
        });
      });
    });

    describe('Fee level', function() {
      it('should correctly get send max info using feeLevel', function(done) {
        helpers.stubFeeLevels({
          1: 400e2,
          2: 200e2,
          6: 180e2,
          24: 90e2,
        });
        helpers.stubUtxos(server, wallet, [0.1, 0.2, 0.3, 0.4], function() {
          server.getSendMaxInfo({
            feeLevel: 'economy',
            returnInputs: true,
          }, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.feePerKb.should.equal(180e2);
            info.fee.should.equal(info.size * 180e2 / 1000.);
            sendTx(info, done);
          });
        });
      });
      it('should assume "normal" fee level if not specified', function(done) {
        helpers.stubFeeLevels({
          1: 400e2,
          2: 200e2,
          6: 180e2,
          24: 90e2,
        });
        helpers.stubUtxos(server, wallet, [0.1, 0.2, 0.3, 0.4], function() {
          server.getSendMaxInfo({}, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.feePerKb.should.equal(200e2);
            info.fee.should.equal(info.size * 200e2 / 1000.);
            done();
          });
        });
      });
      it('should fail on invalid fee level', function(done) {
        helpers.stubUtxos(server, wallet, [0.1, 0.2, 0.3, 0.4], function() {
          server.getSendMaxInfo({
            feeLevel: 'madeUpLevel',
          }, function(err, info) {
            should.exist(err);
            should.not.exist(info);
            err.toString().should.contain('Invalid fee level');
            done();
          });
        });
      });
    });
    it('should return inputs in random order', function(done) {
      // NOTE: this test has a chance of failing of 1 in 1'073'741'824 :P
      helpers.stubUtxos(server, wallet, _.range(1, 31), function(utxos) {
        server.getSendMaxInfo({
          feePerKb: 100e2,
          returnInputs: true
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          var amounts = _.map(info.inputs, 'satoshis');
          amounts.length.should.equal(30);
          _.every(amounts, function(amount, i) {
            if (i == 0) return true;
            return amount < amounts[i - 1];
          }).should.be.false;
          done();
        });
      });
    });
    it('should exclude unconfirmed inputs', function(done) {
      helpers.stubUtxos(server, wallet, ['u0.1', 0.2, 0.3, 0.4], function() {
        server.getSendMaxInfo({
          feePerKb: 10000,
          excludeUnconfirmedUtxos: true,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.inputs.length.should.equal(3);
          info.size.should.equal(1002);
          info.fee.should.equal(info.size * 10000 / 1000.);
          info.amount.should.equal(0.9e8 - info.fee);
          sendTx(info, done);
        });
      });
    });
    it('should exclude locked inputs', function(done) {
      helpers.stubUtxos(server, wallet, ['u0.1', 0.1, 0.1, 0.1], function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.09e8,
          }],
          feePerKb: 100e2,
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
          should.exist(tx);
          server.getSendMaxInfo({
            feePerKb: 10000,
            excludeUnconfirmedUtxos: true,
            returnInputs: true,
          }, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.inputs.length.should.equal(2);
            info.size.should.equal(700);
            info.fee.should.equal(info.size * 10000 / 1000.);
            info.amount.should.equal(0.2e8 - info.fee);
            sendTx(info, done);
          });
        });
      });
    });
    it('should ignore utxos not contributing to total amount (below their cost in fee)', function(done) {
      helpers.stubUtxos(server, wallet, ['u0.1', 0.2, 0.3, 0.4, '1bit', '100bit', '200bit'], function() {
        server.getSendMaxInfo({
          feePerKb: 0.001e8,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.inputs.length.should.equal(4);
          info.size.should.equal(1304);
          info.fee.should.equal(info.size * 0.001e8 / 1000.);
          info.amount.should.equal(1e8 - info.fee);
          info.utxosBelowFee.should.equal(3);
          info.amountBelowFee.should.equal(301e2);
          server.getSendMaxInfo({
            feePerKb: 0.0001e8,
            returnInputs: true,
          }, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.inputs.length.should.equal(6);
            info.size.should.equal(1907);
            info.fee.should.equal(info.size * 0.0001e8 / 1000.);
            info.amount.should.equal(1.0003e8 - info.fee);
            info.utxosBelowFee.should.equal(1);
            info.amountBelowFee.should.equal(1e2);
            sendTx(info, done);
          });
        });
      });
    });
    it('should work when all inputs are below their cost in fee', function(done) {
      helpers.stubUtxos(server, wallet, ['u 10bit', '10bit', '20bit'], function() {
        server.getSendMaxInfo({
          feePerKb: 500e2,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.inputs.should.be.empty;
          info.size.should.equal(0);
          info.fee.should.equal(0);
          info.amount.should.equal(0);
          info.utxosBelowFee.should.equal(3);
          info.amountBelowFee.should.equal(40e2);
          done();
        });
      });
    });
    it('should not go beyond max tx size', function(done) {
      var _oldDefault = Defaults.MAX_TX_SIZE_IN_KB;
      Defaults.MAX_TX_SIZE_IN_KB = 2;
      helpers.stubUtxos(server, wallet, _.range(1, 10, 0), function() {
        server.getSendMaxInfo({
          feePerKb: 10000,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.size.should.be.below(2000);
          info.inputs.length.should.be.below(9);
          info.utxosAboveMaxSize.should.equal(3);
          info.amountAboveMaxSize.should.equal(3e8);
          Defaults.MAX_TX_SIZE_IN_KB = _oldDefault;
          sendTx(info, done);
        });
      });
    });
  })

  describe('#rejectTx', function() {
    var server, wallet, txid;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 10e8,
            }],
            feePerKb: 100e2,
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
            should.exist(tx);
            txid = tx.id;
            done();
          });
        });
      });
    });

    it('should reject a TX', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        server.rejectTx({
          txProposalId: txid,
          reason: 'some reason',
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            server.getTx({
              txProposalId: txid
            }, function(err, tx) {
              var actors = tx.getActors();
              actors.length.should.equal(1);
              actors[0].should.equal(wallet.copayers[0].id);
              var action = tx.getActionBy(wallet.copayers[0].id);
              action.type.should.equal('reject');
              action.comment.should.equal('some reason');
              done();
            });
          });
        });
      });
    });
    it('should fail to reject non-pending TX', function(done) {
      async.waterfall([

        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            var tx = txs[0];
            tx.id.should.equal(txid);
            next();
          });
        },
        function(next) {
          server.rejectTx({
            txProposalId: txid,
            reason: 'some reason',
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.rejectTx({
              txProposalId: txid,
              reason: 'some other reason',
            }, function(err) {
              should.exist(err);
              err.code.should.equal('TX_NOT_PENDING');
              done();
            });
          });
        },
      ]);
    });
  });

  describe('#signTx', function() {
    describe('1-of-1 (BIP44 & P2PKH)', function() {
      var server, wallet, txid;

      beforeEach(function(done) {
        helpers.createAndJoinWallet(1, 1, function(s, w) {
          server = s;
          wallet = w;
          helpers.stubUtxos(server, wallet, [1, 2], function() {
            var txOpts = {
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 2.5e8,
              }],
              feePerKb: 100e2,
            };
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              should.exist(tx);
              tx.addressType.should.equal('P2PKH');
              txid = tx.id;
              done();
            });
          });
        });
      });

      it('should sign a TX with multiple inputs, different paths, and return raw', function(done) {
        blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
        server.getPendingTxs({}, function(err, txs) {
          var tx = txs[0];
          tx.id.should.equal(txid);
          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          should.not.exist(tx.raw);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('accepted');
            // The raw Tx should contain the Signatures.
            txp.raw.should.contain(signatures[0]);

            // Get pending should also contains the raw TX
            server.getPendingTxs({}, function(err, txs) {
              var tx = txs[0];
              should.not.exist(err);
              tx.status.should.equal('accepted');
              tx.raw.should.contain(signatures[0]);
              done();
            });
          });
        });
      });
    });

    describe('Multisig', function() {
      var server, wallet, txid;

      beforeEach(function(done) {
        helpers.createAndJoinWallet(2, 3, function(s, w) {
          server = s;
          wallet = w;
          helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
            var txOpts = {
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 20e8,
              }],
              feePerKb: 100e2,
            };
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              should.exist(tx);
              txid = tx.id;
              done();
            });
          });
        });
      });

      it('should sign a TX with multiple inputs, different paths', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          var tx = txs[0];
          tx.id.should.equal(txid);

          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err);
            should.not.exist(tx.raw);
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              var tx = txs[0];
              tx.id.should.equal(txid);

              var actors = tx.getActors();
              actors.length.should.equal(1);
              actors[0].should.equal(wallet.copayers[0].id);
              tx.getActionBy(wallet.copayers[0].id).type.should.equal('accept');

              done();
            });
          });
        });
      });

      it('should fail to sign with a xpriv from other copayer', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          var tx = txs[0];
          tx.id.should.equal(txid);
          var signatures = helpers.clientSign(tx, TestData.copayers[1].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            err.code.should.equal('BAD_SIGNATURES');
            done();
          });
        });
      });

      it('should fail if one signature is broken', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          var tx = txs[0];
          tx.id.should.equal(txid);

          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          signatures[0] = 1;

          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            err.message.should.contain('signatures');
            done();
          });
        });
      });

      it('should fail on invalid signature', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          var tx = txs[0];
          tx.id.should.equal(txid);

          var signatures = ['11', '22', '33', '44', '55'];
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            should.exist(err);
            err.message.should.contain('Bad signatures');
            done();
          });
        });
      });

      it('should fail on wrong number of invalid signatures', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          var tx = txs[0];
          tx.id.should.equal(txid);

          var signatures = _.take(helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H), tx.inputs.length - 1);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            should.exist(err);
            err.message.should.contain('Bad signatures');
            done();
          });
        });
      });

      it('should fail when signing a TX previously rejected', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          var tx = txs[0];
          tx.id.should.equal(txid);

          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            server.rejectTx({
              txProposalId: txid,
            }, function(err) {
              err.code.should.contain('COPAYER_VOTED');
              done();
            });
          });
        });
      });

      it('should fail when rejected a previously signed TX', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          var tx = txs[0];
          tx.id.should.equal(txid);

          server.rejectTx({
            txProposalId: txid,
          }, function(err) {
            var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
            server.signTx({
              txProposalId: txid,
              signatures: signatures,
            }, function(err) {
              err.code.should.contain('COPAYER_VOTED');
              done();
            });
          });
        });
      });

      it('should fail to sign a non-pending TX', function(done) {
        async.waterfall([

          function(next) {
            server.rejectTx({
              txProposalId: txid,
              reason: 'some reason',
            }, function(err) {
              should.not.exist(err);
              next();
            });
          },
          function(next) {
            helpers.getAuthServer(wallet.copayers[1].id, function(server) {
              server.rejectTx({
                txProposalId: txid,
                reason: 'some reason',
              }, function(err) {
                should.not.exist(err);
                next();
              });
            });
          },
          function(next) {
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.should.be.empty;
              next();
            });
          },
          function(next) {
            helpers.getAuthServer(wallet.copayers[2].id, function(server) {
              server.getTx({
                txProposalId: txid
              }, function(err, tx) {
                should.not.exist(err);
                var signatures = helpers.clientSign(tx, TestData.copayers[2].xPrivKey_44H_0H_0H);
                server.signTx({
                  txProposalId: txid,
                  signatures: signatures,
                }, function(err) {
                  should.exist(err);
                  err.code.should.equal('TX_NOT_PENDING');
                  done();
                });
              });
            });
          },
        ]);
      });
    });
  });

  describe('#broadcastTx & #broadcastRawTx', function() {
    var server, wallet, txpid, txid;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, [10, 10], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 9e8,
            }],
            message: 'some message',
            feePerKb: 100e2,
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
            should.exist(txp);
            var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
            server.signTx({
              txProposalId: txp.id,
              signatures: signatures,
            }, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.isAccepted().should.be.true;
              txp.isBroadcasted().should.be.false;
              txid = txp.txid;
              txpid = txp.id;
              done();
            });
          });
        });
      });
    });

    it('should broadcast a tx', function(done) {
      var clock = sinon.useFakeTimers({now: 1234000, toFake: ['Date']});
      helpers.stubBroadcast();
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.not.exist(txp.raw);
          txp.txid.should.equal(txid);
          txp.isBroadcasted().should.be.true;
          txp.broadcastedOn.should.equal(1234);
          clock.restore();
          done();
        });
      });
    });
    it('should broadcast a raw tx', function(done) {
      helpers.stubBroadcast();
      server.broadcastRawTx({
        network: 'testnet',
        rawTx: 'raw tx',
      }, function(err, txid) {
        should.not.exist(err);
        should.exist(txid);
        done();
      });
    });
    it('should fail to brodcast a tx already marked as broadcasted', function(done) {
      helpers.stubBroadcast();
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.broadcastTx({
          txProposalId: txpid
        }, function(err) {
          should.exist(err);
          err.code.should.equal('TX_ALREADY_BROADCASTED');
          done();
        });
      });
    });
    it('should auto process already broadcasted txs', function(done) {
      helpers.stubBroadcast();
      server.getPendingTxs({}, function(err, txs) {
        should.not.exist(err);
        txs.length.should.equal(1);
        blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, {
          txid: 999
        });
        server.getPendingTxs({}, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(0);
          done();
        });
      });
    });
    it('should process only broadcasted txs', function(done) {
      helpers.stubBroadcast();
      var txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 9e8,
        }],
        feePerKb: 100e2,
      };
      helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
        server.getPendingTxs({}, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(2);
          blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, {
            txid: 999
          });
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.length.should.equal(1);
            txs[0].status.should.equal('pending');
            should.not.exist(txs[0].txid);
            done();
          });
        });
      });
    });
    it('should fail to brodcast a not yet accepted tx', function(done) {
      helpers.stubBroadcast();
      var txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 9e8,
        }],
        feePerKb: 100e2,
      };
      helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
        should.exist(txp);
        server.broadcastTx({
          txProposalId: txp.id
        }, function(err) {
          should.exist(err);
          err.code.should.equal('TX_NOT_ACCEPTED');
          done();
        });
      });
    });
    it('should keep tx as accepted if unable to broadcast it', function(done) {
      blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
      blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.exist(err);
        err.toString().should.equal('broadcast error');
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.exist(txp.txid);
          txp.isBroadcasted().should.be.false;
          should.not.exist(txp.broadcastedOn);
          txp.isAccepted().should.be.true;
          done();
        });
      });
    });
    it('should mark tx as broadcasted if accepted but already in blockchain', function(done) {
      blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
      blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, {
        txid: '999'
      });
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.exist(txp.txid);
          txp.isBroadcasted().should.be.true;
          should.exist(txp.broadcastedOn);
          done();
        });
      });
    });
    it('should keep tx as accepted if broadcast fails and cannot check tx in blockchain', function(done) {
      blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
      blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, 'bc check error');
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.exist(err);
        err.toString().should.equal('bc check error');
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.exist(txp.txid);
          txp.isBroadcasted().should.be.false;
          should.not.exist(txp.broadcastedOn);
          txp.isAccepted().should.be.true;
          done();
        });
      });
    });
  });

  describe('Tx proposal workflow', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
          helpers.stubBroadcast();
          done();
        });
      });
    });

    it('other copayers should see pending proposal created by one copayer', function(done) {
      var txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10e8
        }],
        feePerKb: 100e2,
        message: 'some message',
      };
      helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
        should.exist(txp);
        helpers.getAuthServer(wallet.copayers[1].id, function(server2, wallet) {
          server2.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            txps[0].id.should.equal(txp.id);
            txps[0].message.should.equal('some message');
            done();
          });
        });
      });
    });
    it('tx proposals should not be finally accepted until quorum is reached', function(done) {
      var txpId;
      async.waterfall([

        function(next) {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 10e8
            }],
            feePerKb: 100e2,
            message: 'some message',
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
            txpId = txp.id;
            should.exist(txp);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.actions.should.be.empty;
            next(null, txp);
          });
        },
        function(txp, next) {
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txpId,
            signatures: signatures,
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isAccepted().should.be.false;
            txp.isRejected().should.be.false;
            txp.isBroadcasted().should.be.false;
            txp.actions.length.should.equal(1);
            var action = txp.getActionBy(wallet.copayers[0].id);
            action.type.should.equal('accept');
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var last = _.last(notifications);
              last.type.should.not.equal('TxProposalFinallyAccepted');
              next(null, txp);
            });
          });
        },
        function(txp, next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server, wallet) {
            var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
            server.signTx({
              txProposalId: txpId,
              signatures: signatures,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isAccepted().should.be.true;
            txp.isBroadcasted().should.be.false;
            should.exist(txp.txid);
            txp.actions.length.should.equal(2);
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var last = _.last(notifications);
              last.type.should.equal('TxProposalFinallyAccepted');
              last.walletId.should.equal(wallet.id);
              last.creatorId.should.equal(wallet.copayers[1].id);
              last.data.txProposalId.should.equal(txp.id);
              done();
            });
          });
        },
      ]);
    });
    it('tx proposals should accept as many rejections as possible without finally rejecting', function(done) {
      var txpId;
      async.waterfall([

        function(next) {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 10e8
            }],
            feePerKb: 100e2,
            message: 'some message',
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
            txpId = txp.id;
            should.exist(txp);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.actions.should.be.empty;
            next();
          });
        },
        function(next) {
          server.rejectTx({
            txProposalId: txpId,
            reason: 'just because'
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isRejected().should.be.false;
            txp.isAccepted().should.be.false;
            txp.actions.length.should.equal(1);
            var action = txp.getActionBy(wallet.copayers[0].id);
            action.type.should.equal('reject');
            action.comment.should.equal('just because');
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server, wallet) {
            server.rejectTx({
              txProposalId: txpId,
              reason: 'some other reason'
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(0);
            next();
          });
        },
        function(next) {
          server.getTx({
            txProposalId: txpId
          }, function(err, txp) {
            should.not.exist(err);
            txp.isPending().should.be.false;
            txp.isRejected().should.be.true;
            txp.isAccepted().should.be.false;
            txp.actions.length.should.equal(2);
            done();
          });
        },
      ]);
    });
  });

  describe('#getTx', function() {
    var server, wallet, txpid;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, 1, function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.5e8
            }],
            feePerKb: 100e2,
            message: 'some message',
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
            should.exist(txp);
            txpid = txp.id;
            done();
          });
        });
      });
    });

    it('should get own transaction proposal', function(done) {
      server.getTx({
        txProposalId: txpid
      }, function(err, txp) {
        should.not.exist(err);
        should.exist(txp);
        txp.id.should.equal(txpid);
        done();
      });
    });
    it('should get someone elses transaction proposal', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2, wallet) {
        server2.getTx({
          txProposalId: txpid
        }, function(err, res) {
          should.not.exist(err);
          res.id.should.equal(txpid);
          done();
        });
      });

    });
    it('should fail to get non-existent transaction proposal', function(done) {
      server.getTx({
        txProposalId: 'dummy'
      }, function(err, txp) {
        should.exist(err);
        should.not.exist(txp);
        err.code.should.equal('TX_NOT_FOUND')
        err.message.should.equal('Transaction proposal not found');
        done();
      });
    });
    it.skip('should get accepted/rejected transaction proposal', function(done) {});
    it.skip('should get broadcasted transaction proposal', function(done) {});
  });

  describe('#getTxs', function() {
    var server, wallet, clock;

    beforeEach(function(done) {
      this.timeout(5000);
      clock = sinon.useFakeTimers({toFake: ['Date']});
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 11), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.1e8
            }],
            feePerKb: 100e2,
            message: 'some message',
          };
          async.eachSeries(_.range(10), function(i, next) {
            clock.tick(10 * 1000);
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {

              next();
            });
          }, function(err) {
            clock.restore();
            return done(err);
          });
        });
      });
    });
    afterEach(function() {
 //     clock.restore();
    });
    it('should pull 4 txs, down to to time 60', function(done) {
      server.getTxs({
        minTs: 60,
        limit: 8
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.map(txps, 'createdOn');
        times.should.deep.equal([100, 90, 80, 70, 60]);
        done();
      });
    });
    it('should pull the first 5 txs', function(done) {
      server.getTxs({
        maxTs: 50,
        limit: 5
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.map(txps, 'createdOn');
        times.should.deep.equal([50, 40, 30, 20, 10]);
        done();
      });
    });
    it('should pull the last 4 txs', function(done) {
      server.getTxs({
        limit: 4
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.map(txps, 'createdOn');
        times.should.deep.equal([100, 90, 80, 70]);
        done();
      });
    });
    it('should pull all txs', function(done) {
      server.getTxs({}, function(err, txps) {
        should.not.exist(err);
        var times = _.map(txps, 'createdOn');
        times.should.deep.equal([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
        done();
      });
    });
    it('should txs from times 50 to 70',
      function(done) {
        server.getTxs({
          minTs: 50,
          maxTs: 70,
        }, function(err, txps) {
          should.not.exist(err);
          var times = _.map(txps, 'createdOn');
          times.should.deep.equal([70, 60, 50]);
          done();
        });
      });
  });

  describe('#getNotifications', function() {
    var clock;
    var server, wallet;

    beforeEach(function(done) {
      clock = sinon.useFakeTimers({now: 10*1000, toFake: ['Date']});
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(4), function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.1e8
            }],
            feePerKb: 100e2,
            message: 'some message',
          };
          async.eachSeries(_.range(3), function(i, next) {
            clock.tick(25 * 1000);
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
              next();
            });
          }, function(err) {
            clock.tick(20 * 1000);
            return done(err);
          });
        });
      });
    });
    afterEach(function() {
      clock.restore();
    });
    it('should pull all notifications', function(done) {
      server.getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        var types = _.map(notifications, 'type');
        types.should.deep.equal(['NewCopayer', 'NewAddress', 'NewAddress', 'NewTxProposal', 'NewTxProposal', 'NewTxProposal']);
        var walletIds = _.uniq(_.map(notifications, 'walletId'));
        walletIds.length.should.equal(1);
        walletIds[0].should.equal(wallet.id);
        var creators = _.uniq(_.compact(_.map(notifications, 'creatorId')));
        creators.length.should.equal(1);
        creators[0].should.equal(wallet.copayers[0].id);
        done();
      });
    });
    it('should pull new payment notifications with correct format', function(done) {

      var s2, w2, addr;

      helpers.createAndJoinWallet(1, 1, {coin:'bch'}, function(s, w) {
        s2 = s;
        w2 = w;
        helpers.createAddresses(s2, w2, 1, 1, function(main, change) {
          addr = main[0].address;
          // Simulate new block notification
          s2.walletId = w2.id;
          s2._notify('NewIncomingTx', {
              txid: 'txid',
              address: addr,
              amount: 5435,  // 5434 sats
            hash: 'dummy hash',
          }, {
            isGlobal: true
          }, function(err) {
            should.not.exist(err);
            s2.getNotifications({
              minTs: +Date.now() - (60 * 1000),
            }, function(err, notifications) {
              should.not.exist(err);
              var types = _.map(notifications, 'type');
              types.should.deep.equal(['NewCopayer', 'NewIncomingTx']);
              var walletIds = _.uniq(_.map(notifications, 'walletId'));
              walletIds.length.should.equal(1);
              walletIds[0].should.equal(w2.id);
              done();
            });
          });
        });
      });
    });




    it('should pull new block notifications along with wallet notifications in the last 60 seconds', function(done) {
      // Simulate new block notification
      server.walletId = 'livenet';
      server._notify('NewBlock', {
        hash: 'dummy hash',
      }, {
        isGlobal: true
      }, function(err) {
        should.not.exist(err);
        server.walletId = 'testnet';
        server._notify('NewBlock', {
          hash: 'dummy hash',
        }, {
          isGlobal: true
        }, function(err) {
          should.not.exist(err);
          server.walletId = wallet.id;
          server.getNotifications({
            minTs: +Date.now() - (60 * 1000),
          }, function(err, notifications) {
            should.not.exist(err);
            var types = _.map(notifications, 'type');
            types.should.deep.equal(['NewTxProposal', 'NewTxProposal', 'NewBlock']);
            var walletIds = _.uniq(_.map(notifications, 'walletId'));
            walletIds.length.should.equal(1);
            walletIds[0].should.equal(wallet.id);
            done();
          });
        });
      });
    });
    it('should pull notifications in the last 60 seconds', function(done) {
      server.getNotifications({
        minTs: +Date.now() - (60 * 1000),
      }, function(err, notifications) {
        should.not.exist(err);
        var types = _.map(notifications, 'type');
        types.should.deep.equal(['NewTxProposal', 'NewTxProposal']);
        done();
      });
    });
    it('should pull notifications after a given notification id', function(done) {
      server.getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        var from = _.head(_.takeRight(notifications, 2)).id; // second to last
        server.getNotifications({
          notificationId: from,
          minTs: +Date.now() - (60 * 1000),
        }, function(err, res) {
          should.not.exist(err);
          res.length.should.equal(1);
          res[0].id.should.equal(_.head(_.takeRight(notifications)).id);
          done();
        });
      });
    });
    it('should return empty if no notifications found after a given id', function(done) {
      server.getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        var from = _.head(_.takeRight(notifications)).id; // last one
        server.getNotifications({
          notificationId: from,
        }, function(err, res) {
          should.not.exist(err);
          res.length.should.equal(0);
          done();
        });
      });
    });
    it('should return empty if no notifications exist in the given timespan', function(done) {
      clock.tick(100 * 1000);
      server.getNotifications({
        minTs: +Date.now() - (60 * 1000),
      }, function(err, res) {
        should.not.exist(err);
        res.length.should.equal(0);
        done();
      });
    });
    it('should contain walletId & creatorId on NewCopayer', function(done) {
      server.getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        var newCopayer = notifications[0];
        newCopayer.type.should.equal('NewCopayer');
        newCopayer.walletId.should.equal(wallet.id);
        newCopayer.creatorId.should.equal(wallet.copayers[0].id);
        done();
      });
    });
    it('should notify sign and acceptance', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
        var tx = txs[0];
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          server.getNotifications({
            minTs: Date.now(),
          }, function(err, notifications) {
            should.not.exist(err);
            notifications.length.should.equal(2);
            var types = _.map(notifications, 'type');
            types.should.deep.equal(['TxProposalAcceptedBy', 'TxProposalFinallyAccepted']);
            done();
          });
        });
      });
    });
    it('should notify rejection', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[1];
        server.rejectTx({
          txProposalId: tx.id,
        }, function(err) {
          should.not.exist(err);
          server.getNotifications({
            minTs: Date.now(),
          }, function(err, notifications) {
            should.not.exist(err);
            notifications.length.should.equal(2);
            var types = _.map(notifications, 'type');
            types.should.deep.equal(['TxProposalRejectedBy', 'TxProposalFinallyRejected']);
            done();
          });
        });
      });
    });
    it('should notify sign, acceptance, and broadcast, and emit', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[2];
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          helpers.stubBroadcast();
          server.broadcastTx({
            txProposalId: tx.id
          }, function(err, txp) {
            should.not.exist(err);
            server.getNotifications({
              minTs: Date.now(),
            }, function(err, notifications) {
              should.not.exist(err);
              notifications.length.should.equal(3);
              var types = _.map(notifications, 'type');
              types.should.deep.equal(['TxProposalAcceptedBy', 'TxProposalFinallyAccepted', 'NewOutgoingTx']);
              done();
            });
          });
        });
      });
    });
    it('should notify sign, acceptance, and broadcast, and emit (with 3rd party broadcast', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[2];
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'err');
          blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, {
            txid: 11
          });
          server.broadcastTx({
            txProposalId: tx.id
          }, function(err, txp) {
            should.not.exist(err);
            server.getNotifications({
              minTs: Date.now(),
            }, function(err, notifications) {
              should.not.exist(err);
              notifications.length.should.equal(3);
              var types = _.map(notifications, 'type');
              types.should.deep.equal(['TxProposalAcceptedBy', 'TxProposalFinallyAccepted', 'NewOutgoingTxByThirdParty']);
              done();
            });
          });
        });
      });
    });
  });

  describe('#removePendingTx', function() {
    var server, wallet, txp;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, [1, 2], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.8e8
            }],
            feePerKb: 100e2,
            message: 'some message',
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function() {
            server.getPendingTxs({}, function(err, txs) {
              txp = txs[0];
              done();
            });
          });
        });
      });
    });
    it('should allow creator to remove an unsigned TX', function(done) {
      server.removePendingTx({
        txProposalId: txp.id
      }, function(err) {
        should.not.exist(err);
        server.getPendingTxs({}, function(err, txs) {
          txs.length.should.equal(0);
          done();
        });
      });
    });
    it('should allow creator to remove a signed TX by himself', function(done) {
      var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
      server.signTx({
        txProposalId: txp.id,
        signatures: signatures,
      }, function(err) {
        should.not.exist(err);
        server.removePendingTx({
          txProposalId: txp.id
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            txs.length.should.equal(0);
            done();
          });
        });
      });
    });
    it('should fail to remove non-pending TX', function(done) {
      async.waterfall([

        function(next) {
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txp.id,
            signatures: signatures,
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.rejectTx({
              txProposalId: txp.id,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[2].id, function(server) {
            server.rejectTx({
              txProposalId: txp.id,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            next();
          });
        },
        function(next) {
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            should.exist(err);
            err.code.should.equal('TX_NOT_PENDING');
            done();
          });
        },
      ]);
    });
    it('should not allow non-creator copayer to remove an unsigned TX ', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        server2.removePendingTx({
          txProposalId: txp.id
        }, function(err) {
          should.exist(err);
          err.code.should.contain('TX_CANNOT_REMOVE');
          server2.getPendingTxs({}, function(err, txs) {
            txs.length.should.equal(1);
            done();
          });
        });
      });
    });
    it('should not allow creator copayer to remove a TX signed by other copayer, in less than 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            err.code.should.equal('TX_CANNOT_REMOVE');
            err.message.should.contain('Cannot remove');
            done();
          });
        });
      });
    });
    it('should allow creator copayer to remove a TX rejected by other copayer, in less than 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
        server2.rejectTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });
    it('should allow creator copayer to remove a TX signed by other copayer, after 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);

          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs[0].deleteLockTime.should.be.above(Defaults.DELETE_LOCKTIME - 10);

            var clock = sinon.useFakeTimers({now: Date.now() + 1 + 24 * 3600 * 1000, toFake: ['Date']});
            server.removePendingTx({
              txProposalId: txp.id
            }, function(err) {
              should.not.exist(err);
              clock.restore();
              done();
            });
          });
        });
      });
    });
    it('should allow other copayer to remove a TX signed, after 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);

          var clock = sinon.useFakeTimers({now: Date.now() + 2000 + Defaults.DELETE_LOCKTIME * 1000, toFake: ['Date']});
          server2.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            should.not.exist(err);
            clock.restore();
            done();
          });
        });
      });
    });
  });

  describe('#getTxHistory', function() {
    var server, wallet, mainAddresses, changeAddresses;
    beforeEach(function(done) {
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.createAddresses(server, wallet, 1, 1, function(main, change) {
          mainAddresses = main;
          changeAddresses = change;
          helpers.stubFeeLevels({
            24: 10000,
          });
          done();
        });
      });
    });

    it('should get tx history from insight', function(done) {
      helpers.stubHistory(TestData.history);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(TestData.history.length);
        var i = 0;
        _.each(txs, function(tx) {
          var h = TestData.history[i++];
          tx.time.should.equal(h.confirmations ? h.blocktime : h.firstSeenTs);
        });
        done();
      });
    });
    it('should get tx history for incoming txs', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('received');
        tx.amount.should.equal(200);
        tx.fees.should.equal(100);
        tx.time.should.equal(20);
        done();
      });
    });
    it('should get tx history for outgoing txs', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        time: 12345,
        inputs: [{
          address: mainAddresses[0].address,
          amount: 500,
        }],
        outputs: [{
          address: 'external',
          amount: 400,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('sent');
        tx.amount.should.equal(500);  // it is 500 because there is no change Address
        tx.fees.should.equal(100);
        tx.time.should.equal(12345);
        done();
      });
    });
    it('should get tx history for outgoing txs + change', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        time: Date.now() / 1000,
        inputs: [{
          address: mainAddresses[0].address,
          amount: 500,
        }],
        outputs: [{
          address: 'external',
          amount: 300,
        }, {
          address: changeAddresses[0].address,
          amount: 100,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('sent');
        tx.amount.should.equal(300);
        tx.fees.should.equal(100);
        tx.outputs[0].address.should.equal('external');
        tx.outputs[0].amount.should.equal(300);
        done();
      });
    });
    it('should get tx history with accepted proposal', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var external = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';

      helpers.stubUtxos(server, wallet, [1, 2], function(utxos) {
        var txOpts = {
          outputs: [{
            toAddress: external,
            amount: 0.5e8,
            message: undefined // no message
          }, {
            toAddress: external,
            amount: 0.3e8,
            message: 'message #2'
          }],
          feePerKb: 100e2,
          message: 'some message',
          customData: {
            "test": true
          },
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
          should.exist(tx);

          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: tx.id,
            signatures: signatures,
          }, function(err, tx) {
            should.not.exist(err);

            helpers.stubBroadcast();
            server.broadcastTx({
              txProposalId: tx.id
            }, function(err, txp) {
              should.not.exist(err);
              var txs = [{
                txid: txp.txid,
                confirmations: 1,
                fees: 5460,
                time: Date.now() / 1000,
                inputs: [{
                  address: tx.inputs[0].address,
                  amount: utxos[0].satoshis,
                }],
                outputs: [{
                  address: changeAddresses[0].address,
                  amount: 0.2e8 - 5460,
                }, {
                  address: external,
                  amount: 0.5e8,
                }, {
                  address: external,
                  amount: 0.3e8,
                }]
              }];
              helpers.stubHistory(txs);

              server.getTxHistory({}, function(err, txs) {
                should.not.exist(err);
                should.exist(txs);
                txs.length.should.equal(1);
                var tx = txs[0];
                tx.createdOn.should.equal(txp.createdOn);
                tx.action.should.equal('sent');
                tx.amount.should.equal(0.8e8);


                tx.message.should.equal('some message');
                tx.addressTo.should.equal(external);
                tx.actions.length.should.equal(1);
                tx.actions[0].type.should.equal('accept');
                tx.actions[0].copayerName.should.equal('copayer 1');
                tx.outputs[0].address.should.equal(external);
                tx.outputs[0].amount.should.equal(0.5e8);
                should.not.exist(tx.outputs[0].message);
                should.not.exist(tx.outputs[0]['isMine']);
                should.not.exist(tx.outputs[0]['isChange']);
                tx.outputs[1].address.should.equal(external);
                tx.outputs[1].amount.should.equal(0.3e8);
                should.exist(tx.outputs[1].message);
                tx.outputs[1].message.should.equal('message #2');
                should.exist(tx.customData);
                should.exist(tx.customData["test"]);
                done();
              });
            });
          });
        });
      });
    });
    it('should get various paginated tx history', function(done) {
      var testCases = [{
        opts: {},
        expected: [50, 40, 30, 20, 10],
      }, {
        opts: {
          skip: 1,
          limit: 3,
        },
        expected: [40, 30, 20],
      }, {
        opts: {
          skip: 1,
          limit: 2,
        },
        expected: [40, 30],
      }, {
        opts: {
          skip: 2,
        },
        expected: [30, 20, 10],
      }, {
        opts: {
          limit: 4,
        },
        expected: [50, 40, 30, 20],
      }, {
        opts: {
          skip: 0,
          limit: 3,
        },
        expected: [50, 40, 30],
      }, {
        opts: {
          skip: 0,
          limit: 0,
        },
        expected: [],
      }, {
        opts: {
          skip: 4,
          limit: 10,
        },
        expected: [10],
      }, {
        opts: {
          skip: 20,
          limit: 1,
        },
        expected: [],
      }];

      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var timestamps = [50, 40, 30, 20, 10];
      var txs = _.map(timestamps, function(ts, idx) {
        return {
          txid: (idx + 1).toString(),
          confirmations: ts / 10,
          fees: 100,
          time: ts,
          inputs: [{
            address: 'external',
            amount: 500,
          }],
          outputs: [{
            address: mainAddresses[0].address,
            amount: 200,
          }],
        };
      });
      helpers.stubHistory(txs);

      async.each(testCases, function(testCase, next) {
        server.getTxHistory(testCase.opts, function(err, txs) {
          should.not.exist(err);
          should.exist(txs);
          _.map(txs, 'time').should.deep.equal(testCase.expected);
          next();
        });
      }, done);
    });
    it('should fail gracefully if unable to reach the blockchain', function(done) {
      blockchainExplorer.getTransactions = sinon.stub().callsArgWith(3, 'dummy error');
      server.getTxHistory({}, function(err, txs) {
        should.exist(err);
        err.toString().should.equal('dummy error');
        done();
      });
    });
    it('should handle invalid tx in  history ', function(done) {
      var h = _.clone(TestData.history);
      h.push({
        txid: 'xx'
      })
      helpers.stubHistory(h);
      var l = TestData.history.length;

      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(l + 1);
        txs[l].action.should.equal('invalid');
        done();
      });
    });
    it('should handle exceeded limit', function(done) {
      server.getTxHistory({
        limit: 2000
      }, function(err, txs) {
        err.code.should.equal('HISTORY_LIMIT_EXCEEDED');
        done();
      });
    });
    it('should set lowFees atribute for sub-superEconomy level fees on unconfirmed txs', function(done) {
      helpers.stubFeeLevels({
        24: 10000,
      });
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 0,
        fees: 100,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
        size: 500,
      }, {
        txid: '2',
        confirmations: 0,
        fees: 6000,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
        size: 500,
      }, {
        txid: '3',
        confirmations: 6,
        fees: 100,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
        size: 500,
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        var tx = txs[0];
        tx.feePerKb.should.equal(200);
        tx.lowFees.should.be.true;
        tx = txs[1];
        tx.feePerKb.should.equal(12000);
        tx.lowFees.should.be.false;
        tx = txs[2];
        tx.feePerKb.should.equal(200);
        should.not.exist(tx.lowFees);
        done();
      });
    });
    it('should get tx history even if fee levels are unavailable', function(done) {
      blockchainExplorer.estimateFee = sinon.stub().yields('dummy error');
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
        size: 500,
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        var tx = txs[0];
        tx.feePerKb.should.equal(200);
        should.not.exist(tx.foreignCrafted);
        should.not.exist(tx.lowFees);
        done();
      });
    });

    it('should handle outgoing txs where fee > amount', function(done) {
      var x = _.cloneDeep([HugeTxs[0]]);
      x[0].vin[118].addr = mainAddresses[0].address;
      helpers.stubHistory(x);


//console.log('[server.js.7149]',HugeTxs[1].vin); //TODO



      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('sent');
        tx.amount.should.equal(3002982);
        tx.fees.should.equal(10000000);
        tx.outputs[0].address.should.equal('1DVhaBdbp5mx5Y8zR1qR9NBiQtrgL9ZNQs');
        tx.outputs[0].amount.should.equal(500000000);
        tx.foreignCrafted.should.equal(true);
        done();
      });
    });


    it('should handle incoming txs with fee > incoming', function(done) {
      var x = _.cloneDeep([HugeTxs[1]]);

      x[0].vout[43].scriptPubKey.addresses = [mainAddresses[0].address];
      helpers.stubHistory(x);

      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('received');
        tx.amount.should.equal(3002982);
        tx.fees.should.equal(130700);
        done();
      });
    });
  });

  describe('#getTxHistory cache', function() {
    var server, wallet, mainAddresses, changeAddresses;
    var _threshold = Defaults.HISTORY_CACHE_ADDRESS_THRESOLD;
    beforeEach(function(done) {
      Defaults.HISTORY_CACHE_ADDRESS_THRESOLD = 1;
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.createAddresses(server, wallet, 1, 1, function(main, change) {
          mainAddresses = main;
          changeAddresses = change;
          helpers.stubFeeLevels({
            24: 10000,
          });
          done();
        });
      });
    });
    afterEach(function() {
      Defaults.HISTORY_CACHE_ADDRESS_THRESOLD = _threshold;
    });

    it('should store partial cache tx history from insight', function(done) {
      var skip = 31;
      var limit = 10;
      var totalItems = 200;

      var h = helpers.historyCacheTest(totalItems);
      helpers.stubHistory(h);
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 200);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');


      server.getTxHistory({
        skip: skip,
        limit: limit,
      }, function(err, txs) {

        // FROM the END, we are getting items
        // End-1, end-2, end-3.

        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(limit);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        calls[0].args[1].should.equal(totalItems); // total
        calls[0].args[2].should.equal(totalItems - skip - limit); // position
        calls[0].args[3].length.should.equal(5); // 5 txs have confirmations>= 36

        // should be reversed!
        calls[0].args[3][0].confirmations.should.equal(skip + limit - 1);
        calls[0].args[3][0].txid.should.equal(h[skip + limit - 1].txid);
        server.storage.storeTxHistoryCache.restore();
        done();
      });
    });


    it('should not cache tx history when requesting txs with low # of confirmations', function(done) {
      var h = helpers.historyCacheTest(200);
      helpers.stubHistory(h);
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');
      server.getTxHistory({
        skip: 0,
        limit: 10,
      }, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(0);
        server.storage.storeTxHistoryCache.restore();
        done();
      });
    });


    it('should store cache all tx history from insight', function(done) {
      var skip = 195;
      var limit = 5;
      var totalItems = 200;

      var h = helpers.historyCacheTest(totalItems);
      helpers.stubHistory(h);
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 200);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');

      server.getTxHistory({
        skip: skip,
        limit: limit,
      }, function(err, txs) {

        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(limit);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        calls[0].args[1].should.equal(totalItems); // total
        calls[0].args[2].should.equal(totalItems - skip - limit); // position
        calls[0].args[3].length.should.equal(5);

        // should be reversed!
        calls[0].args[3][0].confirmations.should.equal(totalItems - 1);
        calls[0].args[3][0].txid.should.equal(h[totalItems - 1].txid);
        server.storage.storeTxHistoryCache.restore();
        done();
      });
    });

    it('should get real # of confirmations based on current block height', function(done) {
      var _confirmations = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 6;
      WalletService._cachedBlockheight = null;

      var h = helpers.historyCacheTest(20);
      _.each(h, function(x, i) {
        x.confirmations = 500 + i;
        x.blockheight = 1000 - i;
      });
      helpers.stubHistory(h);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');

      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1500);

      // Cache txs
      server.getTxHistory({
        skip: 0,
        limit: 30,
      }, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        server.getTxHistory({
          skip: 0,
          limit: 30,
        }, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(20);
          // tx.height -> 1000
          // bcHeight -> 1500
          // => 501 confirmations.
          _.head(txs).confirmations.should.equal(501);
          _.last(txs).confirmations.should.equal(520);

          blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 2000);
          server._notify('NewBlock', {
            coin: 'btc',
            network: 'livenet',
            hash: 'dummy hash',
          }, {
            isGlobal: true
          }, function(err) {
            should.not.exist(err);
            setTimeout(function() {
              server.getTxHistory({
                skip: 0,
                limit: 30,
              }, function(err, txs) {
                should.not.exist(err);
                _.head(txs).confirmations.should.equal(1001);
                _.last(txs).confirmations.should.equal(1020);

                server.storage.storeTxHistoryCache.restore();
                Defaults.CONFIRMATIONS_TO_START_CACHING = _confirmations;
                done();
              });
            }, 100);
          });
        });
      });
    });

    it('should get cached # of confirmations if current height unknown', function(done) {
      var _confirmations = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 6;
      WalletService._cachedBlockheight = null;

      var h = helpers.historyCacheTest(20);
      _.each(h, function(x, i) {
        x.confirmations = 500 + i;
        x.blockheight = 1000 - i;
      });
      helpers.stubHistory(h);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');

      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, null);

      // Cache txs
      server.getTxHistory({
        skip: 0,
        limit: 30,
      }, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(20);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        server.getTxHistory({
          skip: 0,
          limit: 30,
        }, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(20);
          _.head(txs).confirmations.should.equal(500);
          _.last(txs).confirmations.should.equal(519);

          server.storage.storeTxHistoryCache.restore();
          Defaults.CONFIRMATIONS_TO_START_CACHING = _confirmations;
          done();
        });
      });
    });

    it('should get returned # of confirmations for non cached txs', function(done) {
      var _confirmations = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 6;
      WalletService._cachedBlockheight = null;

      var h = helpers.historyCacheTest(20);
      helpers.stubHistory(h);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');

      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 500);

      // Cache txs
      server.getTxHistory({
        skip: 0,
        limit: 30,
      }, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(20);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        server.getTxHistory({
          skip: 0,
          limit: 30,
        }, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(20);
          _.head(txs).confirmations.should.equal(0);
          _.last(txs).confirmations.should.equal(19);

          server.storage.storeTxHistoryCache.restore();
          Defaults.CONFIRMATIONS_TO_START_CACHING = _confirmations;
          done();
        });
      });
    });

    describe('Downloading history', function() {
      var h;
      beforeEach(function(done) {
        blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
        h = helpers.historyCacheTest(200);
        helpers.stubHistory(h);
        server.storage.clearTxHistoryCache(server.walletId, function() {
          done();
        });
      });

      it('from 0 to 200, two times, in order', function(done) {
        async.eachSeries(_.range(0, 200, 5), function(i, next) {
          server.getTxHistory({
            skip: i,
            limit: 5,
          }, function(err, txs, fromCache) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(5);
            var s = h.slice(i, i + 5);
            _.map(txs, 'txid').should.deep.equal(_.map(s, 'txid'));
            fromCache.should.equal(false);
            next();
          });
        }, function() {
          async.eachSeries(_.range(0, 200, 5), function(i, next) {
            server.getTxHistory({
              skip: i,
              limit: 5,
            }, function(err, txs, fromCache) {
              should.not.exist(err);
              should.exist(txs);
              txs.length.should.equal(5);
              var s = h.slice(i, i + 5);
              _.map(txs, 'txid').should.deep.equal(_.map(s, 'txid'));
              fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING && i < 200);
              next();
            });
          }, done);
        });
      });

      it('from 0 to 200, two times, random', function(done) {
        var indexes = _.range(0, 200, 5);
        async.eachSeries(_.shuffle(indexes), function(i, next) {
          server.getTxHistory({
            skip: i,
            limit: 5,
          }, function(err, txs, fromCache) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(5);
            var s = h.slice(i, i + 5);
            _.map(txs, 'txid').should.deep.equal(_.map(s, 'txid'));
            fromCache.should.equal(false);
            next();
          });
        }, function() {
          async.eachSeries(_.range(0, 190, 7), function(i, next) {
            server.getTxHistory({
              skip: i,
              limit: 7,
            }, function(err, txs, fromCache) {
              should.not.exist(err);
              should.exist(txs);
              txs.length.should.equal(7);
              var s = h.slice(i, i + 7);
              _.map(txs, 'txid').should.deep.equal(_.map(s, 'txid'));
              fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING);
              next();
            });
          }, done);
        });
      });


      it('from 0 to 200, two times, random, with resets', function(done) {
        var indexes = _.range(0, 200, 5);
        async.eachSeries(_.shuffle(indexes), function(i, next) {
          server.getTxHistory({
            skip: i,
            limit: 5,
          }, function(err, txs, fromCache) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(5);
            var s = h.slice(i, i + 5);
            _.map(txs, 'txid').should.deep.equal(_.map(s, 'txid'));
            fromCache.should.equal(false);
            next();
          });
        }, function() {
          async.eachSeries(_.range(0, 200, 5), function(i, next) {

            function resetCache(cb) {
              if (!(i % 25)) {
                storage.softResetTxHistoryCache(server.walletId, function() {
                  return cb(true);
                });
              } else {
                return cb(false);
              }
            }

            resetCache(function(reset) {
              server.getTxHistory({
                skip: i,
                limit: 5,
              }, function(err, txs, fromCache) {
                should.not.exist(err);
                should.exist(txs);
                txs.length.should.equal(5);
                var s = h.slice(i, i + 5);
                _.map(txs, 'txid').should.deep.equal(_.map(s, 'txid'));
                fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING && !reset);
                next();
              });
            });
          }, done);
        });
      });


    });
  });

  describe('#scan', function() {
    var server, wallet;

    describe('1-of-1 wallet (BIP44 & P2PKH)', function() {
      beforeEach(function(done) {
        this.timeout(5000);
        Defaults.SCAN_ADDRESS_GAP = 2;

        helpers.createAndJoinWallet(1, 1, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });
      afterEach(function() {});

      it('should scan main addresses', function(done) {
        helpers.stubAddressActivity(
          ['1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
            '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
            '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
          ]);
        var expectedPaths = [
          'm/0/0',
          'm/0/1',
          'm/0/2',
          'm/1/0',
        ];
        server.scan({}, function(err) {
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.scanStatus.should.equal('success');
            server.storage.fetchAddresses(wallet.id, function(err, addresses) {
              should.exist(addresses);
              addresses.length.should.equal(expectedPaths.length);
              var paths = _.map(addresses, 'path');
              _.difference(paths, expectedPaths).length.should.equal(0);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                address.path.should.equal('m/0/3');
                done();
              });
            });
          });
        });
      });


      it('should not go beyond max gap', function(done) {
        helpers.stubAddressActivity(
          ['1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
            '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
            '1DY9exavapgnCUWDnSTJe1BPzXcpgwAQC4', // m/0/5
            '1LD7Cr68LvBPTUeXrr6YXfGrogR7TVj3WQ', // m/1/3
          ]);
        var expectedPaths = [
          'm/0/0',
          'm/0/1',
          'm/0/2',
        ];
        server.scan({}, function(err) {
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.scanStatus.should.equal('success');
            server.storage.fetchAddresses(wallet.id, function(err, addresses) {
              should.exist(addresses);
              addresses.length.should.equal(expectedPaths.length);
              var paths = _.map(addresses, 'path');
              _.difference(paths, expectedPaths).length.should.equal(0);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                address.path.should.equal('m/0/3');
                // A rescan should see the m/0/5 address initially beyond the gap
                server.scan({}, function(err) {
                  server.createAddress({}, function(err, address) {
                    should.not.exist(err);
                    address.path.should.equal('m/0/6');
                    done();
                  });
                });
              });
            });
          });
        });
      });

      it('should not affect indexes on new wallet', function(done) {
        helpers.stubAddressActivity([]);
        server.scan({}, function(err) {
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.scanStatus.should.equal('success');
            server.storage.fetchAddresses(wallet.id, function(err, addresses) {
              should.not.exist(err);
              addresses.length.should.equal(0);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                address.path.should.equal('m/0/0');
                done();
              });
            });
          });
        });
      });

      it('should not rewind already generated addresses on error', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          address.path.should.equal('m/0/0');
          blockchainExplorer.getAddressActivity = sinon.stub().callsArgWith(1, 'dummy error');
          server.scan({}, function(err) {
            should.exist(err);
            err.toString().should.equal('dummy error');
            server.getWallet({}, function(err, wallet) {
              should.not.exist(err);
              wallet.scanStatus.should.equal('error');
              wallet.addressManager.receiveAddressIndex.should.equal(1);
              wallet.addressManager.changeAddressIndex.should.equal(0);
              server.createAddress({}, function(err, address) {
                should.exist(err);
                err.code.should.equal('WALLET_NEED_SCAN');
                done();
              });
            });
          });
        });
      });

      it('should restore wallet balance', function(done) {
        async.waterfall([

          function(next) {
            helpers.stubUtxos(server, wallet, [1, 2, 3], function(utxos) {
              should.exist(utxos);
              helpers.stubAddressActivity(_.map(utxos, 'address'));
              server.getBalance({}, function(err, balance) {
                balance.totalAmount.should.equal(helpers.toSatoshi(6));
                next(null, server, wallet);
              });
            });
          },
          function(server, wallet, next) {
            server.removeWallet({}, function(err) {
              next(err);
            });
          },
          function(next) {
            // NOTE: this works because it creates the exact same wallet!
            helpers.createAndJoinWallet(1, 1, function(server, wallet) {
              server.getBalance({}, function(err, balance) {
                balance.totalAmount.should.equal(0);
                next(null, server, wallet);
              });
            });
          },
          function(server, wallet, next) {
            server.scan({}, function(err) {
              should.not.exist(err);
              server.getBalance({}, function(err, balance) {
                balance.totalAmount.should.equal(helpers.toSatoshi(6));
                next();
              })
            });
          },
        ], function(err) {
          should.not.exist(err);
          done();
        });
      });

      it('should abort scan if there is an error checking address activity', function(done) {
        blockchainExplorer.getAddressActivity = sinon.stub().callsArgWith(1, 'dummy error');
        server.scan({}, function(err) {
          should.exist(err);
          err.toString().should.equal('dummy error');
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.scanStatus.should.equal('error');
            wallet.addressManager.receiveAddressIndex.should.equal(0);
            wallet.addressManager.changeAddressIndex.should.equal(0);
            server.storage.fetchAddresses(wallet.id, function(err, addresses) {
              should.not.exist(err);
              addresses.should.be.empty;
              server.getStatus({}, function(err, status) {
                should.exist(err);
                err.code.should.equal('WALLET_NEED_SCAN');
                done();
              });
            });
          });
        });
      });

      it.skip('index cache: should use cache, if previous scan failed', function(done) {
        helpers.stubAddressActivity(
          ['1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
            '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
            '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
          ], 4);

        // First without activity
        var addr = '1KbTiFvjbN6B5reCVS4tTT49vPQkvsqnE2'; // m/0/3

        server.scan({ startingStep: 1 }, function(err) {
          should.exist('failed on request');

          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);

            // Because it failed
            wallet.addressManager.receiveAddressIndex.should.equal(0);
            wallet.addressManager.changeAddressIndex.should.equal(0);

            helpers.stubAddressActivity(
              ['1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
                '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
                '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
              ], -1);
            var getAddressActivitySpy = sinon.spy(blockchainExplorer, 'getAddressActivity');

            server.scan( { startingStep:1 }, function(err) {
              should.not.exist(err);

              // should prederive 3 address, so 
              // First call should be m/0/3
              var calls = getAddressActivitySpy.getCalls();
              calls[0].args[0].should.equal(addr);

              server.storage.fetchAddresses(wallet.id, function(err, addresses) {
                should.exist(addresses);
                server.createAddress({}, function(err, address) {
                  should.not.exist(err);
                  address.path.should.equal('m/0/3');
                  done();
                });
              });
            });
          });
        });
      });

      it.skip('index cache: should not use cache, if scan worked ok', function(done) {
        helpers.stubAddressActivity(
          ['1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
            '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
            '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
          ]);

        // First without activity
        var addr = '1KbTiFvjbN6B5reCVS4tTT49vPQkvsqnE2'; // m/0/3

        server.scan({ start}, function(err) {
          should.not.exist(err);

          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.addressManager.receiveAddressIndex.should.equal(3);
            wallet.addressManager.changeAddressIndex.should.equal(1);

            var getAddressActivitySpy = sinon.spy(blockchainExplorer, 'getAddressActivity');

            server.scan({}, function(err) {
              should.not.exist(err);

              var calls = getAddressActivitySpy.getCalls();
              calls[0].args[0].should.equal(addr);
              server.storage.fetchAddresses(wallet.id, function(err, addresses) {
                should.exist(addresses);
                server.createAddress({}, function(err, address) {
                  should.not.exist(err);
                  address.path.should.equal('m/0/3');
                  done();
                });
              });
            });
          });
        });
      });


      it('powerScan: should add not add skipped addresses if there is no activity', function(done) {
        Defaults.SCAN_ADDRESS_GAP = 5;
        helpers.stubAddressActivity(
          ['1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
            '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
            '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
          ]);

        // First without activity
        var addr = '1KbTiFvjbN6B5reCVS4tTT49vPQkvsqnE2'; // m/0/3

        server.scan({ startingStep: 1000 }, function(err) {
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.addressManager.receiveAddressIndex.should.equal(3);
            wallet.addressManager.changeAddressIndex.should.equal(1);
            server.getMainAddresses({}, function(err, addr) {
              should.not.exist(err);
              addr.length.should.equal(3);
              done();
            });
          });
        });
      });

      it('powerScan: should add skipped addresses', function(done) {
        Defaults.SCAN_ADDRESS_GAP = 5;
        this.timeout(10000);
        helpers.stubAddressActivity(
          ['1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
            '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
            '1Lz4eBV8xVkSGkjhHSRkgQvi79ieYgWJWc', //m/0/99
            '1HhAmuUfUszfAdK1jyumvBQoSj9tLB3PE', //m/0/199
            '1PTrZzp5Kk78uVxnPUHYEHBktADgv3RhrC', //m/0/200
            '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
            '12vSXvVzY1KjAVRz18KrsKgMoy89fQ7Xo4', //m/1/9
          ]);

        // First without activity
        var addr = '1KbTiFvjbN6B5reCVS4tTT49vPQkvsqnE2'; // m/0/3

        server.scan({ startingStep: 1000 }, function(err) {
console.log('[server.js.7365:err:]',err); //TODO
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
console.log('[server.js.7368:err:]',err); //TODO
            should.not.exist(err);
            wallet.addressManager.receiveAddressIndex.should.equal(201);
            wallet.addressManager.changeAddressIndex.should.equal(10);
            server.getMainAddresses({}, function(err, addr) {
console.log('[server.js.7373:err:]',err); //TODO
              should.not.exist(err);

              //201 MAIN addresses (0 to 200)
              addr.length.should.equal(201);
              done();
            });
          });
        });
      });
    });

    describe('shared wallet (BIP45)', function() {

      beforeEach(function(done) {
        this.timeout(5000);
        Defaults.SCAN_ADDRESS_GAP = 2;

        helpers.createAndJoinWallet(1, 2, {
          supportBIP44AndP2PKH: false
        }, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });
      afterEach(function() {});

      it('should scan main addresses', function(done) {
        helpers.stubAddressActivity(
          ['39AA1Y2VvPJhV3RFbc7cKbUax1WgkPwweR', // m/2147483647/0/0
            '3QX2MNSijnhCALBmUVnDo5UGPj3SEGASWx', // m/2147483647/0/2
            '3MzGaz4KKX66w8ShKaR536ZqzVvREBqqYu', // m/2147483647/1/0
          ]);
        var expectedPaths = [
          'm/2147483647/0/0',
          'm/2147483647/0/1',
          'm/2147483647/0/2',
          'm/2147483647/1/0',
        ];
        server.scan({}, function(err) {
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.scanStatus.should.equal('success');
            server.storage.fetchAddresses(wallet.id, function(err, addresses) {
              should.exist(addresses);
              addresses.length.should.equal(expectedPaths.length);
              var paths = _.map(addresses, 'path');
              _.difference(paths, expectedPaths).length.should.equal(0);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                address.path.should.equal('m/2147483647/0/3');
                done();
              });
            });
          });
        });
      });
      it('should scan main addresses & copayer addresses', function(done) {
        helpers.stubAddressActivity(
          ['39AA1Y2VvPJhV3RFbc7cKbUax1WgkPwweR', // m/2147483647/0/0
            '3MzGaz4KKX66w8ShKaR536ZqzVvREBqqYu', // m/2147483647/1/0
            '3BYoynejwBH9q4Jhr9m9P5YTnLTu57US6g', // m/0/0/1
            '37Pb8c32hzm16tCZaVHj4Dtjva45L2a3A3', // m/1/1/0
            '32TB2n283YsXdseMqUm9zHSRcfS5JxTWxx', // m/1/0/0
          ]);
        var expectedPaths = [
          'm/2147483647/0/0',
          'm/2147483647/1/0',
          'm/0/0/0',
          'm/0/0/1',
          'm/1/0/0',
          'm/1/1/0',
        ];
        server.scan({
          includeCopayerBranches: true
        }, function(err) {
console.log('[server.js.7446:err:]',err); //TODO
          should.not.exist(err);
          server.storage.fetchAddresses(wallet.id, function(err, addresses) {
            should.exist(addresses);
            addresses.length.should.equal(expectedPaths.length);
            var paths = _.map(addresses, 'path');
            _.difference(paths, expectedPaths).length.should.equal(0);
            done();
          })
        });
      });
    });
  });

  describe('#startScan', function() {
    var server, wallet;
    beforeEach(function(done) {
      this.timeout(5000);
      Defaults.SCAN_ADDRESS_GAP = 2;

      helpers.createAndJoinWallet(1, 1, {
        supportBIP44AndP2PKH: false
      }, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });
    afterEach(function() {
      server.messageBroker.removeAllListeners();
    });

    it('should start an asynchronous scan', function(done) {
      helpers.stubAddressActivity(
        ['3GvvHimEMk2GBZnPxTF89GHZL6QhZjUZVs', // m/2147483647/0/0
          '37pd1jjTUiGBh8JL2hKLDgsyrhBoiz5vsi', // m/2147483647/0/2
          '3C3tBn8Sr1wHTp2brMgYsj9ncB7R7paYuB', // m/2147483647/1/0
        ]);
      var expectedPaths = [
        'm/2147483647/0/0',
        'm/2147483647/0/1',
        'm/2147483647/0/2',
        'm/2147483647/1/0',
      ];
      server.messageBroker.onMessage(function(n) {
        if (n.type == 'ScanFinished') {
          server.getWallet({}, function(err, wallet) {
            should.exist(wallet.scanStatus);
            wallet.scanStatus.should.equal('success');
            should.not.exist(n.creatorId);
            server.storage.fetchAddresses(wallet.id, function(err, addresses) {
              should.exist(addresses);
              addresses.length.should.equal(expectedPaths.length);
              var paths = _.map(addresses, 'path');
              _.difference(paths, expectedPaths).length.should.equal(0);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                address.path.should.equal('m/2147483647/0/3');
                done();
              });
            })
          });
        }
      });
      server.startScan({}, function(err) {
        should.not.exist(err);
      });
    });
    it('should set scan status error when unable to reach blockchain', function(done) {
      blockchainExplorer.getAddressActivity = sinon.stub().yields('dummy error');
      server.messageBroker.onMessage(function(n) {
        if (n.type == 'ScanFinished') {
          should.exist(n.data.error);
          server.getWallet({}, function(err, wallet) {
            should.exist(wallet.scanStatus);
            wallet.scanStatus.should.equal('error');
            done();
          });
        }
      });
      server.startScan({}, function(err) {
        should.not.exist(err);
      });
    });
    it('should start multiple asynchronous scans for different wallets', function(done) {
      helpers.stubAddressActivity(['3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A']);
      Defaults.SCAN_ADDRESS_GAP = 1;

      var scans = 0;
      server.messageBroker.onMessage(function(n) {
        if (n.type == 'ScanFinished') {
          scans++;
          if (scans == 2) done();
        }
      });

      // Create a second wallet
      var server2 = new WalletService();
      var opts = {
        name: 'second wallet',
        m: 1,
        n: 1,
        pubKey: TestData.keyPair.pub,
      };
      server2.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'copayer 1',
          xPubKey: TestData.copayers[3].xPubKey_45H,
          requestPubKey: TestData.copayers[3].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server2) {
            server.startScan({}, function(err) {
              should.not.exist(err);
              scans.should.equal(0);
            });
            server2.startScan({}, function(err) {
              should.not.exist(err);
              scans.should.equal(0);
            });
            scans.should.equal(0);
          });
        });
      });
    });
  });

  describe('PayPro', function() {
    var server, wallet;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should create a paypro tx', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2], function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.8e8
          }],
          feePerKb: 100e2,
          message: 'some message',
          customData: 'some custom data',
          payProUrl: 'http:/fakeurl.com',
        };
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.payProUrl.should.equal('http:/fakeurl.com');
          done();
        });
      });
    });
  });

  describe('Push notifications', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should subscribe copayer to push notifications service', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id, function(server) {
        should.exist(server);
        server.pushNotificationsSubscribe({
          token: 'DEVICE_TOKEN',
          packageName: 'com.wallet',
          platform: 'Android',
        }, function(err) {
          should.not.exist(err);
          server.storage.fetchPushNotificationSubs(wallet.copayers[0].id, function(err, subs) {
            should.not.exist(err);
            should.exist(subs);
            subs.length.should.equal(1);
            var s = subs[0];
            s.token.should.equal('DEVICE_TOKEN');
            s.packageName.should.equal('com.wallet');
            s.platform.should.equal('Android')
            done();
          });
        });
      });
    });
    it('should allow multiple subscriptions for the same copayer', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id, function(server) {
        should.exist(server);
        server.pushNotificationsSubscribe({
          token: 'DEVICE_TOKEN',
          packageName: 'com.wallet',
          platform: 'Android',
        }, function(err) {
          server.pushNotificationsSubscribe({
            token: 'DEVICE_TOKEN2',
            packageName: 'com.my-other-wallet',
            platform: 'iOS',
          }, function(err) {
            should.not.exist(err);
            server.storage.fetchPushNotificationSubs(wallet.copayers[0].id, function(err, subs) {
              should.not.exist(err);
              should.exist(subs);
              subs.length.should.equal(2);
              done();
            });
          });
        });
      });
    });

    it('should unsubscribe copayer to push notifications service', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id, function(server) {
        should.exist(server);
        async.series([

          function(next) {
            server.pushNotificationsSubscribe({
              token: 'DEVICE_TOKEN',
              packageName: 'com.wallet',
              platform: 'Android',
            }, next);
          },
          function(next) {
            server.pushNotificationsSubscribe({
              token: 'DEVICE_TOKEN2',
              packageName: 'com.my-other-wallet',
              platform: 'iOS',
            }, next);
          },
          function(next) {
            server.pushNotificationsUnsubscribe({
              token: 'DEVICE_TOKEN2'
            }, next);
          },
          function(next) {
            server.storage.fetchPushNotificationSubs(wallet.copayers[0].id, function(err, subs) {
              should.not.exist(err);
              should.exist(subs);
              subs.length.should.equal(1);
              var s = subs[0];
              s.token.should.equal('DEVICE_TOKEN');
              next();
            });
          },
          function(next) {
            helpers.getAuthServer(wallet.copayers[1].id, function(server) {
              server.pushNotificationsUnsubscribe({
                token: 'DEVICE_TOKEN'
              }, next);
            });
          },
          function(next) {
            server.storage.fetchPushNotificationSubs(wallet.copayers[0].id, function(err, subs) {
              should.not.exist(err);
              should.exist(subs);
              subs.length.should.equal(1);
              var s = subs[0];
              s.token.should.equal('DEVICE_TOKEN');
              next();
            });
          },
        ], function(err) {
          should.not.exist(err);
          done();
        });
      });
    });
  });

  describe('Tx confirmation notifications', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should subscribe copayer to a tx confirmation', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id, function(server) {
        should.exist(server);
        server.txConfirmationSubscribe({
          txid: '123',
        }, function(err) {
          should.not.exist(err);
          server.storage.fetchActiveTxConfirmationSubs(wallet.copayers[0].id, function(err, subs) {
            should.not.exist(err);
            should.exist(subs);
            subs.length.should.equal(1);
            var s = subs[0];
            s.txid.should.equal('123');
            s.isActive.should.be.true;
            done();
          });
        });
      });
    });
    it('should overwrite last subscription', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id, function(server) {
        should.exist(server);
        server.txConfirmationSubscribe({
          txid: '123',
        }, function(err) {
          server.txConfirmationSubscribe({
            txid: '123',
          }, function(err) {
            should.not.exist(err);
            server.storage.fetchActiveTxConfirmationSubs(wallet.copayers[0].id, function(err, subs) {
              should.not.exist(err);
              should.exist(subs);
              subs.length.should.equal(1);
              done();
            });
          });
        });
      });
    });

    it('should unsubscribe copayer to the specified tx', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id, function(server) {
        should.exist(server);
        async.series([

          function(next) {
            server.txConfirmationSubscribe({
              txid: '123',
            }, next);
          },
          function(next) {
            server.txConfirmationSubscribe({
              txid: '456',
            }, next);
          },
          function(next) {
            server.txConfirmationUnsubscribe({
              txid: '123',
            }, next);
          },
          function(next) {
            server.storage.fetchActiveTxConfirmationSubs(wallet.copayers[0].id, function(err, subs) {
              should.not.exist(err);
              should.exist(subs);
              subs.length.should.equal(1);
              var s = subs[0];
              s.txid.should.equal('456');
              next();
            });
          },
          function(next) {
            helpers.getAuthServer(wallet.copayers[1].id, function(server) {
              server.txConfirmationUnsubscribe({
                txid: '456'
              }, next);
            });
          },
          function(next) {
            server.storage.fetchActiveTxConfirmationSubs(wallet.copayers[0].id, function(err, subs) {
              should.not.exist(err);
              should.exist(subs);
              subs.length.should.equal(1);
              var s = subs[0];
              s.txid.should.equal('456');
              next();
            });
          },
        ], function(err) {
          should.not.exist(err);
          done();
        });
      });
    });
  });

  describe('#getWalletFromIdentifier', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, {}, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get wallet from id', function(done) {
      server.getWalletFromIdentifier({
        identifier: wallet.id
      }, function(err, w) {
        should.not.exist(err);
        should.exist(w);
        w.id.should.equal(wallet.id);
        done();
      });
    });
    it('should get wallet from address', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        should.exist(address);
        server.getWalletFromIdentifier({
          identifier: address.address
        }, function(err, w) {
          should.not.exist(err);
          should.exist(w);
          w.id.should.equal(wallet.id);
          done();
        });
      });
    });
    it('should get wallet from tx proposal', function(done) {
      helpers.stubUtxos(server, wallet, '1 btc', function() {
        helpers.stubBroadcast();
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 1000e2
          }],
          feePerKb: 100e2,
          message: 'some message',
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(txp) {
          should.exist(txp);
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txp.id,
            signatures: signatures,
          }, function(err) {
            should.not.exist(err);
            server.getPendingTxs({}, function(err, txps) {
              should.not.exist(err);
              txp = txps[0];
              server.getWalletFromIdentifier({
                identifier: txp.txid
              }, function(err, w) {
                should.not.exist(err);
                should.exist(w);
                w.id.should.equal(wallet.id);
                done();
              });
            });
          });
        });
      });
    });
    it('should get wallet from incoming txid', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        should.exist(address);
        blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, {
          txid: '999',
          vout: [{
            scriptPubKey: {
              addresses: [address.address]
            }
          }],
        });
        server.getWalletFromIdentifier({
          identifier: '999'
        }, function(err, w) {
          should.not.exist(err);
          should.exist(w);
          w.id.should.equal(wallet.id);
          done();
        });
      });
    });
    it('should return nothing if identifier not associated with a wallet', function(done) {
      blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
      server.getWalletFromIdentifier({
        identifier: 'dummy'
      }, function(err, w) {
        should.not.exist(err);
        should.not.exist(w);
        done();
      });
    });
  });

  describe('Sync wallet with grouping block explorer', function() {
    var server , wallet;
    beforeEach(function(done) {
  
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;

        helpers.setupGroupingBE(blockchainExplorer);
          w.copayers[0].id.should.equal(TestData.copayers[0].id44btc);
        done();
      });
    });
    it('should create and register and address', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        blockchainExplorer.register.calledOnce.should.equal(true);
        blockchainExplorer.addAddresses.calledOnce.should.equal(true);
        var calls= blockchainExplorer.addAddresses.getCalls();
        calls[0].args[1].should.deep.equal([address.address]);
        done();
      });
    });

    it('should create and register a wallet with 2 addresses', function(done) {
      server.createAddress({}, function(err, address1) {
        server.createAddress({}, function(err, address2) {
          should.not.exist(err);
          blockchainExplorer.register.calledOnce.should.equal(true);
          blockchainExplorer.addAddresses.calledTwice.should.equal(true);
         var calls= blockchainExplorer.addAddresses.getCalls();

          //  should only sync address 2
          calls[1].args[1].should.deep.equal([address2.address]);
          done();
        });
      });
    });

    it('should sync all wallet address if a first sync failed', function(done) {
      blockchainExplorer.addAddresses = sinon.stub().callsArgWith(2, 'error');
      server.createAddress({}, function(err, address1) {
        blockchainExplorer.addAddresses = sinon.stub().callsArgWith(2, null, null);
        server.createAddress({}, function(err, address2) {
          should.not.exist(err);
          var calls= blockchainExplorer.addAddresses.getCalls();
          // should sync both addresses, since it failed the first time
          // (call is 0 becuase the stub was rewritten)
          calls[0].args[1].should.deep.equal([address1.address, address2.address]);
          done();
        });
      });
    });


    it.skip('TODO:  should sync address in batch', function(done) {});


  });

  describe('BTC & BCH wallets with same seed', function() {
    var server = {},
      wallet = {};
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server.btc = s;
        wallet.btc = w;
        w.copayers[0].id.should.equal(TestData.copayers[0].id44btc);
        helpers.createAndJoinWallet(1, 1, {
          coin: 'bch'
        }, function(s, w) {
          server.bch = s;
          wallet.bch = w;
          w.copayers[0].id.should.equal(TestData.copayers[0].id44bch);
          done();
        });
      });
    });

    it('should create address', function(done) {
      server.btc.createAddress({}, function(err, address) {
        should.not.exist(err);
        should.exist(address);
        address.walletId.should.equal(wallet.btc.id);
        address.coin.should.equal('btc');
        address.network.should.equal('livenet');
        address.address.should.equal('1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG');
        server.bch.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.bch.id);
          address.coin.should.equal('bch');
          address.network.should.equal('livenet');
          address.address.should.equal('CbWsiNjh18ynQYc5jfYhhespEGrAaW8YUq');
          server.btc.getMainAddresses({}, function(err, addresses) {
            should.not.exist(err);
            addresses.length.should.equal(1);
            addresses[0].coin.should.equal('btc');
            addresses[0].walletId.should.equal(wallet.btc.id);
            addresses[0].address.should.equal('1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG');
            server.bch.getMainAddresses({}, function(err, addresses) {
              should.not.exist(err);
              addresses.length.should.equal(1);
              addresses[0].coin.should.equal('bch');
              addresses[0].walletId.should.equal(wallet.bch.id);
              addresses[0].address.should.equal('CbWsiNjh18ynQYc5jfYhhespEGrAaW8YUq');
              done();
            });
          });
        });
      });
    });
  });

});
