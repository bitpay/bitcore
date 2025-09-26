'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import sinon from 'sinon';
import { transport } from '../../src/lib/logger';
import { EmailService } from '../../src/lib/emailservice';
import { Common } from '../../src/lib/common';
import * as TestData from '../testdata';
import helpers from './helpers';


const should = chai.should();
transport.level = 'error';
const { Utils } = Common;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const TOKENS = [
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  '0x8E870D67F660D95d5be530380D0eC0bd388289E1'
];
const CUSTOM_TOKENS = [
  '0x0d8775f648430679a709e98d2b0cb6250d2887ef'
];

describe('Email notifications', function() {
  this.timeout(5000);
  let storage;
  let server;
  let wallet;
  let mailerStub;
  let getTokenDataStub;
  let emailService;

  function sendEmailInterceptor(testCallback) { 
    // Intercept the msg handler so we can run test assersions on callback
    const sendEmailIdx = emailService.messageBroker._events.msg.findIndex(fn => fn.name === 'bound sendEmail');
    const sendEmail = emailService.messageBroker._events.msg[sendEmailIdx]; // original function
    emailService.messageBroker._events.msg[sendEmailIdx] = sinon.stub().callsFake(function(notification, cb) {
      sendEmail(notification, function(err) {
        cb && cb(err);
        testCallback();
      });
    });
  };

  before(async function() {
    const res = await helpers.before();
    storage = res.storage;
  });

  after(async function() {
    await helpers.after();
  });

  beforeEach(async function() {
    await helpers.beforeEach();
  });

  afterEach(function() {
    sinon.restore();
  });
 
  describe('Shared wallet', function() {
    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));

      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await util.promisify(s.savePreferences).call(s, {
          email: 'copayer' + (i + 1) + '@domain.com',
          unit: 'bit',
        });
      }

      mailerStub = sinon.stub();
      mailerStub.send = sinon.stub();
      mailerStub.send.returns(Promise.resolve('ok'));
      //mailerStub.returns(Promise.reject('err'));

      emailService = new EmailService();
      await util.promisify(emailService.start).call(emailService, {
        lockOpts: {},
        messageBroker: server.messageBroker,
        storage: storage,
        mailer: mailerStub,
        emailOpts: {
          mailer: 'sendgrid',
          sendGridApiKey: 'asdf',
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
      });
      emailService.mailer = mailerStub;
      emailService.sendMail = mailerStub.send;
    });

    it('should notify copayers a new tx proposal has been created', async function() {
      const _readTemplateFile_old = emailService._readTemplateFile;
      emailService._readTemplateFile = function(language, filename, cb) {
        if (filename.endsWith('.html')) {
          return cb(null, '<html><body>{{walletName}}</body></html>');
        } else {
          _readTemplateFile_old.call(emailService, language, filename, cb);
        }
      };

      await helpers.stubUtxos(server, wallet, [1, 1]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.8e8
        }],
        feePerKb: 100e2
      };

      await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);

      await sleep(100); // TODO refactor to avoid timeouts
      var calls = mailerStub.send.getCalls();
      calls.length.should.equal(2);
      var emails = calls.map(c => c.args[0]);
      Utils.difference(['copayer2@domain.com', 'copayer3@domain.com'], emails.map(e => e.to)).should.be.empty;
      var one = emails[0];
      one.from.should.equal('bws@dummy.net');
      one.subject.should.contain('New payment proposal');
      should.exist(one.html);
      one.html.indexOf('<!DOCTYPE html').should.equal(0);
      const unsent = await util.promisify(server.storage.fetchUnsentEmails).call(server.storage);
      unsent.should.be.empty;
      emailService._readTemplateFile = _readTemplateFile_old;
    });

    it('should not send email if unable to apply template to notification', async function() {
      const _applyTemplate_old = emailService._applyTemplate;
      emailService._applyTemplate = function(template, data, cb) {
        _applyTemplate_old.call(emailService, template, undefined, cb);
      };
      await helpers.stubUtxos(server, wallet, [1, 1]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.8e8
        }],
        feePerKb: 100e2
      };
      const txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      await sleep(100); // TODO refactor to avoid timeouts
      const calls = mailerStub.send.getCalls();
      calls.length.should.equal(0);
      const unsent = await util.promisify(server.storage.fetchUnsentEmails).call(server.storage);
      unsent.should.be.empty;
      emailService._applyTemplate = _applyTemplate_old;
    });

    it('should notify copayers a new outgoing tx has been created', async function() {
      const _readTemplateFile_old = emailService._readTemplateFile;
      emailService._readTemplateFile = function(language, filename, cb) {
        if (filename.endsWith('.html')) {
          return cb(null, '<html>{{&urlForTx}}<html>');
        } else {
          _readTemplateFile_old.call(emailService, language, filename, cb);
        }
      };
      await helpers.stubUtxos(server, wallet, [1, 1]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.8e8
        }],
        feePerKb: 100e2
      };

      let txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      for (let i = 0; i < 2; i++) {
        const copayer = TestData.copayers[i];
        const s = await helpers.getAuthServer(copayer.id44btc);
        const signatures = helpers.clientSign(txp, copayer.xPrivKey_44H_0H_0H);
        txp = await util.promisify(s.signTx).call(s, {
          txProposalId: txp.id,
          signatures: signatures,
        });
      }
      helpers.stubBroadcast(txp.txid);
      await sleep(100); // TODO refactor to avoid timeouts
      await util.promisify(server.broadcastTx).call(server, {
        txProposalId: txp.id,
      });
      await sleep(100); // TODO refactor to avoid timeouts
      const calls = mailerStub.send.getCalls();
      const emails = calls.slice(-3).map(c => c.args[0]);
      Utils.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], emails.map(e => e.to)).should.be.empty;
      const one = emails[0];
      one.from.should.equal('bws@dummy.net');
      one.subject.should.contain('Payment sent');
      one.text.should.contain('800,000');
      should.exist(one.html);
      one.html.should.contain('https://insight.bitpay.com/tx/' + txp.txid);
      const unsent = await util.promisify(server.storage.fetchUnsentEmails).call(server.storage);
      unsent.should.be.empty;
      emailService._readTemplateFile = _readTemplateFile_old;
    });

    it('should notify copayers a tx has been finally rejected', async function() {
      await helpers.stubUtxos(server, wallet, 1);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.8e8
        }],
        feePerKb: 100e2
      };

      const txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      const txpId = txp.id;
      for (let i = 1; i <= 2; i++) {
        const copayer = TestData.copayers[i];
        const s = await helpers.getAuthServer(copayer.id44btc);
        await util.promisify(s.rejectTx).call(s, {
          txProposalId: txp.id,
        });
      }
      await sleep(100); // TODO refactor to avoid timeouts
      const calls = mailerStub.send.getCalls();
      const emails = calls.slice(-2).map(c => c.args[0]);
      Utils.difference(['copayer1@domain.com', 'copayer2@domain.com'], emails.map(e => e.to)).should.be.empty;
      const one = emails[0];
      one.from.should.equal('bws@dummy.net');
      one.subject.should.contain('Payment proposal rejected');
      const unsent = await util.promisify(server.storage.fetchUnsentEmails).call(server.storage);
      unsent.should.be.empty;
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
            const calls = mailerStub.send.getCalls();
            calls.length.should.equal(3);
            const emails = calls.map(c => c.args[0]);
            Utils.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], emails.map(e => e.to)).should.be.empty;
            const one = emails[0];
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

        sendEmailInterceptor(function() {
          var calls = mailerStub.send.getCalls();
          calls.length.should.equal(3);
          var emails = calls.map(c => c.args[0]);
          Utils.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], emails.map(e => e.to)).should.be.empty;
          var one = emails[0];
          one.from.should.equal('bws@dummy.net');
          one.subject.should.contain('New payment received');
          one.text.should.contain('123,000');
          server.storage.fetchUnsentEmails(function(err, unsent) {
            should.not.exist(err);
            unsent.should.be.empty;
            done();
          });
        });

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, function(err) {
          should.not.exist(err);
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

          // Intercept the msg handler so we can run test assersions on callback
          sendEmailInterceptor(function() {
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
          });

          // Simulate tx confirmation notification
          server._notify('TxConfirmation', {
            txid: '123',
          }, function(err) {
            should.not.exist(err);
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

          sendEmailInterceptor(function() {
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(2);
            var emails = calls.map(c => c.args[0]);
            Utils.difference(['copayer2@domain.com', 'copayer3@domain.com'], emails.map(e => e.to)).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment received');
            one.text.should.contain('123,000');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              done();
            });
          });

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, function(err) {
            should.not.exist(err);
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

          // Intercept the msg handler so we can run test assersions on callback
          sendEmailInterceptor(function() {
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(3);
            var emails = calls.map(c => c.args[0]);
            var spanish = emails.find(email => email.to === 'copayer1@domain.com');
            spanish.from.should.equal('bws@dummy.net');
            spanish.subject.should.contain('Nuevo pago recibido');
            spanish.text.should.contain('0.123 BTC');
            var english = emails.find(email => email.to === 'copayer2@domain.com');
            english.from.should.equal('bws@dummy.net');
            english.subject.should.contain('New payment received');
            english.text.should.contain('123,000 bits');
            done();
          });

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, function(err) {
            should.not.exist(err);
          });
        });
      });
    });

    it('should support multiple emailservice instances running concurrently', function(done) {
      const emailService2 = new EmailService();
      emailService2.start({
        lock: emailService.lock, // Use same locker service
        messageBroker: server.messageBroker,
        storage: helpers.getStorage(),
        mailer: mailerStub,
        emailOpts: {
          mailer: 'nodemailer',
          from: 'bws2@dummy.net',
          subjectPrefix: '[test wallet 2]',
        },
      }, function(err) {
        emailService2.mailer = mailerStub;
        emailService2.sendMail = mailerStub.send;
        helpers.stubUtxos(server, wallet, 1).then(() => {
          var txOpts = {
            outputs: [{
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: 0.8e8
            }],
            feePerKb: 100e2
          };
          helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then((tx) => {
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

        // Intercept the msg handler so we can run test assersions on callback
        sendEmailInterceptor(function() {
          var calls = mailerStub.send.getCalls();
          calls.length.should.equal(3);
          var emails = calls.map(c => c.args[0]);
          Utils.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], emails.map(e => e.to)).should.be.empty;
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
        });

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, function(err) {
          should.not.exist(err);
        });
      });
    });
  });

  describe('1-of-N wallet', function() {
    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 2));

      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await util.promisify(s.savePreferences).call(s, {
          email: 'copayer' + (i + 1) + '@domain.com',
          unit: 'bit',
        });
      }

      mailerStub = sinon.stub();
      mailerStub.send = sinon.stub();
      mailerStub.send.resolves('ok');

      emailService = new EmailService();
      await util.promisify(emailService.start).call(emailService, {
        lockOpts: {},
        messageBroker: server.messageBroker,
        storage: helpers.getStorage(),
        mailer: mailerStub,
        emailOpts: {
          mailer: 'sendgrid',
          sendGridApiKey: 'asdf',
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
      });
      emailService.mailer = mailerStub;
      emailService.sendMail = mailerStub.send;
    });

    it('should NOT notify copayers a new tx proposal has been created', async function() {
      await helpers.stubUtxos(server, wallet, [1, 1]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.8e8
        }],
        feePerKb: 100e2
      };
      await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      await sleep(100); // TODO refactor to avoid timeouts
      const calls = mailerStub.send.getCalls();
      calls.length.should.equal(0);
    });
  });

  describe('1-1 wallet', function() {
    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1,  { coin:'bch' }));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await util.promisify(s.savePreferences).call(s, {
          email: 'copayer' + (i + 1) + '@domain.com',
          unit: 'bit',
        });
      }

      mailerStub = sinon.stub();
      mailerStub.send = sinon.stub();
      mailerStub.send.returns(Promise.resolve('ok'));
      //mailerStub.returns(Promise.reject('err'));

      emailService = new EmailService();
      await util.promisify(emailService.start).call(emailService, {
        lockOpts: {},
        messageBroker: server.messageBroker,
        storage: helpers.getStorage(),
        mailer: mailerStub,
        emailOpts: {
          mailer: 'sendgrid',
          sendGridApiKey: 'asdf',
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
      });
      emailService.mailer = mailerStub;
      emailService.sendMail = mailerStub.send;
    });

    it('should handle small incomming payments (bch)', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Intercept the msg handler so we can run test assersions on callback
        sendEmailInterceptor(function() {
          var calls = mailerStub.send.getCalls();
          calls.length.should.equal(1);
          var emails = calls.map(c => c.args[0]);
          Utils.difference(['copayer1@domain.com'], emails.map(e => e.to)).should.be.empty;
          var one = emails[0];
          one.from.should.equal('bws@dummy.net');
          one.subject.should.contain('New payment received');
          one.text.should.contain('0.002213 BCH');
          server.storage.fetchUnsentEmails(function(err, unsent) {
            should.not.exist(err);
            unsent.should.be.empty;
            done();
          });
        });

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 221340,
        }, function(err) {
          should.not.exist(err);
        });
      });
    });
  });

  describe('custom ERC20 wallet', () => {
    beforeEach(async () => {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1,  {coin:'eth'}));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await util.promisify(s.savePreferences).call(s, {
          email: 'copayer' + (i + 1) + '@domain.com',
          unit: 'bit',
        });
      }
      
      mailerStub = sinon.stub();
      mailerStub.send = sinon.stub();
      mailerStub.send.returns(Promise.resolve('ok'));
      //mailerStub.returns(Promise.reject('err'));

      emailService = new EmailService();
      getTokenDataStub = sinon.stub(emailService, 'getTokenData').callsFake(() => TestData.CoinGecko_ETH_Tokens.tokens);
      await util.promisify(emailService.start).call(emailService, {
        lockOpts: {},
        messageBroker: server.messageBroker,
        storage: helpers.getStorage(),
        mailer: mailerStub,
        emailOpts: {
          mailer: 'sendgrid',
          sendGridApiKey: 'asdf',
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
            },
            eth: {
              livenet: 'https://etherscan.io/tx/{{txid}}',
              testnet: 'https://kovan.etherscan.io/tx/{{txid}}',
            },
          },
        },
      });
      emailService.mailer = mailerStub;
      emailService.sendMail = mailerStub.send;
    });

    it('should send notification if the tx is custom token', (done) => {
        server.createAddress({}, (err, address) => {
          should.not.exist(err);

          // Intercept the msg handler so we can run test assersions on callback
          sendEmailInterceptor(function() {
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(1);
            var emails = calls.map(c => c.args[0]);
            Utils.difference(['copayer1@domain.com'], emails.map(e => e.to)).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment received');
            one.text.should.contain('4.00 BAT');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              done();
            });
          });

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 4e18,
            tokenAddress: CUSTOM_TOKENS[0]
          }, {
            isGlobal: true
          }, (err) => {
            should.not.exist(err);
          });
        });
    });
  });

  describe('ERC20 wallet', () => {
    beforeEach(async () => {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1,  {coin:'eth'}));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await util.promisify(s.savePreferences).call(s, {
          email: 'copayer' + (i + 1) + '@domain.com',
          unit: 'bit',
        });
      }
      
      mailerStub = sinon.stub();
      mailerStub.send = sinon.stub();
      mailerStub.send.returns(Promise.resolve('ok'));
      //mailerStub.returns(Promise.reject('err'));

      emailService = new EmailService();
      await util.promisify(emailService.start).call(emailService, {
        lockOpts: {},
        messageBroker: server.messageBroker,
        storage: helpers.getStorage(),
        mailer: mailerStub,
        emailOpts: {
          mailer: 'sendgrid',
          sendGridApiKey: 'asdf',
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
            },
            eth: {
              livenet: 'https://etherscan.io/tx/{{txid}}',
              testnet: 'https://kovan.etherscan.io/tx/{{txid}}',
            },
          },
        },
      });
      emailService.mailer = mailerStub;
      emailService.sendMail = mailerStub.send;
    });

    it('should send notification if the tx is USDC', (done) => {
      server.createAddress({}, (err, address) => {
        should.not.exist(err);

        // Intercept the msg handler so we can run test assersions on callback
        sendEmailInterceptor(function() {
          var calls = mailerStub.send.getCalls();
          calls.length.should.equal(1);
          var emails = calls.map(c => c.args[0]);
          Utils.difference(['copayer1@domain.com'], emails.map(e => e.to)).should.be.empty;
          var one = emails[0];
          one.from.should.equal('bws@dummy.net');
          one.subject.should.contain('New payment received');
          one.text.should.contain('4.00 USDC');
          server.storage.fetchUnsentEmails(function(err, unsent) {
            should.not.exist(err);
            unsent.should.be.empty;
            done();
          });
        });

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '997',
          address: address,
          amount: 4e6, // ~ 4.00 USD
          tokenAddress: TOKENS[0]
        }, {
          isGlobal: true
        }, (err) => {
          should.not.exist(err);
        });
      });
    });
     
    it('should send notification if the tx is USDP', (done) => {
      server.createAddress({}, (err, address) => {
        should.not.exist(err);

        // Intercept the msg handler so we can run test assersions on callback
        sendEmailInterceptor(function() {
          var calls = mailerStub.send.getCalls();
          calls.length.should.equal(1);
          var emails = calls.map(c => c.args[0]);
          Utils.difference(['copayer1@domain.com'], emails.map(e => e.to)).should.be.empty;
          var one = emails[0];
          one.from.should.equal('bws@dummy.net');
          one.subject.should.contain('New payment received');
          one.text.should.contain('4.00 USDP');
          server.storage.fetchUnsentEmails(function(err, unsent) {
            should.not.exist(err);
            unsent.should.be.empty;
            done();
          });
        });

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '997',
          address: address,
          amount: 4e18, // ~ 4.00 USD
          tokenAddress: TOKENS[1]
        }, {
          isGlobal: true
        }, (err) => {
          should.not.exist(err);
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

          // Intercept the msg handler so we can run test assersions on callback
          sendEmailInterceptor(function() {
            var calls = mailerStub.send.getCalls();
            calls.length.should.equal(0);
            done();
          });
          
          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 1230000000,
            tokenAddress: 'notSupportedTokenAddress'
          }, {
            isGlobal: true
          }, (err) => {
            should.not.exist(err);
          });
        });
      });
    });
  });

});
