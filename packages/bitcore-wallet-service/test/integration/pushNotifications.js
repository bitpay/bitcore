'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;
log.level = 'info';

var sjcl = require('sjcl');

var { WalletService } = require('../../ts_build/lib/server');
var { PushNotificationsService } = require('../../ts_build/lib/pushnotificationsservice');

var TestData = require('../testdata');
var helpers = require('./helpers');
const TOKENS = ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', '0x8E870D67F660D95d5be530380D0eC0bd388289E1', '0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd'];


describe('Push notifications', function() {
  var server, wallet, requestStub, pushNotificationsService, walletId;


  before(function(done) {
    helpers.before((res) => {
      done();
    });
  });


  after(function(done) {
    helpers.after(done);
  });

  describe('Single wallet', function() {
    beforeEach(function(done) {
      helpers.beforeEach(function(res) {
        helpers.createAndJoinWallet(1, 1, function(s, w) {
          server = s;
          wallet = w;

          var i = 0;
          async.eachSeries(w.copayers, function(copayer, next) {
            helpers.getAuthServer(copayer.id, function(server) {
              async.parallel([

                function(done) {
                  server.savePreferences({
                    email: 'copayer' + (++i) + '@domain.com',
                    language: 'en',
                    unit: 'bit',
                  }, done);
                },
                function(done) {
                  server.pushNotificationsSubscribe({
                    token: '1234',
                    packageName: 'com.wallet',
                    platform: 'Android',
                  }, done);
                },
              ], next);

            });
          }, function(err) {
            should.not.exist(err);

            requestStub = sinon.stub();
            requestStub.yields();

            pushNotificationsService = new PushNotificationsService();
            pushNotificationsService.start({
              lockOpts: {},
              messageBroker: server.messageBroker,
              storage: helpers.getStorage(),
              request: requestStub,
              pushNotificationsOpts: {
                templatePath: 'templates',
                defaultLanguage: 'en',
                defaultUnit: 'btc',
                subjectPrefix: '',
                pushServerUrl: 'http://localhost:8000',
                authorizationKey: 'secret',
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should build each notifications using preferences of the copayers', function(done) {
      server.savePreferences({
        language: 'en',
        unit: 'bit',
      }, function(err) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, {
            isGlobal: true
          }, function(err) {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              var args = _.map(calls, function(c) {
                return c.args[0];
              });
              calls.length.should.equal(1);
              args[0].body.notification.title.should.contain('New payment received');
              args[0].body.notification.body.should.contain('123,000');
              args[0].body.notification.body.should.contain('bits');
              done();
            }, 100);
          });
        });
      });
    });

    it('should not notify auto-payments to creator', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, {
          isGlobal: false
        }, function(err) {
          setTimeout(function() {
            var calls = requestStub.getCalls();
            calls.length.should.equal(0);
            done();
          }, 100);
        });
      });
    });

    it('should notify copayers when payment is received', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, {
          isGlobal: true
        }, function(err) {
          setTimeout(function() {
            var calls = requestStub.getCalls();
            calls.length.should.equal(1);
            done();
          }, 100);
        });
      });
    });

    it('should notify copayers when tx is confirmed if they are subscribed', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        server.txConfirmationSubscribe({
          txid: '123'
        }, function(err) {
          should.not.exist(err);

          // Simulate tx confirmation notification
          server._notify('TxConfirmation', {
            txid: '123',
          }, function(err) {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              calls.length.should.equal(1);
              done();
            }, 100);
          });
        });
      });
    });
  });

  describe('Shared wallet', function() {
    beforeEach(function(done) {
      helpers.beforeEach(function(res) {
        helpers.createAndJoinWallet(2, 3, function(s, w) {
          server = s;
          wallet = w;
          var i = 0;
          async.eachSeries(w.copayers, function(copayer, next) {
            helpers.getAuthServer(copayer.id, function(server) {
              async.parallel([

                function(done) {
                  server.savePreferences({
                    email: 'copayer' + (++i) + '@domain.com',
                    language: 'en',
                    unit: 'bit',
                  }, done);
                },
                function(done) {
                  server.pushNotificationsSubscribe({
                    token: '1234',
                    packageName: 'com.wallet',
                    platform: 'Android',
                  }, done);
                },
              ], next);

            });
          }, function(err) {
            should.not.exist(err);

            requestStub = sinon.stub();
            requestStub.yields();

            pushNotificationsService = new PushNotificationsService();
            pushNotificationsService.start({
              lockOpts: {},
              messageBroker: server.messageBroker,
              storage: helpers.getStorage(),
              request: requestStub,
              pushNotificationsOpts: {
                templatePath: 'templates',
                defaultLanguage: 'en',
                defaultUnit: 'btc',
                subjectPrefix: '',
                pushServerUrl: 'http://localhost:8000',
                authorizationKey: 'secret',
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should build each notifications using preferences of the copayers', function(done) {
      server.savePreferences({
        email: 'copayer1@domain.com',
        language: 'es',
        unit: 'btc',
      }, function(err) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, {
            isGlobal: true
          }, function(err) {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              var args = _.map(calls, function(c) {
                return c.args[0];
              });

              calls.length.should.equal(3);

              args[0].body.notification.title.should.contain('Nuevo pago recibido');
              args[0].body.notification.body.should.contain('0.123');

              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.body.should.contain('123,000');

              args[2].body.notification.title.should.contain('New payment received');
              args[2].body.notification.body.should.contain('123,000');
              done();
            }, 100);
          });
        });
      });
    });

    it('should notify copayers when payment is received', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, {
          isGlobal: true
        }, function(err) {
          setTimeout(function() {
            var calls = requestStub.getCalls();
            calls.length.should.equal(3);

            done();
          }, 100);
        });
      });
    });

    it('should not notify auto-payments to creator', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, {
          isGlobal: false
        }, function(err) {
          setTimeout(function() {
            var calls = requestStub.getCalls();
            calls.length.should.equal(2);

            done();
          }, 100);
        });
      });
    });

    it('should notify copayers a new tx proposal has been created', function(done) {
      helpers.stubUtxos(server, wallet, [1, 1], function() {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          server._notify('NewTxProposal', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, {
            isGlobal: false
          }, function(err) {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              calls.length.should.equal(2);

              done();
            }, 100);
          });
        });
      });
    });

    it('should notify copayers a tx has been finally rejected', function(done) {
      helpers.stubUtxos(server, wallet, 1, function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.8e8
          }],
          feePerKb: 100e2
        };

        var txpId;
        async.waterfall([

          function(next) {
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              next(null, tx);
            });
          },
          function(txp, next) {
            txpId = txp.id;
            async.eachSeries(_.range(1, 3), function(i, next) {
              var copayer = TestData.copayers[i];
              helpers.getAuthServer(copayer.id44btc, function(server) {
                server.rejectTx({
                  txProposalId: txp.id,
                }, next);
              });
            }, next);
          },
        ], function(err) {
          should.not.exist(err);

          setTimeout(function() {
            var calls = requestStub.getCalls();
            var args = _.map(_.takeRight(calls, 2), function(c) {
              return c.args[0];
            });

            args[0].body.notification.title.should.contain('Payment proposal rejected');
            done();
          }, 100);
        });
      });
    });

    it('should notify copayers a new outgoing tx has been created', function(done) {
      helpers.stubUtxos(server, wallet, 1, function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.8e8
          }],
          feePerKb: 100e2
        };

        var txp;
        async.waterfall([

          function(next) {
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
              next(null, tx);
            });
          },
          function(t, next) {
            txp = t;
            async.eachSeries(_.range(1, 3), function(i, next) {
              var copayer = TestData.copayers[i];
              helpers.getAuthServer(copayer.id44btc, function(s) {
                server = s;
                var signatures = helpers.clientSign(txp, copayer.xPrivKey_44H_0H_0H);
                server.signTx({
                  txProposalId: txp.id,
                  signatures: signatures,
                }, function(err, t) {
                  txp = t;
                  next();
                });
              });
            }, next);
          },
          function(next) {
            helpers.stubBroadcast(txp.txid);
            server.broadcastTx({
              txProposalId: txp.id,
            }, next);
          },
        ], function(err) {
          should.not.exist(err);

          setTimeout(function() {
            var calls = requestStub.getCalls();
            var args = _.map(_.takeRight(calls, 2), function(c) {
              return c.args[0];
            });

            args[0].body.notification.title.should.contain('Payment sent');
            args[1].body.notification.title.should.contain('Payment sent');

            sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(server.copayerId)).should.not.equal(args[0].body.data.copayerId);
            sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(server.copayerId)).should.not.equal(args[1].body.data.copayerId);
            done();
          }, 100);
        });
      });
    });
  });

  describe('joinWallet', function() {
    beforeEach(function(done) {
      helpers.beforeEach(function(res) {
        server = new WalletService();
        var walletOpts = {
          name: 'my wallet',
          m: 1,
          n: 3,
          pubKey: TestData.keyPair.pub,
        };
        server.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletId = wId;
          should.exist(walletId);
          requestStub = sinon.stub();
          requestStub.yields();

          pushNotificationsService = new PushNotificationsService();
          pushNotificationsService.start({
            lockOpts: {},
            messageBroker: server.messageBroker,
            storage: helpers.getStorage(),
            request: requestStub,
            pushNotificationsOpts: {
              templatePath: 'templates',
              defaultLanguage: 'en',
              defaultUnit: 'btc',
              subjectPrefix: '',
              pushServerUrl: 'http://localhost:8000',
              authorizationKey: 'secret',
            },
          }, function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should notify copayers when a new copayer just joined into your wallet except the one who joined', function(done) {
      async.eachSeries(_.range(3), function(i, next) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'copayer ' + (i + 1),
          xPubKey: TestData.copayers[i].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[i].pubKey_1H_0,
          customData: 'custom data ' + (i + 1),
        });

        server.joinWallet(copayerOpts, function(err, res) {
          if (err) return next(err);

          helpers.getAuthServer(res.copayerId, function(server) {
            server.pushNotificationsSubscribe({
              token: 'token:' + copayerOpts.name,
              packageName: 'com.wallet',
              platform: 'Android',
            }, next);
          });
        });
      }, function(err) {
        should.not.exist(err);
        setTimeout(function() {
          var calls = requestStub.getCalls();
          var args = _.filter(_.map(calls, function(call) {
            return call.args[0];
          }), function(arg) {
            return arg.body.notification.title == 'New copayer';
          });

          server.getWallet(null, function(err, wallet) {
            /*
              First call - copayer2 joined
              copayer2 should notify to copayer1
              copayer2 should NOT be notifyed
            */
            var hashedCopayerIds = _.map(wallet.copayers, function(copayer) {
              return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(copayer.id));
            });
            hashedCopayerIds[0].should.equal((args[0].body.data.copayerId));
            hashedCopayerIds[1].should.not.equal((args[0].body.data.copayerId));

            /*
              Second call - copayer3 joined
              copayer3 should notify to copayer1
            */
            hashedCopayerIds[0].should.equal((args[1].body.data.copayerId));

            /*
              Third call - copayer3 joined
              copayer3 should notify to copayer2
            */
            hashedCopayerIds[1].should.equal((args[2].body.data.copayerId));

            // copayer3 should NOT notify any other copayer
            hashedCopayerIds[2].should.not.equal((args[1].body.data.copayerId));
            hashedCopayerIds[2].should.not.equal((args[2].body.data.copayerId));
            done();
          });
        }, 100);
      });
    });
  });

  describe('ERC20 wallet', () => {
    beforeEach((done) => {

      helpers.beforeEach((res) => {
        helpers.createAndJoinWallet(1, 1, { coin: 'eth' }, (s, w) => {
          server = s;
          wallet = w;

          var i = 0;
          async.eachSeries(w.copayers, function(copayer, next) {
            helpers.getAuthServer(copayer.id, function(server) {
              async.parallel([

                function(done) {
                  server.savePreferences({
                    email: 'copayer' + (++i) + '@domain.com',
                    language: 'en',
                    unit: 'bit',
                    tokenAddresses: TOKENS,
                  }, done);
                },
                function(done) {
                  server.pushNotificationsSubscribe({
                    token: '1234',
                    packageName: 'com.wallet',
                    platform: 'Android',
                  }, done);
                },
              ], next);

            });
          }, function(err) {
            should.not.exist(err);

            requestStub = sinon.stub();
            requestStub.yields();

            pushNotificationsService = new PushNotificationsService();
            pushNotificationsService.start({
              lockOpts: {},
              messageBroker: server.messageBroker,
              storage: helpers.getStorage(),
              request: requestStub,
              pushNotificationsOpts: {
                templatePath: 'templates',
                defaultLanguage: 'en',
                defaultUnit: 'eth',
                subjectPrefix: '',
                pushServerUrl: 'http://localhost:8000',
                authorizationKey: 'secret',
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should send notification if the tx is USDC', (done) => {
      server.savePreferences({
        language: 'en',
        unit: 'bit',
      }, function(err) {
        server.createAddress({}, (err, address) => {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '997',
            address: address,
            amount: 4e6, // ~ 4.00 USD
            tokenAddress: TOKENS[0]
          }, {
            isGlobal: true
          }, (err) => {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              calls.length.should.equal(1);
              var args = _.map(_.takeRight(calls, 2), function(c) {
                return c.args[0];
              });
              args[0].body.notification.title.should.contain('New payment received');
              args[0].body.notification.title.should.contain('New payment received');
              args[0].body.notification.body.should.contain('4.00');
              args[0].body.data.tokenAddress.should.equal('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
              done();
            }, 100);
          });
        });
      });
    });
    it('should send notification if the tx is PAX', (done) => {
      server.savePreferences({
        language: 'es',
        unit: 'bit',
      }, function(err) {
        server.createAddress({}, (err, address) => {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '998',
            address: address,
            amount: 4e18, // ~ 4.00 USD
            tokenAddress: TOKENS[1]
          }, {
            isGlobal: true
          }, (err) => {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              calls.length.should.equal(1);
              var args = _.map(_.takeRight(calls, 2), function(c) {
                return c.args[0];
              });
              args[0].body.notification.title.should.contain('Nuevo pago recibido');
              args[0].body.notification.body.should.contain('4.00');
              args[0].body.data.tokenAddress.should.equal('0x8E870D67F660D95d5be530380D0eC0bd388289E1');
              done();
            }, 100);
          });
        });
      });
    });
    it('should send notification if the tx is GUSD', (done) => {
      server.savePreferences({
        language: 'en',
        unit: 'bit',
      }, function(err) {
        server.createAddress({}, (err, address) => {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 4e2, // ~ 4.00 USD
            tokenAddress: TOKENS[2]
          }, {
            isGlobal: true
          }, (err) => {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              calls.length.should.equal(1);
              var args = _.map(_.takeRight(calls, 2), function(c) {
                return c.args[0];
              });
              args[0].body.notification.title.should.contain('New payment received');
              args[0].body.notification.body.should.contain('4.00');
              args[0].body.data.tokenAddress.should.equal('0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd');
              done();
            }, 100);
          });
        });
      });
    });

    it('should not send notification if the tokenAddress is not supported', (done) => {
      server.savePreferences({
        language: 'en',
        unit: 'bit',
      }, function(err) {
        server.createAddress({}, (err, address) => {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 1230000000,
            tokenAddress: 'notSupportedTokenAddress'
          }, {
            isGlobal: true
          }, (err) => {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              calls.length.should.equal(0);
              done();
            }, 100);
          });
        });
      });
    });
  });
});
