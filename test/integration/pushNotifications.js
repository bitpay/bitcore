'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;
log.level = 'info';

var WalletService = require('../../lib/server');
var PushNotificationsService = require('../../lib/pushnotificationsservice');

var TestData = require('../testdata');
var helpers = require('./helpers');

describe('Push notifications', function() {
  var server, wallet, requestStub, pushNotificationsService, walletId;

  before(function(done) {
    helpers.before(done);
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
              server.savePreferences({
                email: 'copayer' + (++i) + '@domain.com',
                language: 'en',
                unit: 'bit',
              }, next);
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
                templatePath: './lib/templates',
                defaultLanguage: 'en',
                defaultUnit: 'btc',
                subjectPrefix: '',

                pushServerUrl: 'http://localhost:8000/send',
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
              args[0].body.android.data.title.should.contain('New payment received');
              args[0].body.android.data.message.should.contain('123,000');
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
              server.savePreferences({
                email: 'copayer' + (++i) + '@domain.com',
                language: 'en',
                unit: 'bit',
              }, next);
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
                templatePath: './lib/templates',
                defaultLanguage: 'en',
                defaultUnit: 'btc',
                subjectPrefix: '',

                pushServerUrl: 'http://localhost:8000/send',
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

              args[0].body.android.data.title.should.contain('Nuevo pago recibido');
              args[0].body.android.data.message.should.contain('0.123');

              args[1].body.android.data.title.should.contain('New payment received');
              args[1].body.android.data.message.should.contain('123,000');

              args[2].body.android.data.title.should.contain('New payment received');
              args[2].body.android.data.message.should.contain('123,000');
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
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, TestData.copayers[0].privKey_1H_0, {
          message: 'some message'
        });
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
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, TestData.copayers[0].privKey_1H_0, {
          message: 'some message'
        });

        var txpId;
        async.waterfall([

          function(next) {
            server.createTxLegacy(txOpts, next);
          },
          function(txp, next) {
            txpId = txp.id;
            async.eachSeries(_.range(1, 3), function(i, next) {
              var copayer = TestData.copayers[i];
              helpers.getAuthServer(copayer.id44, function(server) {
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

            args[0].body.android.data.title.should.contain('Payment proposal rejected');
            args[0].body.android.data.message.should.contain('copayer 2, copayer 3');
            args[0].body.android.data.message.should.not.contain('copayer 1');
            done();
          }, 100);
        });
      });
    });

    it('should notify copayers a new outgoing tx has been created', function(done) {
      helpers.stubUtxos(server, wallet, 1, function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, TestData.copayers[0].privKey_1H_0, {
          message: 'some message'
        });

        var txp;
        async.waterfall([

          function(next) {
            server.createTxLegacy(txOpts, next);
          },
          function(t, next) {
            txp = t;
            async.eachSeries(_.range(1, 3), function(i, next) {
              var copayer = TestData.copayers[i];
              helpers.getAuthServer(copayer.id44, function(s) {
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
            helpers.stubBroadcast();
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

            args[0].body.android.data.title.should.contain('Payment sent');
            args[1].body.android.data.title.should.contain('Payment sent');

            server.copayerId.should.not.equal((args[0].body.users[0]).split('$')[1]);
            server.copayerId.should.not.equal((args[1].body.users[0]).split('$')[1]);
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
              templatePath: './lib/templates',
              defaultLanguage: 'en',
              defaultUnit: 'btc',
              subjectPrefix: '',
              pushServerUrl: 'http://localhost:8000/send',
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

        server.joinWallet(copayerOpts, next);
      }, function(err) {
        should.not.exist(err);
        setTimeout(function() {
          var calls = requestStub.getCalls();
          var args = _.map(calls, function(c) {
            return c.args[0];
          });

          var argu = _.compact(_.map(args, function(a) {
            if (a.body.android.data.title == 'New copayer')
              return a;
          }));

          server.getWallet(null, function(err, w) {
            /*
              First call - copayer2 joined
              copayer2 should notify to copayer1
              copayer2 should NOT be notifyed
            */
            w.copayers[0].id.should.contain((argu[0].body.users[0]).split('$')[1]);
            w.copayers[1].id.should.not.contain((argu[0].body.users[0]).split('$')[1]);

            /*
              Second call - copayer3 joined
              copayer3 should notify to copayer1
            */
            w.copayers[0].id.should.contain((argu[1].body.users[0]).split('$')[1]);

            /*
              Third call - copayer3 joined
              copayer3 should notify to copayer2
            */
            w.copayers[1].id.should.contain((argu[2].body.users[0]).split('$')[1]);

            // copayer3 should NOT notify any other copayer
            w.copayers[2].id.should.not.contain((argu[1].body.users[0]).split('$')[1]);
            w.copayers[2].id.should.not.contain((argu[2].body.users[0]).split('$')[1]);
            done();
          });
        }, 100);
      });
    });
  });
});
