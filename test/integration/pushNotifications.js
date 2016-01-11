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
var PushNotificationsService = require('../../lib/pushNotificationsService');

var TestData = require('../testdata');
var helpers = require('./helpers');

describe('Push notifications', function() {
  var server, wallet, requestStub, pushNotificationsService;

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
                templatePath: '../lib/templates',
                defaultLanguage: 'en',
                defaultUnit: 'btc',
                subjectPrefix: '',
                publicTxUrlTemplate: {
                  livenet: 'https://insight.bitpay.com/tx/{{txid}}',
                  testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
                },
                pushServerUrl: 'http://192.168.1.111:8000/send',
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

            args[0].body.android.data.title.should.contain('New payment received');
            args[0].body.android.data.message.should.contain('123,000');

            done();
          }, 100);
        });
      });
    });

    it('number of calls should be 0', function(done) {
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

    it('number of calls should be 1', function(done) {
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
                templatePath: '../lib/templates',
                defaultLanguage: 'en',
                defaultUnit: 'btc',
                subjectPrefix: '',
                publicTxUrlTemplate: {
                  livenet: 'https://insight.bitpay.com/tx/{{txid}}',
                  testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
                },
                pushServerUrl: 'http://192.168.1.111:8000/send',
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

            args[0].body.android.data.title.should.contain('New payment received');
            args[0].body.android.data.message.should.contain('123,000');

            done();
          }, 100);
        });
      });
    });

    it('number of calls should be 3', function(done) {
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

    it('number of calls should be 2', function(done) {
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
        // server.createTxLegacy(txOpts, function(err, tx) {
        //   should.not.exist(err);
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
      // });
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

    it('should notify copayers when a new copayer just joined into your wallet ', function(done) {
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


    // it('should join existing wallet', function(done) {
    //   var copayerOpts = helpers.getSignedCopayerOpts({
    //     walletId: walletId,
    //     name: 'me',
    //     xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
    //     requestPubKey: TestData.copayers[0].pubKey_1H_0,
    //     customData: 'dummy custom data',
    //   });
    //   server.joinWallet(copayerOpts, function(err, result) {
    //     should.not.exist(err);
    //     setTimeout(function() {
    //       var calls = requestStub.getCalls();
    //       var args = _.map(_.takeRight(calls, 2), function(c) {
    //         return c.args[0];
    //       });
    //       console.log(args);

    //       done();
    //     }, 100);
    //   });
    // });
  });


});
