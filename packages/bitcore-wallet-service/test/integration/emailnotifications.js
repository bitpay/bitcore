'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
const { logger, transport } = require('../../ts_build/lib/logger.js');
transport.level= 'error';

var WalletService = require('../../ts_build/lib/server');
var EmailService = require('../../ts_build/lib/emailservice');

var TestData = require('../testdata');
var helpers = require('./helpers');

describe('Email notifications', function() {
  this.timeout(5000);
  var storage, server, wallet, mailerStub, emailService;

  before(function(done) {
    helpers.before((res) => {
      storage = res.storage;
      done();
    });
  });
  after(function(done) {
    helpers.after(done);
  });

  beforeEach(function(done) {
    helpers.beforeEach(function(res) {
      done();
    });
  });
 
  describe('Shared wallet', function() {
    beforeEach(function(done) {
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
            mailerStub.send = sinon.stub();
            mailerStub.send.returns(Promise.resolve('ok'));
            //mailerStub.returns(Promise.reject('err'));

            emailService = new EmailService();
            emailService.start({
              lockOpts: {},
              messageBroker: server.messageBroker,
              storage: storage,
              mailer: mailerStub,
              emailOpts: {
                from: 'bws@dummy.net',
                subjectPrefix: '[test wallet]',
                publicTxUrlTemplate: {
                  btc: {
                    livenet: 'https://insight.bitpay.com/tx/{{txid}}',
                    testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
                  },
                  bch: {
                    livenet: 'https://bch-insight.bitpay.com/#/tx/{{txid}}',
                    testnet: 'https://test-bch-insight.bitpay.com/#/tx/{{txid}}',
                  }
                },
              },
            }, function(err) {
              should.not.exist(err);
              done();
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
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.8e8
          }],
          feePerKb: 100e2
        };

        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {

          setTimeout(function() {
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(2);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer2@domain.com', 'copayer3@domain.com'], _.map(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment proposal');
            should.exist(one.html);
            one.html.indexOf('<html>').should.equal(0);
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
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.8e8
          }],
          feePerKb: 100e2
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
          setTimeout(function() {
            var calls = mailerStub.send.getCalls();
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
            async.eachSeries(_.range(2), function(i, next) {
              var copayer = TestData.copayers[i];
              helpers.getAuthServer(copayer.id44btc, function(server) {
                var signatures = helpers.clientSign(txp, copayer.xPrivKey_44H_0H_0H);
                server.signTx({
                  txProposalId: txp.id,
                  signatures: signatures,
                }, function(err, t) {
                  should.not.exist(err, "Error signing ");
                  txp = t;
                  next();
                });
              });
            }, next);
          },
          function(next) {
            helpers.stubBroadcast(txp.txid);
            setTimeout(() => {
            server.broadcastTx({
              txProposalId: txp.id,
            }, next);
            }, 100);
          },
        ], function(err) {
          should.not.exist(err);

          setTimeout(function() {
            var calls = mailerStub.send.getCalls();
            var emails = _.map(_.takeRight(calls, 3), function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], _.map(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('Payment sent');
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
            var calls = mailerStub.send.getCalls();
            var emails = _.map(_.takeRight(calls, 2), function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com'], _.map(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('Payment proposal rejected');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              done();
            });
          }, 100);
        });
      });
    });


    it('should handle small incomming payments (btc)', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 13000,
        }, function(err) {
          setTimeout(function() {
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(3);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], _.map(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment received');
            one.text.should.contain('130 bits');
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
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(3);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], _.map(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment received');
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
              var calls = mailerStub.send.getCalls();
              calls.length.should.equal(1);
              var email = calls[0].args[0];
              email.to.should.equal('copayer1@domain.com');
              email.from.should.equal('bws@dummy.net');
              email.subject.should.contain('Transaction confirmed');
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
              var calls = mailerStub.send.getCalls();
              calls.length.should.equal(2);
              var emails = _.map(calls, function(c) {
                return c.args[0];
              });
              _.difference(['copayer2@domain.com', 'copayer3@domain.com'], _.map(emails, 'to')).should.be.empty;
              var one = emails[0];
              one.from.should.equal('bws@dummy.net');
              one.subject.should.contain('New payment received');
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
              var calls = mailerStub.send.getCalls();
              calls.length.should.equal(3);
              var emails = _.map(calls, function(c) {
                return c.args[0];
              });
              var spanish = _.find(emails, {
                to: 'copayer1@domain.com'
              });
              spanish.from.should.equal('bws@dummy.net');
              spanish.subject.should.contain('Nuevo pago recibido');
              spanish.text.should.contain('0.123 BTC');
              var english = _.find(emails, {
                to: 'copayer2@domain.com'
              });
              english.from.should.equal('bws@dummy.net');
              english.subject.should.contain('New payment received');
              english.text.should.contain('123,000 bits');
              done();
            }, 200);
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
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.8e8
            }],
            feePerKb: 100e2
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
            setTimeout(function() {
              var calls = mailerStub.send.getCalls();
              calls.length.should.equal(2);
              server.storage.fetchUnsentEmails(function(err, unsent) {
                should.not.exist(err);
                unsent.should.be.empty;
                done();
              });

              // enought time to BOTH email services to process the notification
            }, 200);
          });
        });
      });
    });

    it('should handler mailer errors ', function(done) {
      mailerStub.send.rejects('err');
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, function(err) {
          setTimeout(function() {
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(3);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], _.map(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment received');
            one.text.should.contain('123,000');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.length.should.equal(3);
              unsent[0].from.should.equal('bws@dummy.net');
              unsent[1].from.should.equal('bws@dummy.net');
              unsent[2].from.should.equal('bws@dummy.net');
              done();
            });
          }, 100);
        });
      });
    });



  });

  describe('1-of-N wallet', function() {
    beforeEach(function(done) {
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
            mailerStub.send = sinon.stub();
            mailerStub.send.resolves('ok');

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
                  btc: {
                    livenet: 'https://insight.bitpay.com/tx/{{txid}}',
                    testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
                  },
                  bch: {
                    livenet: 'https://bch-insight.bitpay.com/#/tx/{{txid}}',
                    testnet: 'https://test-bch-insight.bitpay.com/#/tx/{{txid}}',
                  }
                },
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
      });

      it('should NOT notify copayers a new tx proposal has been created', function(done) {
        helpers.stubUtxos(server, wallet, [1, 1], function() {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.8e8
            }],
            feePerKb: 100e2
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
            setTimeout(function() {
              var calls = mailerStub.send.getCalls();
              calls.length.should.equal(0);
              done();
            }, 100);
          });
        });
      });
    });
  });

  describe('1-1 wallet', function() {
    beforeEach(function(done) {
        helpers.createAndJoinWallet(1, 1,  {coin:'bch'}, function(s, w) {
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
            mailerStub.send = sinon.stub();
            mailerStub.send.returns(Promise.resolve('ok'));
            //mailerStub.returns(Promise.reject('err'));

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
                  btc: {
                    livenet: 'https://insight.bitpay.com/tx/{{txid}}',
                    testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
                  },
                  bch: {
                    livenet: 'https://bch-insight.bitpay.com/#/tx/{{txid}}',
                    testnet: 'https://test-bch-insight.bitpay.com/#/tx/{{txid}}',
                  }
                },
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
      });
    });



    it('should handle small incomming payments (bch)', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 221340,
        }, function(err) {
          setTimeout(function() {
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(1);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com'], _.map(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment received');
            one.text.should.contain('0.002213 BCH');
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
