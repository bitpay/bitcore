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
var EmailService = require('../../lib/emailservice');

var TestData = require('../testdata');
var helpers = require('./helpers');

describe('Email notifications', function() {
  var server, wallet, mailerStub, emailService;

  before(function(done) {
    helpers.before(done);
  });
  after(function(done) {
    helpers.after(done);
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
                unit: 'bit',
              }, next);
            });
          }, function(err) {
            should.not.exist(err);

            mailerStub = sinon.stub();
            mailerStub.sendMail = sinon.stub();
            mailerStub.sendMail.yields();

            emailService = new EmailService();
            emailService.start({
              lockOpts: {},
              messageBroker: server.messageBroker,
              storage: helpers.getStorage(),
              mailer: mailerStub,
              emailOpts: {
                from: 'bws@dummy.net',
                subjectPrefix: '[test wallet]',
                publicTxUrlTemplate: {
                  livenet: 'https://insight.bitpay.com/tx/{{txid}}',
                  testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
                },
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should notify copayers a new tx proposal has been created', function(done) {
      var _readTemplateFile_old = emailService._readTemplateFile;
      emailService._readTemplateFile = function(language, filename, cb) {
        if (_.endsWith(filename, '.html')) {
          return cb(null, '<html><body>{{walletName}}</body></html>');
        } else {
          _readTemplateFile_old.call(emailService, language, filename, cb);
        }
      };
      helpers.stubUtxos(server, wallet, [1, 1], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, TestData.copayers[0].privKey_1H_0, {
          message: 'some message'
        });
        server.createTxLegacy(txOpts, function(err, tx) {
          should.not.exist(err);
          setTimeout(function() {
            var calls = mailerStub.sendMail.getCalls();
            calls.length.should.equal(2);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer2@domain.com', 'copayer3@domain.com'], _.pluck(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment proposal');
            one.text.should.contain(wallet.name);
            one.text.should.contain(wallet.copayers[0].name);
            should.exist(one.html);
            one.html.indexOf('<html>').should.equal(0);
            one.html.should.contain(wallet.name);
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              emailService._readTemplateFile = _readTemplateFile_old;
              done();
            });
          }, 100);
        });
      });
    });

    it('should not send email if unable to apply template to notification', function(done) {
      var _applyTemplate_old = emailService._applyTemplate;
      emailService._applyTemplate = function(template, data, cb) {
        _applyTemplate_old.call(emailService, template, undefined, cb);
      };
      helpers.stubUtxos(server, wallet, [1, 1], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, TestData.copayers[0].privKey_1H_0, {
          message: 'some message'
        });
        server.createTxLegacy(txOpts, function(err, tx) {
          should.not.exist(err);
          setTimeout(function() {
            var calls = mailerStub.sendMail.getCalls();
            calls.length.should.equal(0);
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              emailService._applyTemplate = _applyTemplate_old;
              done();
            });
          }, 100);
        });
      });
    });

    it('should notify copayers a new outgoing tx has been created', function(done) {
      var _readTemplateFile_old = emailService._readTemplateFile;
      emailService._readTemplateFile = function(language, filename, cb) {
        if (_.endsWith(filename, '.html')) {
          return cb(null, '<html>{{&urlForTx}}<html>');
        } else {
          _readTemplateFile_old.call(emailService, language, filename, cb);
        }
      };
      helpers.stubUtxos(server, wallet, [1, 1], function() {
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
            async.eachSeries(_.range(2), function(i, next) {
              var copayer = TestData.copayers[i];
              helpers.getAuthServer(copayer.id44, function(server) {
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
            var calls = mailerStub.sendMail.getCalls();
            var emails = _.map(_.takeRight(calls, 3), function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], _.pluck(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('Payment sent');
            one.text.should.contain(wallet.name);
            one.text.should.contain('800,000');
            should.exist(one.html);
            one.html.should.contain('https://insight.bitpay.com/tx/' + txp.txid);
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              emailService._readTemplateFile = _readTemplateFile_old;
              done();
            });
          }, 100);
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
            var calls = mailerStub.sendMail.getCalls();
            var emails = _.map(_.takeRight(calls, 2), function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com'], _.pluck(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('Payment proposal rejected');
            one.text.should.contain(wallet.name);
            one.text.should.contain('copayer 2, copayer 3');
            one.text.should.not.contain('copayer 1');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              done();
            });
          }, 100);
        });
      });
    });

    it('should notify copayers of incoming txs', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, function(err) {
          setTimeout(function() {
            var calls = mailerStub.sendMail.getCalls();
            calls.length.should.equal(3);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], _.pluck(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment received');
            one.text.should.contain(wallet.name);
            one.text.should.contain('123,000');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              done();
            });
          }, 100);
        });
      });
    });

    it('should notify each email address only once', function(done) {
      // Set same email address for copayer1 and copayer2
      server.savePreferences({
        email: 'copayer2@domain.com',
      }, function(err) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, function(err) {
            setTimeout(function() {
              var calls = mailerStub.sendMail.getCalls();
              calls.length.should.equal(2);
              var emails = _.map(calls, function(c) {
                return c.args[0];
              });
              _.difference(['copayer2@domain.com', 'copayer3@domain.com'], _.pluck(emails, 'to')).should.be.empty;
              var one = emails[0];
              one.from.should.equal('bws@dummy.net');
              one.subject.should.contain('New payment received');
              one.text.should.contain(wallet.name);
              one.text.should.contain('123,000');
              server.storage.fetchUnsentEmails(function(err, unsent) {
                should.not.exist(err);
                unsent.should.be.empty;
                done();
              });
            }, 100);
          });
        });
      });
    });

    it('should build each email using preferences of the copayers', function(done) {
      // Set same email address for copayer1 and copayer2
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
          }, function(err) {
            setTimeout(function() {
              var calls = mailerStub.sendMail.getCalls();
              calls.length.should.equal(3);
              var emails = _.map(calls, function(c) {
                return c.args[0];
              });
              var spanish = _.find(emails, {
                to: 'copayer1@domain.com'
              });
              spanish.from.should.equal('bws@dummy.net');
              spanish.subject.should.contain('Nuevo pago recibido');
              spanish.text.should.contain(wallet.name);
              spanish.text.should.contain('0.123 BTC');
              var english = _.find(emails, {
                to: 'copayer2@domain.com'
              });
              english.from.should.equal('bws@dummy.net');
              english.subject.should.contain('New payment received');
              english.text.should.contain(wallet.name);
              english.text.should.contain('123,000 bits');
              done();
            }, 100);
          });
        });
      });
    });

    it('should support multiple emailservice instances running concurrently', function(done) {
      var emailService2 = new EmailService();
      emailService2.start({
        lock: emailService.lock, // Use same locker service
        messageBroker: server.messageBroker,
        storage: helpers.getStorage(),
        mailer: mailerStub,
        emailOpts: {
          from: 'bws2@dummy.net',
          subjectPrefix: '[test wallet 2]',
        },
      }, function(err) {
        helpers.stubUtxos(server, wallet, 1, function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, TestData.copayers[0].privKey_1H_0, {
            message: 'some message'
          });
          server.createTxLegacy(txOpts, function(err, tx) {
            should.not.exist(err);
            setTimeout(function() {
              var calls = mailerStub.sendMail.getCalls();
              calls.length.should.equal(2);
              server.storage.fetchUnsentEmails(function(err, unsent) {
                should.not.exist(err);
                unsent.should.be.empty;
                done();
              });
            }, 100);
          });
        });
      });
    });
  });

  describe('1-of-N wallet', function() {
    beforeEach(function(done) {
      helpers.beforeEach(function(res) {
        helpers.createAndJoinWallet(1, 2, function(s, w) {
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

            mailerStub = sinon.stub();
            mailerStub.sendMail = sinon.stub();
            mailerStub.sendMail.yields();

            emailService = new EmailService();
            emailService.start({
              lockOpts: {},
              messageBroker: server.messageBroker,
              storage: helpers.getStorage(),
              mailer: mailerStub,
              emailOpts: {
                from: 'bws@dummy.net',
                subjectPrefix: '[test wallet]',
                publicTxUrlTemplate: {
                  livenet: 'https://insight.bitpay.com/tx/{{txid}}',
                  testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
                },
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });

      it('should NOT notify copayers a new tx proposal has been created', function(done) {
        helpers.stubUtxos(server, wallet, [1, 1], function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, TestData.copayers[0].privKey_1H_0, {
            message: 'some message'
          });
          server.createTxLegacy(txOpts, function(err, tx) {
            should.not.exist(err);
            setTimeout(function() {
              var calls = mailerStub.sendMail.getCalls();
              calls.length.should.equal(0);
              done();
            }, 100);
          });
        });
      });
    });
  });
});
