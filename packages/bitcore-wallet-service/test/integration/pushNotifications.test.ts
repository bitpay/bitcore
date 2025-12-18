'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import sinon from 'sinon';
import log from 'npmlog';
import sjcl from 'sjcl';
import { WalletService } from '../../src/lib/server';
import { PushNotificationsService } from '../../src/lib/pushnotificationsservice';
import { Storage } from '../../src/lib/storage';
import { ObjectID } from 'mongodb';
import * as TestData from '../testdata';
import helpers from './helpers';
import { Common } from '../../src/lib/common';

log.debug = log.verbose;
log.level = 'info';
const should = chai.should();
const { Utils } = Common;

const TOKENS = [
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  '0x8E870D67F660D95d5be530380D0eC0bd388289E1',
  '0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd',
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
];
const CUSTOM_TOKENS = ['0x0d8775f648430679a709e98d2b0cb6250d2887ef'];

describe('Push notifications', function() {
  this.timeout(5000);
  let server;
  let wallet;
  let requestStub;
  let getTokenDataStub;
  let pushNotificationsService;
  let walletId;

  before(async function() {
    await helpers.before();
  });


  after(async function() {
    await helpers.after();
  });

  describe('Single wallet', function() {
    beforeEach(async function() {
      await helpers.beforeEach();
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1));

      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await Promise.all([
          util.promisify(s.savePreferences).call(s, {
            email: 'copayer' + (i + 1) + '@domain.com',
            language: 'en',
            unit: 'bit',
          }),
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: '1234',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          })
        ]);
      }
      requestStub = sinon.stub();
      requestStub.yields();

      pushNotificationsService = new PushNotificationsService();
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
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
              const calls = requestStub.getCalls();
              const args = calls.map(c => c.args[0]);
              calls.length.should.equal(2); // NewAddress, NewIncomingTx
              should.not.exist(args[0].body.notification);
              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.body.should.contain('123,000');
              args[1].body.notification.body.should.contain('bits');
              done();
            }, 100);
          });
        });
      });
    });

    it('should notify auto-payments to creator', function(done) {
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
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // NewAdress, NewIncomingTx
            should.not.exist(args[0].body.notification);
            done();
          }, 100);
        });
      });
    });

    it('should show the correct template for zero amount outgoin transactions', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate zero amount outgoing tx notification
        // ETH interaction with a contract
        server._notify('NewOutgoingTx', {
          txid: '999',
          address: address,
          amount: 0,
        }, {
          isGlobal: false
        }, function(err) {
          setTimeout(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // NewOutgoingTx

            args[1].body.notification.title.should.contain('Payment sent');
            args[1].body.notification.body.should.contain('A Payment has been sent from your wallet.');

            should.not.exist(args[0].body.notification);
            done();
          }, 100);
        });
      });
    });

    it('should show the correct template for non zero amount outgoing transactions', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        server._notify('NewOutgoingTx', {
          txid: '999',
          address: address,
          amount: 12345
        }, {
          isGlobal: false
        }, function(err) {
          setTimeout(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // NewOutgoingTx

            args[1].body.notification.title.should.contain('Payment sent');
            args[1].body.notification.body.should.contain('A Payment of 123 bits has been sent from your wallet');

            should.not.exist(args[0].body.notification);
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
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // NewAdress, NewIncomingTx
            should.not.exist(args[0].body.notification);
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
              const calls = requestStub.getCalls();
              const args = calls.map(c => c.args[0]);
              calls.length.should.equal(2); // NewAdress, TxConfirmation
              should.not.exist(args[0].body.notification);
              done();
            }, 100);
          });
        });
      });
    });

    it('should notify creator when txp is accepted by himself and the app is open', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate txp accepted by creator
        server._notify('TxProposalAcceptedBy', {
          txid: '123'
        }, {
          isGlobal: true
        }, function(err) {
          setTimeout(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // NewAdress, TxProposalAcceptedBy
            should.not.exist(args[0].body.notification);
            should.exist(args[0].body.data);
            should.not.exist(args[1].body.notification);
            should.exist(args[1].body.data);
            done();
          }, 100);
        });
      });
    });

    it('should notify creator when txp is finally accepeted by himself and the app is open', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate txp accepted by creator
        server._notify('TxProposalFinallyAccepted', {
          txid: '123'
        }, {
          isGlobal: true
        }, function(err) {
          setTimeout(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // NewAdress, TxProposalFinallyAccepted
            should.not.exist(args[0].body.notification);
            should.exist(args[0].body.data);
            should.not.exist(args[1].body.notification);
            should.exist(args[1].body.data);
            done();
          }, 100);
        });
      });
    });

    it('should notify creator when txp is rejected by himself and the app is open', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate txp rejected by creator
        server._notify('TxProposalRejectedBy', {
          txid: '1234'
        }, {
          isGlobal: true
        }, function(err) {
          setTimeout(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // NewAdress, TxProposalRejectedBy
            should.not.exist(args[0].body.notification);
            should.exist(args[0].body.data);
            should.not.exist(args[1].body.notification);
            should.exist(args[1].body.data);
            done();
          }, 100);
        });
      });
    });

    it('should notify creator when txp is removed and the app is open', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate txp removed
        server._notify('TxProposalRemoved', {
          txid: '1234'
        }, {
          isGlobal: true
        }, function(err) {
          setTimeout(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // NewAdress, TxProposalRemoved
            should.not.exist(args[0].body.notification);
            should.exist(args[0].body.data);
            should.not.exist(args[1].body.notification);
            should.exist(args[1].body.data);
            done();
          }, 100);
        });
      });

      it('should use different template for new incoming tx if network is testnet', function(done) {
        server.createAddress({}, (err, address) => {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
            network: 'testnet3'
          }, (err) => {
            should.not.exist(err);

            setTimeout(function() {
              const calls = requestStub.getCalls();
              calls.length.should.equal(2);
              const args = calls.map(c => c.args[0]);
              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.body.should.contain('TESTNET');
              done();
            }, 100);
          });
        });
      });
    });
  });

  describe('Shared wallet', function() {
    beforeEach(async function() {
      await helpers.beforeEach();
      ({ wallet, server } = await helpers.createAndJoinWallet(2, 3));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await Promise.all([
          util.promisify(s.savePreferences).call(s, {
            email: 'copayer' + (i + 1) + '@domain.com',
            language: 'en',
            unit: 'bit'
          }),
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: '1234',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          })
        ]);
      }
            
      requestStub = sinon.stub();
      requestStub.yields();

      pushNotificationsService = new PushNotificationsService();
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
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
              const calls = requestStub.getCalls();
              const args = calls.map(c => c.args[0]);

              calls.length.should.equal(6);

              args[3].body.notification.title.should.contain('Nuevo pago recibido');
              args[3].body.notification.body.should.contain('0.123');

              args[4].body.notification.title.should.contain('New payment received');
              args[4].body.notification.body.should.contain('123,000');

              args[5].body.notification.title.should.contain('New payment received');
              args[5].body.notification.body.should.contain('123,000');
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
            const calls = requestStub.getCalls();
            calls.length.should.equal(6);

            done();
          }, 100);
        });
      });
    });

    it('should notify auto-payments to creator', function(done) {
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
            const calls = requestStub.getCalls();
            calls.length.should.equal(6);

            done();
          }, 100);
        });
      });
    });

    it('should notify copayers a new tx proposal has been created', function(done) {
      helpers.stubUtxos(server, wallet, [1, 1]).then(function() {
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
              const calls = requestStub.getCalls();
              calls.length.should.equal(8);

              done();
            }, 100);
          });
        });
      });
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
      for (let i = 1; i < 3; i++) {
        const copayer = TestData.copayers[i];
        const server = await helpers.getAuthServer(copayer.id44btc);
        await util.promisify(server.rejectTx).call(server, { txProposalId: txp.id });
      }
      await Utils.sleep(100);

      const calls = requestStub.getCalls();
      const args = calls.slice(-2).map(c => c.args[0]);

      args[0].body.notification.title.should.contain('Payment proposal rejected');
    });

    it('should notify copayers a new outgoing tx has been created', async function() {
      await helpers.stubUtxos(server, wallet, 1);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.8e8
        }],
        feePerKb: 100e2
      };

      let txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      for (let i = 1; i < 3; i++) {
        const copayer = TestData.copayers[i];
        server = await helpers.getAuthServer(copayer.id44btc);
        const signatures = helpers.clientSign(txp, copayer.xPrivKey_44H_0H_0H);
        txp = await util.promisify(server.signTx).call(server, {
          txProposalId: txp.id,
          signatures: signatures,
        });
      }

      helpers.stubBroadcast(txp.txid);
      await util.promisify(server.broadcastTx).call(server, { txProposalId: txp.id });
      await Utils.sleep(100);
      const calls = requestStub.getCalls();
      const args = calls.slice(-3).map(c => c.args[0]);
      args[0].body.notification.title.should.contain('Payment sent');
      args[1].body.notification.title.should.contain('Payment sent');
      args[2].body.notification.title.should.contain('Payment sent');

      sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(server.copayerId)).should.not.equal(args[0].body.data.copayerId);
      sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(server.copayerId)).should.not.equal(args[1].body.data.copayerId);
      sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(server.copayerId)).should.equal(args[2].body.data.copayerId);
    });
  });

  describe('joinWallet', function() {
    beforeEach(async function() {
      await helpers.beforeEach();
      server = new WalletService();
      const walletOpts = {
        name: 'my wallet',
        m: 1,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      walletId = await util.promisify(server.createWallet).call(server, walletOpts);
      should.exist(walletId);
      requestStub = sinon.stub();
      requestStub.yields();

      pushNotificationsService = new PushNotificationsService();
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
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
      });
    });

    it('should notify copayers when a new copayer just joined into your wallet except the one who joined', async function() {
      for (let i = 0; i < 3; i++) {
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'copayer ' + (i + 1),
          xPubKey: TestData.copayers[i].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[i].pubKey_1H_0,
          customData: 'custom data ' + (i + 1),
        });

        const res = await util.promisify(server.joinWallet).call(server, copayerOpts);
        const s = await helpers.getAuthServer(res.copayerId);
        await util.promisify(s.pushNotificationsSubscribe).call(s, {
          token: 'token:' + copayerOpts.name,
          packageName: 'com.wallet',
          platform: 'Android',
          walletId: '123'
        });
      }
      await Utils.sleep(100);
      const calls = requestStub.getCalls();
      const args = calls.map(c => c.args[0]).filter(arg => arg.body.notification.title === 'New copayer');

      const wallet = await util.promisify(server.getWallet).call(server, null);
      /*
        First call - copayer2 joined
        copayer2 should notify to copayer1
        copayer2 should NOT be notifyed
      */
      const hashedCopayerIds = wallet.copayers.map(c => sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(c.id)));
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
    });
  });

  describe('custom ERC20 wallet', () => {
    beforeEach(async () => {
      await helpers.beforeEach();
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await Promise.all([
          util.promisify(s.savePreferences).call(s, {
            email: 'copayer' + (i + 1) + '@domain.com',
            language: 'en',
            unit: 'bit',
            tokenAddresses: CUSTOM_TOKENS,
          }),
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: '1234',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          })
        ]);
      }
      pushNotificationsService = new PushNotificationsService();
      requestStub = sinon.stub(pushNotificationsService, '_makeRequest').callsFake(()=>{});
      requestStub.yields();
      getTokenDataStub = sinon.stub(pushNotificationsService, 'getTokenData').callsFake(() => TestData.CoinGecko_ETH_Tokens.tokens);
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
        lockOpts: {},
        messageBroker: server.messageBroker,
        storage: helpers.getStorage(),
        request: null,
        pushNotificationsOpts: {
          templatePath: 'templates',
          defaultLanguage: 'en',
          defaultUnit: 'eth',
          subjectPrefix: '',
          pushServerUrl: 'http://localhost:8000',
          authorizationKey: 'secret',
        },
      });
    });

    it('should send notification if the tx is custom token', (done) => {
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
            amount: 4e18,
            tokenAddress: CUSTOM_TOKENS[0]
          }, {
            isGlobal: true
          }, (err) => {
            Utils.sleep(1000).then(function() {
              const calls = requestStub.getCalls();
              calls.length.should.equal(2);
              const args = calls.slice(-2).map(c => c.args[0]);
              args[1].notification.title.should.contain('New payment received');
              args[1].notification.body.should.contain('4.00');
              args[1].data.tokenAddress.should.equal('0x0d8775f648430679a709e98d2b0cb6250d2887ef');
              done();
            });
          });
        });
      });
    });
  });

  describe('ERC20 wallet', () => {
    beforeEach(async () => {
      await helpers.beforeEach();
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await Promise.all([
          util.promisify(s.savePreferences).call(s, {
            email: 'copayer' + (i + 1) + '@domain.com',
            language: 'en',
            unit: 'bit',
            tokenAddresses: TOKENS,
          }),
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: '1234',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          })
        ]);
      }
       
      requestStub = sinon.stub();
      requestStub.yields();

      pushNotificationsService = new PushNotificationsService();
      getTokenDataStub = sinon.stub(pushNotificationsService, 'getTokenData').callsFake(() => TestData.CoinGecko_ETH_Tokens.tokens);
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
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
      });
    });

    it('should send notification if the tx is USDC.e', (done) => {
      server.savePreferences({
        language: 'en',
        unit: 'bit',
      }, function(err) {
        server.createAddress({}, (err, address) => {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '996',
            address: address,
            amount: 4e6, // ~ 4.00 USD
            tokenAddress: TOKENS[3]
          }, {
            isGlobal: true
          }, (err) => {
            Utils.sleep(100).then(function() {
              const calls = requestStub.getCalls();
              calls.length.should.equal(2);
              const args = calls.slice(-2).map(c => c.args[0]);
              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.body.should.contain('4.00');
              args[1].body.data.tokenAddress.should.equal('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
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
            Utils.sleep(100).then(function() {
              const calls = requestStub.getCalls();
              calls.length.should.equal(2);
              const args = calls.slice(-2).map(c => c.args[0]);
              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.body.should.contain('4.00');
              args[1].body.data.tokenAddress.should.equal('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
              done();
            });
          });
        });
      });
    });
    it('should send notification if the tx is USDP', (done) => {
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
            Utils.sleep(100).then(function() {
              const calls = requestStub.getCalls();
              calls.length.should.equal(2);
              const args = calls.slice(-2).map(c => c.args[0]);
              args[1].body.notification.title.should.contain('Nuevo pago recibido');
              args[1].body.notification.body.should.contain('4.00');
              args[1].body.data.tokenAddress.should.equal('0x8E870D67F660D95d5be530380D0eC0bd388289E1');
              done();
            });
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
            Utils.sleep(100).then(function() {
              const calls = requestStub.getCalls();
              calls.length.should.equal(2);
              const args = calls.slice(-2).map(c => c.args[0]);
              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.body.should.contain('4.00');
              args[1].body.data.tokenAddress.should.equal('0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd');
              done();
            });
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
            Utils.sleep(100).then(function() {
              const calls = requestStub.getCalls();
              calls.length.should.equal(1);
              done();
            });
          });
        });
      });
    });
  });

  describe('Any wallet', function() {
    beforeEach(async function() {
      await helpers.beforeEach();
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await Promise.all([
          util.promisify(s.savePreferences).call(s, {
            email: 'copayer' + (i + 1) + '@domain.com',
            language: 'en',
            unit: 'bit',
          }),
          // new Promise((resolve) => {
          //   s.pushNotificationsSubscribe({
          //     token: 'DEVICE_TOKEN',
          //     packageName: 'com.wallet',
          //     platform: 'Android',
          //     walletId: '123'
          //   }, s.pushNotificationsSubscribe({
          //     token: 'DEVICE_TOKEN2',
          //     packageName: 'com.my-other-wallet',
          //     platform: 'iOS',
          //     walletId: '123'
          //   }, resolve))
          // })
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: 'DEVICE_TOKEN',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          }),
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: 'DEVICE_TOKEN2',
            packageName: 'com.my-other-wallet',
            platform: 'iOS',
            walletId: '123'
          })
        ]);
      }

      requestStub = sinon.stub();
      requestStub.yields();

      pushNotificationsService = new PushNotificationsService();
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
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
      });
    });

    it('should notify NewBlock to all devices subscribed in the last 10 minutes', function(done) {
      const collections = Storage.collections;
      const oldSubscription = {
        _id: new ObjectID('5fb57ecde3de1d285042a551'),
        version: '1.0.0',
        createdOn: 1605729997,
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN3',
        packageName: 'com.my-other-wallet2',
        platform: 'any',
        walletId: '123'
      };

      server.storage.db.collection(collections.PUSH_NOTIFICATION_SUBS).insertOne(oldSubscription, function(err) {
        should.not.exist(err);

        // Simulate new block notification
        server._notify('NewBlock', {
          hash: 'dummy hash',
        }, {
          isGlobal: true
        }, function(err) {
          should.not.exist(err);
          Utils.sleep(100).then(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(2); // DEVICE_TOKEN, DEVICE_TOKEN2
            should.not.exist(args[0].body.notification);
            should.exist(args[0].body.data);
            should.not.exist(args[1].body.notification);
            should.exist(args[1].body.data);
            done();
          });
        });
      });
    });

    it('should notify only one NewBlock push notification for each device', function(done) {
      const collections = Storage.collections;
      const subs = [{
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN',
        packageName: 'com.my-other-wallet',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN2',
        packageName: 'com.my-other-wallet2',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN2',
        packageName: 'com.my-other-wallet2',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN3',
        packageName: 'com.my-other-wallet3',
        platform: 'any',
        walletId: '123'
      }];

      server.storage.db.collection(collections.PUSH_NOTIFICATION_SUBS).insertMany(subs, function(err) {
        should.not.exist(err);

        // Simulate new block notification
        server._notify('NewBlock', {
          hash: 'dummy hash',
        }, {
          isGlobal: true
        }, function(err) {
          should.not.exist(err);
          Utils.sleep(100).then(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(3); // DEVICE_TOKEN, DEVICE_TOKEN2, DEVICE_TOKEN3
            should.not.exist(args[0].body.notification);
            should.exist(args[0].body.data);
            should.not.exist(args[1].body.notification);
            should.exist(args[1].body.data);
            should.not.exist(args[2].body.notification);
            should.exist(args[2].body.data);
            done();
          });
        });
      });
    });
  });

  describe('Single wallet - Braze', function() {
    beforeEach(async function() {
      await helpers.beforeEach();
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await Promise.all([
          util.promisify(s.savePreferences).call(s, {
            email: 'copayer' + (i + 1) + '@domain.com',
            language: 'en',
            unit: 'bit',
          }),
          util.promisify(s.pushNotificationsBrazeSubscribe).call(s, {
            externalUserId: '1234',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          })
        ]);
      }

      requestStub = sinon.stub();
      requestStub.yields();

      pushNotificationsService = new PushNotificationsService();
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
        lockOpts: {},
        messageBroker: server.messageBroker,
        storage: helpers.getStorage(),
        request: requestStub,
        pushNotificationsOpts: {
          templatePath: 'templates',
          defaultLanguage: 'en',
          defaultUnit: 'btc',
          subjectPrefix: '',
          pushServerUrlBraze: 'http://localhost:8000',
          authorizationKeyBraze: 'secret',
        },
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
            Utils.sleep(100).then(function() {
              const calls = requestStub.getCalls();
              const args = calls.map(c => c.args[0]);
              calls.length.should.equal(2); // NewAddress, NewIncomingTx

              should.not.exist(args[0].body.messages.apple_push.alert.title);
              should.not.exist(args[0].body.messages.apple_push.alert.body);
              should.not.exist(args[0].body.messages.android_push.alert);
              should.not.exist(args[0].body.messages.android_push.title);

              should.exist(args[0].body.messages.android_push.send_to_sync);
              should.exist(args[0].body.messages.apple_push['content-available']);

              args[1].body.messages.apple_push.alert.title.should.contain('New payment received');
              args[1].body.messages.apple_push.alert.body.should.contain('123,000');
              args[1].body.messages.apple_push.alert.body.should.contain('bits');
              args[1].body.messages.android_push.title.should.contain('New payment received');
              args[1].body.messages.android_push.alert.should.contain('123,000');
              args[1].body.messages.android_push.alert.should.contain('bits');
              should.not.exist(args[1].body.messages.android_push.send_to_sync);
              should.not.exist(args[1].body.messages.apple_push['content-available']);

              done();
            });
          });
        });
      });
    });
  });

  describe('Single wallet - Should use braze subscription if both set', function() {
    beforeEach(async function() {
      await helpers.beforeEach();
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1));
      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await Promise.all([
          util.promisify(s.savePreferences).call(s, {
            email: 'copayer' + (i + 1) + '@domain.com',
            language: 'en',
            unit: 'bit',
          }),
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: '1234',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          }),
          util.promisify(s.pushNotificationsBrazeSubscribe).call(s, {
            externalUserId: '1234',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          })
        ]);
      }

      requestStub = sinon.stub();
      requestStub.yields();

      pushNotificationsService = new PushNotificationsService();
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
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
          pushServerUrlBraze: 'http://localhost:8000',
          authorizationKey: 'secret',
          authorizationKeyBraze: 'secret',
        }
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
            Utils.sleep(100).then(function() {
              const calls = requestStub.getCalls();
              const args = calls.map(c => c.args[0]);
              calls.length.should.equal(2); // NewAddress, NewIncomingTx

              should.not.exist(args[0].body.messages.apple_push.alert.title);
              should.not.exist(args[0].body.messages.apple_push.alert.body);
              should.not.exist(args[0].body.messages.android_push.alert);
              should.not.exist(args[0].body.messages.android_push.title);

              should.exist(args[0].body.messages.android_push.send_to_sync);
              should.exist(args[0].body.messages.apple_push['content-available']);

              args[1].body.messages.apple_push.alert.title.should.contain('New payment received');
              args[1].body.messages.apple_push.alert.body.should.contain('123,000');
              args[1].body.messages.apple_push.alert.body.should.contain('bits');
              args[1].body.messages.android_push.title.should.contain('New payment received');
              args[1].body.messages.android_push.alert.should.contain('123,000');
              args[1].body.messages.android_push.alert.should.contain('bits');

              should.not.exist(args[1].body.messages.android_push.send_to_sync);
              should.not.exist(args[1].body.messages.apple_push['content-available']);

              done();
            });
          });
        });
      });
    });
  });

  describe('Any wallet - Should use braze subscription if both set', function() {
    beforeEach(async function() {
      await helpers.beforeEach();
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1));

      for (let i = 0; i < wallet.copayers.length; i++) {
        const copayer = wallet.copayers[i];
        const s = await helpers.getAuthServer(copayer.id);
        await Promise.all([
          util.promisify(s.savePreferences).call(s, {
            email: 'copayer' + (i + 1) + '@domain.com',
            language: 'en',
            unit: 'bit',
          }),
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: 'DEVICE_TOKEN',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          }),
          util.promisify(s.pushNotificationsSubscribe).call(s, {
            token: 'DEVICE_TOKEN2',
            packageName: 'com.my-other-wallet',
            platform: 'iOS',
            walletId: '123'
          }),
          util.promisify(s.pushNotificationsBrazeSubscribe).call(s, {
            externalUserId: 'DEVICE_EXTERNAL_USER_ID',
            packageName: 'com.wallet',
            platform: 'Android',
            walletId: '123'
          }),
          util.promisify(s.pushNotificationsBrazeSubscribe).call(s, {
            externalUserId: 'DEVICE_EXTERNAL_USER_ID2',
            packageName: 'com.my-other-wallet',
            platform: 'iOS',
            walletId: '123'
          })
        ]);
      }


      requestStub = sinon.stub();
      requestStub.yields();

      pushNotificationsService = new PushNotificationsService();
      await util.promisify(pushNotificationsService.start).call(pushNotificationsService, {
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
          pushServerUrlBraze: 'http://localhost:8000',
          authorizationKey: 'secret',
          authorizationKeyBraze: 'secret',
        }
      });
    });

    it('should notify NewBlock to all devices subscribed in the last 10 minutes', function(done) {
      const collections = Storage.collections;
      const oldSubscription = {
        _id: new ObjectID('5fb57ecde3de1d285042a551'),
        version: '1.0.0',
        createdOn: 1605729997,
        copayerId: wallet.copayers[0].id,
        externalUserId: 'DEVICE_EXTERNAL_USER_ID3',
        packageName: 'com.my-other-wallet2',
        platform: 'any',
        walletId: '123'
      };

      server.storage.db.collection(collections.PUSH_NOTIFICATION_SUBS).insertOne(oldSubscription, function(err) {
        should.not.exist(err);

        // Simulate new block notification
        server._notify('NewBlock', {
          hash: 'dummy hash',
        }, {
          isGlobal: true
        }, function(err) {
          should.not.exist(err);
          Utils.sleep(100).then(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);

            calls.length.should.equal(2); // DEVICE_EXTERNAL_USER_ID, DEVICE_EXTERNAL_USER_ID2
            should.not.exist(args[0].body.messages.apple_push.alert.title);
            should.not.exist(args[0].body.messages.apple_push.alert.body);
            should.not.exist(args[0].body.messages.android_push.alert);
            should.not.exist(args[0].body.messages.android_push.title);
            should.not.exist(args[1].body.messages.apple_push.alert.title);
            should.not.exist(args[1].body.messages.apple_push.alert.body);
            should.not.exist(args[1].body.messages.android_push.alert);
            should.not.exist(args[1].body.messages.android_push.title);

            should.exist(args[0].body.messages.apple_push.extra);
            should.exist(args[0].body.messages.apple_push.custom_uri);
            should.exist(args[0].body.messages.android_push.extra);
            should.exist(args[0].body.messages.android_push.custom_uri);
            should.exist(args[0].body.messages.android_push.send_to_sync);
            should.exist(args[0].body.messages.apple_push['content-available']);
            should.exist(args[1].body.messages.apple_push.extra);
            should.exist(args[1].body.messages.apple_push.custom_uri);
            should.exist(args[1].body.messages.android_push.extra);
            should.exist(args[1].body.messages.android_push.custom_uri);
            should.exist(args[1].body.messages.android_push.send_to_sync);
            should.exist(args[1].body.messages.apple_push['content-available']);
            done();
          });
        });
      });
    });

    it('should notify only one NewBlock push notification for each device', function(done) {
      const collections = Storage.collections;
      const subs = [{
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN',
        packageName: 'com.my-other-wallet',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN2',
        packageName: 'com.my-other-wallet2',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN2',
        packageName: 'com.my-other-wallet2',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        token: 'DEVICE_TOKEN3',
        packageName: 'com.my-other-wallet3',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        externalUserId: 'DEVICE_EXTERNAL_USER_ID',
        packageName: 'com.my-other-wallet',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        externalUserId: 'DEVICE_EXTERNAL_USER_ID2',
        packageName: 'com.my-other-wallet2',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        externalUserId: 'DEVICE_EXTERNAL_USER_ID2',
        packageName: 'com.my-other-wallet2',
        platform: 'any',
        walletId: '123'
      },
      {
        version: '1.0.0',
        createdOn: Math.floor(Date.now() / 1000),
        copayerId: wallet.copayers[0].id,
        externalUserId: 'DEVICE_EXTERNAL_USER_ID3',
        packageName: 'com.my-other-wallet3',
        platform: 'any',
        walletId: '123'
      }];

      server.storage.db.collection(collections.PUSH_NOTIFICATION_SUBS).insertMany(subs, function(err) {
        should.not.exist(err);

        // Simulate new block notification
        server._notify('NewBlock', {
          hash: 'dummy hash',
        }, {
          isGlobal: true
        }, function(err) {
          should.not.exist(err);
          Utils.sleep(100).then(function() {
            const calls = requestStub.getCalls();
            const args = calls.map(c => c.args[0]);
            calls.length.should.equal(3); // DEVICE_EXTERNAL_USER_ID, DEVICE_EXTERNAL_USER_ID2, DEVICE_EXTERNAL_USER_ID3

            should.not.exist(args[0].body.messages.apple_push.alert.title);
            should.not.exist(args[0].body.messages.apple_push.alert.body);
            should.not.exist(args[0].body.messages.android_push.alert);
            should.not.exist(args[0].body.messages.android_push.title);
            should.not.exist(args[1].body.messages.apple_push.alert.title);
            should.not.exist(args[1].body.messages.apple_push.alert.body);
            should.not.exist(args[1].body.messages.android_push.alert);
            should.not.exist(args[1].body.messages.android_push.title);
            should.not.exist(args[2].body.messages.apple_push.alert.title);
            should.not.exist(args[2].body.messages.apple_push.alert.body);
            should.not.exist(args[2].body.messages.android_push.alert);
            should.not.exist(args[2].body.messages.android_push.title);

            should.exist(args[0].body.messages.android_push.send_to_sync);
            should.exist(args[0].body.messages.apple_push['content-available']);
            should.exist(args[1].body.messages.android_push.send_to_sync);
            should.exist(args[1].body.messages.apple_push['content-available']);
            should.exist(args[2].body.messages.android_push.send_to_sync);
            should.exist(args[2].body.messages.apple_push['content-available']);

            should.exist(args[0].body.messages.apple_push.extra);
            should.exist(args[0].body.messages.apple_push.custom_uri);
            should.exist(args[0].body.messages.android_push.extra);
            should.exist(args[0].body.messages.android_push.custom_uri);
            should.exist(args[1].body.messages.apple_push.extra);
            should.exist(args[1].body.messages.apple_push.custom_uri);
            should.exist(args[1].body.messages.android_push.extra);
            should.exist(args[1].body.messages.android_push.custom_uri);
            should.exist(args[2].body.messages.apple_push.extra);
            should.exist(args[2].body.messages.apple_push.custom_uri);
            should.exist(args[2].body.messages.android_push.extra);
            should.exist(args[2].body.messages.android_push.custom_uri);
            done();
          });
        });
      });
    });
  });
});