'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import sinon from 'sinon';
import * as CWC from 'crypto-wallet-core';
import { ChainService } from '../../src/lib/chain/index';
import config from '../../src/config';
import { WalletService, UPGRADES } from '../../src/lib/server';
import { Storage } from '../../src/lib/storage';
import { Common } from '../../src/lib/common';
import * as Model from '../../src/lib/model';
import { BCHAddressTranslator } from '../../src/lib/bchaddresstranslator';
import * as TestData from '../testdata';
import helpers from './helpers';
import { ClientError } from '../../src/lib/errors/clienterror';

const should = chai.should();
config.moralis = config.moralis ?? {
  apiKey: 'apiKey',
  whitelist: []
};

const { Constants, Defaults, Utils } = Common;
const VanillaDefaults = JSON.parse(JSON.stringify(Defaults));

const Bitcore = CWC.BitcoreLib;
const Bitcore_ = {
  btc: CWC.BitcoreLib,
  bch: CWC.BitcoreLibCash,
  eth: CWC.BitcoreLib,
  xrp: CWC.BitcoreLib,
  doge: CWC.BitcoreLibDoge,
  ltc: CWC.BitcoreLibLtc
};

const TO_SAT = {
  bch: 1e8,
  btc: 1e8,
  eth: 1e18,
  usdc: 1e6,
  xrp: 1e6,
  doge: 1e8,
  ltc: 1e8,
  sol: 1e9
};

const TOKENS = [
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd'
];

describe('Wallet service', function() {
  let blockchainExplorer;

  before(async function() {
    const res = await helpers.before();
    blockchainExplorer = res.blockchainExplorer;
  });

  beforeEach(async function() {
    config.suspendedChains = [];

    // restore defaults, cp values
    for (const x of Object.keys(VanillaDefaults)) {
      Defaults[x] = VanillaDefaults[x];
    }

    await helpers.beforeEach();
  });

  afterEach(function() {
    sinon.restore();
  });

  after(async function() {
    await helpers.after();
  });

  describe('#getServiceVersion', function() {
    it('should get version from package', function() {
      WalletService.getServiceVersion().should.equal('bws-' + require('../../package').version);
    });
  });

  describe('#getInstance', function() {
    it('should get server instance', function() {
      const server = WalletService.getInstance({
        clientVersion: 'bwc-2.9.0',
      });
      server.clientVersion.should.equal('bwc-2.9.0');
    });

    it('should not get server instance for BWC lower than v1.2', function() {
      try {
        WalletService.getInstance({ clientVersion: 'bwc-1.1.99' });
        throw new Error('should have thrown');
      } catch (err) {
        err.should.be.instanceof(ClientError);
        err.code.should.equal('UPGRADE_NEEDED');
      }
    });

    it('should get server instance for non-BWC clients', function() {
      let server = WalletService.getInstance({
        clientVersion: 'dummy-1.0.0',
      });
      server.clientVersion.should.equal('dummy-1.0.0');
      server = WalletService.getInstance({});
      (server.clientVersion == null).should.be.true;
    });
  });

  describe('#getInstanceWithAuth', function() {
    it('should not get server instance for BWC lower than v1.2', function(done) {
      WalletService.getInstanceWithAuth({
        copayerId: '1234',
        message: 'hello world',
        signature: 'xxx',
        clientVersion: 'bwc-1.1.99',
      }, function(err: ClientError, server) {
        should.exist(err);
        should.not.exist(server);
        err.should.be.instanceof(ClientError);
        err.code.should.equal('UPGRADE_NEEDED');
        done();
      });
    });
    it('should get server instance for existing copayer', function(done) {
      helpers.createAndJoinWallet(1, 2).then(function({ wallet }) {
        // using copayer 0 data.
        const xpriv = TestData.copayers[0].xPrivKey;
        const priv = TestData.copayers[0].privKey_1H_0;

        const sig = helpers.signMessage('hello world', priv);

        WalletService.getInstanceWithAuth({
          // test assumes wallet's copayer[0] is TestData's copayer[0]
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
      const message = 'hello world';
      const opts = {
        copayerId: 'dummy',
        message: message,
        signature: helpers.signMessage(message, TestData.copayers[0].privKey_1H_0),
      };
      WalletService.getInstanceWithAuth(opts, function(err: ClientError, server) {
        err.should.be.instanceof(ClientError);
        err.code.should.equal('NOT_AUTHORIZED');
        err.message.should.contain('Copayer not found');
        done();
      });
    });

    it('should fail when message signature cannot be verified', function(done) {
      helpers.createAndJoinWallet(1, 2).then(function({ wallet }) {
        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: 'dummy',
          signature: 'dummy',
        }, function(err: ClientError, server) {
          err.should.be.instanceof(ClientError);
          err.code.should.equal('NOT_AUTHORIZED');
          err.message.should.contain('Invalid signature');
          done();
        });
      });
    });

    it('should get server instance for support staff', function(done) {
      helpers.createAndJoinWallet(1, 1).then(function({ server: s, wallet }) {
        const collections = Storage.collections;
        s.storage.db.collection(collections.COPAYERS_LOOKUP).update({
          copayerId: wallet.copayers[0].id
        }, {
          $set: {
            isSupportStaff: true
          }
        }, () => {
          const xpriv = TestData.copayers[0].xPrivKey;
          const priv = TestData.copayers[0].privKey_1H_0;
          const sig = helpers.signMessage('hello world', priv);

          WalletService.getInstanceWithAuth({
            copayerId: wallet.copayers[0].id,
            message: 'hello world',
            signature: sig,
            walletId: '123',
          }, function(err, server) {
            should.not.exist(err);
            // AQUI
            server.walletId.should.equal('123');
            server.copayerId.should.equal(wallet.copayers[0].id);
            done();
          });
        });
      });
    });

    it('should get server instance for marketing staff', function(done) {
      helpers.createAndJoinWallet(1, 1).then(function({ server: s, wallet }) {
        const collections = Storage.collections;
        s.storage.db.collection(collections.COPAYERS_LOOKUP).updateOne({
          copayerId: wallet.copayers[0].id
        }, {
          $set: {
            isMarketingStaff: true
          }
        }, () => {
          const xpriv = TestData.copayers[0].xPrivKey;
          const priv = TestData.copayers[0].privKey_1H_0;
          const sig = helpers.signMessage('hello world', priv);

          WalletService.getInstanceWithAuth({
            copayerId: wallet.copayers[0].id,
            message: 'hello world',
            signature: sig,
            walletId: '123',
          }, function(err, server) {
            should.not.exist(err);
            server.walletId.should.not.equal('123');
            server.copayerIsMarketingStaff.should.equal(true);
            server.copayerId.should.equal(wallet.copayers[0].id);
            done();
          });

        });
      });
    });
  });

  // tests for adding and retrieving adds from db
  describe('Creating ads, retrieve ads, active/inactive', function() {
    let server;
    let wallet;
    const adOpts = {
      advertisementId: '123',
      name: 'name',
      title: 'title',
      body: 'body',
      country: 'US',
      type: 'standard',
      linkText: 'linkText',
      linkUrl: 'linkUrl',
      dismissible: true,
      isAdActive: false,
      isTesting: true,
      signature: '304050302480413401348a3b34902403434512535e435463',
      app: 'bitpay'
    };

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 2));
    });

    it('should create/get ad', async function() {
      let ad = await util.promisify(server.createAdvert).call(server, adOpts);
      ad = await util.promisify(server.getAdvert).call(server, { adId: '123' });
      should.exist(ad);
      ad.advertisementId.should.equal('123');
      ad.name.should.equal('name');
      ad.title.should.equal('title');
      ad.body.should.equal('body');
      ad.country.should.equal('US');
      ad.type.should.equal('standard');
      ad.linkText.should.equal('linkText');
      ad.linkUrl.should.equal('linkUrl');
      ad.dismissible.should.equal(true);
      ad.isAdActive.should.equal(false);
      ad.isTesting.should.equal(true);
      ad.signature.should.equal('304050302480413401348a3b34902403434512535e435463');
      ad.app.should.equal('bitpay');
    });

    it('should create/get/delete an ad', async function() {
      let ad = await util.promisify(server.createAdvert).call(server, adOpts);
      ad = await util.promisify(server.getAdvert).call(server, { adId: '123' });
      should.exist(ad);
      await util.promisify(server.removeAdvert).call(server, { adId: '123' });
      ad = await util.promisify(server.getAdvert).call(server, { adId: '123' });
      should.not.exist(ad);
    });

    it('should create ad initially inactive, retrieve, make active, retrieve again', async function() {
      let ad = await util.promisify(server.createAdvert).call(server, adOpts);
      ad = await util.promisify(server.getAdvert).call(server, { adId: '123' });
      should.exist(ad);
      ad.advertisementId.should.equal('123');
      ad.isAdActive.should.equal(false);
      ad.isTesting.should.equal(true);
      await util.promisify(server.activateAdvert).call(server, { adId: '123' });
      ad = await util.promisify(server.getAdvert).call(server, { adId: '123' });
      should.exist(ad);
      ad.advertisementId.should.equal('123');
      ad.isAdActive.should.equal(true);
      ad.isTesting.should.equal(false);
    });
  });

  describe('Session management (#login, #logout, #authenticate)', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 2));
    });

    it('should get a new session & authenticate', function(done) {
      WalletService.getInstanceWithAuth({
        copayerId: server.copayerId,
        session: 'dummy',
      }, function(err: ClientError, server2) {
        should.exist(err);
        err.should.be.instanceof(ClientError);
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

    it('should create a new session if the previous one has expired', async function() {
      const timer = sinon.useFakeTimers({ toFake: ['Date'] });
      const token = await util.promisify(server.login).call(server, {});
      should.exist(token);
      const server2 = await util.promisify(WalletService.getInstanceWithAuth).call(WalletService, {
        copayerId: server.copayerId,
        session: token,
      });
      should.exist(server2);
      timer.tick((Defaults.SESSION_EXPIRATION + 1) * 1000);
      const t = await util.promisify(server.login).call(server, {});
      should.exist(t);
      t.should.not.equal(token);
      try {
        await util.promisify(WalletService.getInstanceWithAuth).call(WalletService, {
          copayerId: server.copayerId,
          session: token,
        });
        throw new Error('should have thrown');
      } catch (err) {
        err.should.be.instanceof(ClientError);
        err.message.should.contain('expired');
        err.code.should.equal('NOT_AUTHORIZED');
      }      
      timer.restore();
    });
  });

  describe('#createWallet', function() {
    let server;

    beforeEach(function() {
      server = new WalletService();
    });

    it('should create and store wallet', function(done) {
      const opts = {
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
      const opts = {
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
      const opts = {
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

    it('should create wallet BCH if n > 1 and BWC version is 8.3.0 or higher', function(done) {
      const opts = {
        coin: 'bch',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub
      };
      server.clientVersion = 'bwc-8.3.0';
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        should.exist(walletId);
        done();
      });
    });

    it('should create wallet BTC if n > 1 and BWC version is lower than 8.3.0', function(done) {
      const opts = {
        coin: 'btc',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub
      };
      server.clientVersion = 'bwc-8.3.0';
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        should.exist(walletId);
        done();
      });
    });

    it('should fail to create wallets BCH if n > 1 and BWC version is lower than 8.3.0', function(done) {
      const opts = {
        coin: 'bch',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub
      };
      server.clientVersion = 'bwc-8.2.0';
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(walletId);
        should.exist(err);
        err.message.should.contain('BWC clients < 8.3 are no longer supported for multisig BCH wallets.');
        done();
      });
    });

    it('should create wallet BCH if n == 1 and BWC version is lower than 8.3.0', function(done) {
      const opts = {
        coin: 'bch',
        name: 'my wallet',
        m: 1,
        n: 1,
        pubKey: TestData.keyPair.pub
      };
      server.clientVersion = 'bwc-8.2.0';
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        should.exist(walletId);
        done();
      });
    });

    it('should fail to create wallet with no name', function(done) {
      const opts = {
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

    it('should check m-n combination', async function() {
      const pairs = [{
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
      }];
      for (const pair of pairs) {
        const pub = new Bitcore.PrivateKey().toPublicKey();
        const opts = {
          name: 'my wallet',
          pubKey: pub.toString(),
          m: pair.m,
          n: pair.n,
        };

        try {
          await util.promisify(server.createWallet).call(server, opts);
          pair.valid.should.be.true;
        } catch (err) {
          pair.valid.should.be.false;
          err.message.should.equal('Invalid combination of required copayers / total copayers');
        }
      }
    });

    it('should fail to create wallet with invalid pubKey argument', function(done) {
      const opts = {
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
      const opts = {
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

    it('should create a P2WPKH Segwit wallet', function(done) {
      const opts = {
        coin: 'btc',
        name: 'my segwit wallet',
        m: 1,
        n: 1,
        pubKey: TestData.keyPair.pub,
        useNativeSegwit: true
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet(walletId, function(err, wallet) {
          should.not.exist(err);
          wallet.addressType.should.equal('P2WPKH');
          wallet.coin.should.equal('btc');
          done();
        });
      });
    });

    it('should create a P2WSH Segwit wallet', function(done) {
      const opts = {
        coin: 'btc',
        name: 'my multisig segwit wallet',
        m: 1,
        n: 2,
        pubKey: TestData.keyPair.pub,
        useNativeSegwit: true
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet(walletId, function(err, wallet) {
          should.not.exist(err);
          wallet.addressType.should.equal('P2WSH');
          wallet.coin.should.equal('btc');
          done();
        });
      });
    });

    it('should create a P2TR Taproot wallet', function(done) {
      const opts = {
        coin: 'btc',
        name: 'my multisig segwit wallet',
        m: 1,
        n: 1,
        pubKey: TestData.keyPair.pub,
        useNativeSegwit: true,
        segwitVersion: 1 // taproot
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet(walletId, function(err, wallet) {
          should.not.exist(err);
          wallet.addressType.should.equal('P2TR');
          wallet.coin.should.equal('btc');
          done();
        });
      });
    });

    for (const c of ['eth', 'xrp', 'matic', 'arb', 'base', 'op', 'sol']) {
      describe(c, function() {
        it('should fail to create a multisig wallet', function(done) {
          const opts = {
            coin: c,
            name: 'my wallet',
            m: 2,
            n: 3,
            pubKey: TestData.keyPair.pub,
          };
          server.createWallet(opts, function(err, walletId) {
            should.exist(err);
            if (ChainService.supportsThresholdsig(c)) {
              err.message.should.contain('TSS key session id is required');
            } else {
              err.message.should.contain('not supported');
            }
            done();
          });
        });

        it('should create wallet with singleAddress flag', async function() {
          const { wallet } = await helpers.createAndJoinWallet(1, 1, { coin: c });
          wallet.singleAddress.should.equal(true);
        });

        it('should create, store, and fetch wallet', function(done) {
          const opts = {
            coin: c,
            name: 'my wallet',
            m: 1,
            n: 1,
            pubKey: TestData.keyPair.pub
          };

          server.createWallet(opts, function(err, walletId) {
            should.not.exist(err);
            should.exist(walletId);
            server.storage.fetchWallet(walletId, function(err, wallet) {
              should.not.exist(err);
              wallet.id.should.equal(walletId);
              wallet.name.should.equal('my wallet');
              wallet.chain.should.equal(c);
              wallet.coin.should.equal(c);
              done();
            });
          });
        });
      });
    }


    describe('Address derivation strategy', function() {
      let server;

      beforeEach(function() {
        server = WalletService.getInstance();
      });

      it('should use BIP44 & P2PKH for 1-of-1 wallet if supported', function(done) {
        const walletOpts = {
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

      it('should use BIP44 & P2SH for shared wallet if supported', function(done) {
        const walletOpts = {
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
    });
  });

  describe('#joinWallet', function() {
    describe('New clients', function() {
      let server;
      let serverForBch;
      let walletId;
      let walletIdForBch;

      beforeEach(async function() {
        server = new WalletService();
        const walletOpts = {
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
          clientVersion: 'bwc-8.3.0'
        };
        walletId = await util.promisify(server.createWallet).call(server, walletOpts);
        should.exist(walletId);
      });

      it('should join existing wallet', function(done) {
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          customData: 'dummy custom data',
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          const copayerId = result.copayerId;
          helpers.getAuthServer(copayerId).then(function(server) {
            server.getWallet({}, function(err, wallet) {
              wallet.id.should.equal(walletId);
              wallet.copayers.length.should.equal(1);
              const copayer = wallet.copayers[0];
              copayer.name.should.equal('me');
              copayer.id.should.equal(copayerId);
              copayer.customData.should.equal('dummy custom data');
              server.getNotifications({}, function(err, notifications) {
                should.not.exist(err);
                let notif = notifications.find(n => n.type === 'NewCopayer');
                should.exist(notif);
                notif.data.walletId.should.equal(walletId);
                notif.data.copayerId.should.equal(copayerId);
                notif.data.copayerName.should.equal('me');

                notif = notifications.find(n => n.type === 'WalletComplete');
                should.not.exist(notif);
                done();
              });
            });
          });
        });
      });

      it('should join existing wallet, getStatus + v8', function(done) {
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          customData: 'dummy custom data',
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          const copayerId = result.copayerId;
          helpers.getAuthServer(copayerId).then(function(server) {
            server.getStatus({
              includeExtendedInfo: true
            }, function(err, status) {
              should.not.exist(err);
              status.wallet.m.should.equal(1);
              status.wallet.beRegistered.should.equal(false);
              status.balance.totalAmount.should.equal(0);
              status.balance.availableAmount.should.equal(0);
              done();
            });
          });
        });
      });

      it('should join wallet BTC if BWC version is lower than 8.3.0', function(done) {
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          coin: 'btc',
          name: 'my wallet',
          m: 2,
          n: 3,
          pubKey: TestData.keyPair.pub,
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          customData: 'dummy custom data',
        });
        server.clientVersion = 'bwc-8.2.0';
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          should.exist(result.copayerId);
          done();
        });
      });

      it('should fail join existing wallet with bad xpub', function(done) {
        const copayerOpts = helpers.getSignedCopayerOpts({
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
        const copayerOpts = helpers.getSignedCopayerOpts({
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
        const copayerOpts = helpers.getSignedCopayerOpts({
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
        const copayerOpts = {
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
        helpers.createAndJoinWallet(1, 1).then(function({ wallet }) {
          const copayerOpts = helpers.getSignedCopayerOpts({
            walletId: wallet.id,
            name: 'me',
            xPubKey: TestData.copayers[1].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[1].pubKey_1H_0,
          });
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.should.be.instanceof(ClientError);
            err.code.should.equal('WALLET_FULL');
            err.message.should.equal('Wallet full');
            done();
          });
        });
      });

      it('should fail to join wallet for different coin', function(done) {
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
          coin: 'bch',
        });
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          err.message.should.contain('different chain');
          done();
        });
      });

      it('should return copayer in wallet error before full wallet', function(done) {
        helpers.createAndJoinWallet(1, 1).then(function({ wallet }) {
          const copayerOpts = helpers.getSignedCopayerOpts({
            walletId: wallet.id,
            name: 'me',
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0,
          });
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.should.be.instanceof(ClientError);
            err.code.should.equal('COPAYER_IN_WALLET');
            done();
          });
        });
      });

      it('should fail to re-join wallet', function(done) {
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err) {
          should.not.exist(err);
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.should.be.instanceof(ClientError);
            err.code.should.equal('COPAYER_IN_WALLET');
            err.message.should.equal('Copayer already in wallet');
            done();
          });
        });
      });

      it('should be able to get wallet info without actually joining', function(done) {
        const copayerOpts = helpers.getSignedCopayerOpts({
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
        let copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err) {
          should.not.exist(err);

          const walletOpts = {
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
              err.should.be.instanceof(ClientError);
              err.code.should.equal('COPAYER_REGISTERED');
              err.message.should.equal('Copayer ID already registered on server');
              done();
            });
          });
        });
      });

      it('should fail to join with bad formated signature', function(done) {
        const copayerOpts = {
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
        const copayerOpts = helpers.getSignedCopayerOpts({
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
        const copayerOpts = {
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
        const copayerOpts = helpers.getSignedCopayerOpts({
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
        helpers.createAndJoinWallet(2, 3).then(function({ server }) {
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.status.should.equal('complete');
            wallet.publicKeyRing.length.should.equal(3);
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              const notif = notifications.find(n => n.type === 'WalletComplete');
              should.exist(notif);
              notif.data.walletId.should.equal(wallet.id);
              done();
            });
          });
        });
      });

      it('should not notify WalletComplete if 1-of-1', function(done) {
        helpers.createAndJoinWallet(1, 1).then(function({ server }) {
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            const notif = notifications.find(n => n.type === 'WalletComplete');
            should.not.exist(notif);
            done();
          });
        });
      });
    });

    describe('New clients 2', function() {
      let server;
      let serverForBch;
      let walletId;
      let walletIdForBch;

      it('should join wallet BCH if BWC version is 8.3.0 or higher', function(done) {
        serverForBch = new WalletService();
        const walletOpts = {
          coin: 'bch',
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub
        };
        serverForBch.clientVersion = 'bwc-8.3.4';
        serverForBch.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletIdForBch = wId;
          should.exist(walletIdForBch);
          const copayerOpts = helpers.getSignedCopayerOpts({
            coin: 'bch',
            walletId: walletIdForBch,
            name: 'me',
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0,
            customData: 'dummy custom data'
          });
          serverForBch.clientVersion = 'bwc-8.3.0';
          serverForBch.joinWallet(copayerOpts, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            should.exist(result.copayerId);
            done();
          });
        });
      });

      it('should fail to join BIP48 wallets from old clients ', function(done) {
        serverForBch = new WalletService();
        const walletOpts = {
          coin: 'bch',
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
          walletId: walletId,
          usePurpose48: true,
        };
        serverForBch.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletIdForBch = wId;
          should.exist(walletIdForBch);
          const copayerOpts = helpers.getSignedCopayerOpts({
            coin: 'bch',
            walletId: walletIdForBch,
            name: 'me',
            m: 2,
            n: 3,
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0
          });
          serverForBch.clientVersion = 'bwc-8.3.0';
          serverForBch.joinWallet(copayerOpts, function(err, result) {
            should.not.exist(result);
            should.exist(err);
            err.message.should.contain('upgrade');
            done();
          });
        });
      });

      it('should join BIP48 wallets from new clients ', function(done) {
        serverForBch = new WalletService();
        const walletOpts = {
          coin: 'bch',
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
          walletId: walletId,
          usePurpose48: true,
        };
        serverForBch.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletIdForBch = wId;
          should.exist(walletIdForBch);
          const copayerOpts = helpers.getSignedCopayerOpts({
            coin: 'bch',
            walletId: walletIdForBch,
            name: 'me',
            m: 2,
            n: 3,
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0
          });
          serverForBch.clientVersion = 'bwc-8.7.0';
          serverForBch.joinWallet(copayerOpts, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            done();
          });
        });
      });
    });

    describe('New clients 3', function() {
      let server;
      let walletId;
      let walletIdForSegwit;

      it('should join wallet segwit if BWC version is 8.17.0 or higher', function(done) {
        server = new WalletService();
        const walletOpts = {
          coin: 'btc',
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
          useNativeSegwit: true
        };
        server.clientVersion = 'bwc-8.17.0';
        server.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletIdForSegwit = wId;
          should.exist(walletIdForSegwit);
          const copayerOpts = helpers.getSignedCopayerOpts({
            coin: 'btc',
            walletId: walletIdForSegwit,
            name: 'me',
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0,
            customData: 'dummy custom data'
          });
          server.clientVersion = 'bwc-8.17.0';
          server.joinWallet(copayerOpts, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            should.exist(result.copayerId);
            result.wallet.addressType.should.equal('P2WSH');
            done();
          });
        });
      });

      it('should fail to join segwit wallets from old clients ', function(done) {
        server = new WalletService();
        const walletOpts = {
          coin: 'btc',
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
          walletId: walletId,
          useNativeSegwit: true
        };
        server.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletIdForSegwit = wId;
          should.exist(walletIdForSegwit);
          const copayerOpts = helpers.getSignedCopayerOpts({
            coin: 'btc',
            walletId: walletIdForSegwit,
            name: 'me',
            m: 2,
            n: 3,
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0
          });
          server.clientVersion = 'bwc-8.4.0';
          server.joinWallet(copayerOpts, function(err, result) {
            should.not.exist(result);
            should.exist(err);
            err.message.should.contain('upgrade');
            done();
          });
        });
      });

      it('should join segwit wallets from new clients', function(done) {
        server = new WalletService();
        const walletOpts = {
          coin: 'btc',
          name: 'my wallet',
          m: 1,
          n: 2,
          pubKey: TestData.keyPair.pub,
          walletId: walletId,
          useNativeSegwit: true,
        };
        server.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletIdForSegwit = wId;
          should.exist(walletIdForSegwit);
          const copayerOpts = helpers.getSignedCopayerOpts({
            coin: 'btc',
            walletId: walletIdForSegwit,
            name: 'me',
            m: 2,
            n: 3,
            xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0
          });
          server.clientVersion = 'bwc-9.0.0';
          server.joinWallet(copayerOpts, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            done();
          });
        });
      });
    });
  });

  describe('#removeWallet', function() {
    let server;
    let wallet;
    let clock;

    beforeEach(async function() {
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1));
      await helpers.stubUtxos(server, wallet, [1, 2]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.1e8,
        }],
        feePerKb: 100e2,
      };

      for (let i = 0; i < 2; i++) {
        await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      }
    });

    it('should delete a wallet', async function() {
      await util.promisify(server.removeWallet).call(server, {});
      try {
        await util.promisify(server.getWallet).call(server, {});
        throw new Error('should have thrown');
      } catch (err) {
        err.should.be.instanceof(ClientError);
        err.code.should.equal('WALLET_NOT_FOUND');
      }
      const results = await Promise.all([
        util.promisify(server.storage.fetchAddresses).call(server.storage, wallet.id),
        util.promisify(server.storage.fetchTxs).call(server.storage, wallet.id, {}),
        util.promisify(server.storage.fetchNotifications).call(server.storage, wallet.id, null, 0)
      ]);
      results[0].length.should.equal(0);
      results[1].length.should.equal(0);
      results[2].length.should.equal(0);
    });

    // creates 2 wallet, and deletes only 1.
    it('should delete a wallet, and only that wallet', async function() {
      const { server: server2, wallet: wallet2 } = await helpers.createAndJoinWallet(1, 1, { offset: 1 });

      await helpers.stubUtxos(server2, wallet2, [1, 2, 3]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.1e8,
        }],
        feePerKb: 100e2,
      };

      for (let i = 0; i < 2; i++) {
        await helpers.createAndPublishTx(server2, txOpts, TestData.copayers[1].privKey_1H_0);
      }

      await util.promisify(server.removeWallet).call(server, {});
      try {
        await util.promisify(server.getWallet).call(server, {});
        throw new Error('should have thrown');
      } catch (err) {
        err.should.be.instanceof(ClientError);
        err.code.should.equal('WALLET_NOT_FOUND');
      }

      const w = await util.promisify(server2.getWallet).call(server2, {});
      should.exist(w);
      w.id.should.equal(wallet2.id);

      const addresses = await util.promisify(server2.getAddresses).call(server2, { noChange: true });
      should.exist(addresses);
      addresses.length.should.above(0);

      const txs = await util.promisify(server2.getTxs).call(server2, {});
      should.exist(txs);
      txs.length.should.equal(2);

      const notifications = await util.promisify(server2.getNotifications).call(server2, {});
      should.exist(notifications);
      notifications.length.should.above(0);
    });
  });

  describe('#getStatus', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 2));
    });

    it('should get status', async function() {
      const status = await util.promisify(server.getStatus).call(server, {});
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
      for (const copayer of status.wallet.copayers) {
        should.not.exist(copayer.xPubKey);
        should.not.exist(copayer.requestPubKey);
        should.not.exist(copayer.signature);
        should.not.exist(copayer.requestPubKey);
        should.not.exist(copayer.addressManager);
        should.not.exist(copayer.customData);
      }
    });

    it('should get status including extended info', async function() {
      const status = await util.promisify(server.getStatus).call(server, { includeExtendedInfo: true });
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
      for (const copayer of status.wallet.copayers.slice(1)) {
        should.not.exist(copayer.customData);
      }
    });

    it('should get status including extended info with tokens', function(done) {
      helpers.createAndJoinWallet(1, 1, { coin: 'eth' }).then(function({ server: s }) {
        s.savePreferences({
          email: 'dummy@dummy.com',
          tokenAddresses: TOKENS,
        }, function(err) {
          should.not.exist(err);
          s.getStatus({
            includeExtendedInfo: true
          }, function(err, status) {
            should.not.exist(err);
            should.exist(status);
            status.preferences.tokenAddresses.should.deep.equal(TOKENS);
            done();
          });
        });
      });
    });

    it('should get status after tx creation', async function() {
      await helpers.stubUtxos(server, wallet, [1, 2]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.8e8
        }],
        feePerKb: 100e2
      };
      const tx = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      should.exist(tx);
      const status = await util.promisify(server.getStatus).call(server, {});
      status.pendingTxps.length.should.equal(1);
      const balance = status.balance;
      balance.totalAmount.should.equal(3e8);
      balance.lockedAmount.should.equal(tx.inputs[0].satoshis);
      balance.availableAmount.should.equal(balance.totalAmount - balance.lockedAmount);
    });

    it('should get status including server messages', async function() {
      server.appName = 'bitpay';
      server.appVersion = { major: 5, minor: 0, patch: 0 };
      const status = await util.promisify(server.getStatus).call(server, { includeServerMessages: true });
      should.exist(status);
      should.exist(status.serverMessages);
      Array.isArray(status.serverMessages).should.be.true;
      status.serverMessages.should.deep.equal([{
        title: 'Test message 2',
        body: 'Only for bitpay livenet wallets',
        link: 'http://bitpay.com',
        id: 'bitpay2',
        dismissible: true,
        category: 'critical',
        app: 'bitpay',
        priority: 1
      }]);
    });
    
    it('should get status including deprecated server message', async function() {
      server.appName = 'bitpay';
      server.appVersion = { major: 5, minor: 0, patch: 0 };
      const status = await util.promisify(server.getStatus).call(server, {});
      should.exist(status);
      should.exist(status.serverMessage);
      (typeof status.serverMessage === 'object').should.be.true;
      (Array.isArray(status.serverMessage)).should.be.false;
      status.serverMessage.should.deep.equal({
        title: 'Deprecated Test message',
        body: 'Only for bitpay, old wallets',
        link: 'http://bitpay.com',
        id: 'bitpay1',
        dismissible: true,
        category: 'critical',
        app: 'bitpay',
      });
    });
  });

  describe('#verifyMessageSignature', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));
    });

    it('should successfully verify message signature', function(done) {
      const message = 'hello world';
      const opts = {
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
      const message = 'hello world';
      const opts = {
        message: message,
        signature: helpers.signMessage(message, TestData.copayers[0].privKey_1H_0),
      };
      helpers.getAuthServer(wallet.copayers[1].id).then(function(server) {
        server.verifyMessageSignature(opts, function(err, isValid) {
          should.not.exist(err);
          isValid.should.be.false;
          done();
        });
      });
    });
  });

  describe('#createAddress', function() {
    let server;
    let wallet;

    describe('shared wallets (BIP44)', function() {
      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(2, 2));
      });

      it('should create address', function(done) {
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
            const notif = notifications.find(n => n.type === 'NewAddress');
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create next address if insertion fails', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          server.getWallet({}, (err, w) => {

            const old = server.getWallet;
            server.getWallet = sinon.stub();

            // return main address index to 0;
            w.addressManager.receiveAddressIndex = 0;
            server.getWallet.callsArgWith(1, null, w);

            server.createAddress({}, function(err, address) {
              server.getWallet = old;
              should.not.exist(err);

              should.exist(address);
              done();
            });
          });
        });
      });



      it('should create many addresses on simultaneous requests', async function() {
        const N = 5;
        const addresses = [];
        for (let i = 0; i < N; i++) {
          const address = await util.promisify(server.createAddress).call(server, {});
          addresses.push(address);
          
        }
        addresses.length.should.equal(N);
        for (let i = 0; i < N; i++) {
          addresses[i].path.should.equal('m/0/' + i);
        }
        // No two identical addresses
        new Set(addresses.map(m => m.address)).size.should.equal(N);
      });

      it('should not create address if unable to store it', function(done) {
        sinon.stub(server.storage, 'storeAddressAndWallet').yields('dummy error');
        server.createAddress({}, function(err, address) {
          should.exist(err);
          should.not.exist(address);
          server.getAddresses({ noChange: true }, function(err, addresses) {
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
      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(2, 2, { coin: 'bch' }));
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('pqu9c0xe7g0ngz9hzpky64nva9790m64esxxjmcv2k');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2SH');
          address.coin.should.equal('bch');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            const notif = notifications.find(n => n.type === 'NewAddress');
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create many addresses on simultaneous requests', async function() {
        const N = 5;
        const addresses = [];
        for (let i = 0; i < N; i++) {
          const address = await util.promisify(server.createAddress).call(server, {});
          addresses.push(address);
        }
        addresses.length.should.equal(N);
        for (let i = 0; i < N; i++) {
          addresses[i].path.should.equal('m/0/' + i);
        }
        // No two identical addresses
        new Set(addresses.map(a => a.address)).size.should.equal(N);
      });

      it('should not create address if unable to store it', function(done) {
        sinon.stub(server.storage, 'storeAddressAndWallet').yields('dummy error');
        server.createAddress({}, function(err, address) {
          should.exist(err);
          should.not.exist(address);
          server.getAddresses({ noChange: true }, function(err, addresses) {
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
      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(2, 2, { coin: 'bch' }));
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('pqu9c0xe7g0ngz9hzpky64nva9790m64esxxjmcv2k');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2SH');
          address.coin.should.equal('bch');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            const notif = notifications.find(n => n.type === 'NewAddress');
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create many addresses on simultaneous requests', async function() {
        const N = 5;
        const addresses = [];
        for (let i = 0; i < N; i++) {
          const address = await util.promisify(server.createAddress).call(server, {});
          addresses.push(address);
        }
        addresses.length.should.equal(N);
        for (let i = 0; i < N; i++) {
          addresses[i].path.should.equal('m/0/' + i);
        }
        // No two identical addresses
        new Set(addresses.map(a => a.address)).size.should.equal(N);
      });

      it('should not create address if unable to store it', function(done) {
        sinon.stub(server.storage, 'storeAddressAndWallet').yields('dummy error');
        server.createAddress({}, function(err, address) {
          should.exist(err);
          should.not.exist(address);
          server.getAddresses({ noChange: true }, function(err, addresses) {
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


    describe('1-1 wallet (BIP44/BCH)', function() {
      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'bch' }));
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2PKH');
          address.coin.should.equal('bch');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            const notif = notifications.find(n => n.type === 'NewAddress');
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });


      it('should create address (no cash addr)', function(done) {
        server.createAddress({ noCashAddr: true }, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('livenet');
          address.address.should.equal('CbWsiNjh18ynQYc5jfYhhespEGrAaW8YUq');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2PKH');
          address.coin.should.equal('bch');

          // notified address is Copay format
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            const notif = notifications.find(n => n.type === 'NewAddress');
            should.exist(notif);
            notif.data.address.should.equal(address.address);

            // stored address should be new format
            server.getAddresses({ noChange: true }, function(err, addresses) {
              should.not.exist(err);
              addresses.length.should.equal(1);
              addresses[0].address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
              done();
            });

          });
        });
      });
    });

    describe('1-1 wallet (BIP44/BCH/Testnet)', function() {
      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, {
          coin: 'bch',
          network: 'testnet4',
        }));
      });

      it('should create address', function(done) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          should.exist(address);
          address.walletId.should.equal(wallet.id);
          address.network.should.equal('testnet');
          address.address.should.equal('qpmvku3x8j9pz7mee89c590xsl3k5l02mqeyfhf3ce');
          address.isChange.should.be.false;
          address.path.should.equal('m/0/0');
          address.type.should.equal('P2PKH');
          address.coin.should.equal('bch');
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            const notif = notifications.find(n => n.type === 'NewAddress');
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });
    });


    describe('1-of-1 (BIP44 & P2PKH)', function() {
      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
        wallet.copayers[0].id.should.equal(TestData.copayers[0].id44btc);
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
            const notif = notifications.find(n => n.type === 'NewAddress');
            should.exist(notif);
            notif.data.address.should.equal(address.address);
            done();
          });
        });
      });

      it('should create many addresses on simultaneous requests', async function() {
        const N = 5;
        const addresses = [];
        for (let i = 0; i < N; i++) {
          const address = await util.promisify(server.createAddress).call(server, {});
          addresses.push(address);
        }
        addresses.length.should.equal(N);
        addresses.sort((a, b) => a.path - b.path);
        for (let i = 0; i < N; i++) {
          addresses[i].path.should.equal('m/0/' + i);
        }
        // No two identical addresses
        new Set(addresses.map(a => a.address)).size.should.equal(N);
      });

      it('should fail to create more consecutive addresses with no activity than allowed', async function() {
        sinon.stub(Defaults, 'MAX_MAIN_ADDRESS_GAP').value(2);
        helpers.stubAddressActivity([]);
        const addresses = [];
        for (let i = 0; i < 2; i++) {
          const address = await util.promisify(server.createAddress).call(server, {});
          addresses.push(address);
        }
        addresses.length.should.equal(2);

        try {
          await util.promisify(server.createAddress).call(server, {});
          throw new Error('should have thrown');
        } catch (err) {
          err.should.be.instanceof(ClientError);
          err.code.should.equal('MAIN_ADDRESS_GAP_REACHED');
        }
        const address2 = await util.promisify(server.createAddress).call(server, { ignoreMaxGap: true });
        should.exist(address2);
        address2.path.should.equal('m/0/2');
        helpers.stubAddressActivity([
          '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
        ]);
        const address3 = await util.promisify(server.createAddress).call(server, { ignoreMaxGap: true });
        should.exist(address3);
        address3.path.should.equal('m/0/3');
      });

      it('should cache address activity', async function() {
        sinon.stub(Defaults, 'MAX_MAIN_ADDRESS_GAP').value(2);
        helpers.stubAddressActivity([]);
        const addresses = [];
        for (let i = 0; i < 2; i++) {
          const address = await util.promisify(server.createAddress).call(server, {});
          addresses.push(address);
        }
        addresses.length.should.equal(2);
        helpers.stubAddressActivity([addresses[1].address]);
        const getAddressActivitySpy = sinon.spy(blockchainExplorer, 'getAddressActivity');
        await util.promisify(server.createAddress).call(server, {});
        await util.promisify(server.createAddress).call(server, {});
        getAddressActivitySpy.callCount.should.equal(1);
      });
    });

    describe('ETH', function() {
      let server;
      let wallet;

      describe('BIP44 livenet', function() {
        beforeEach(async function() {
          ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
        });

        it('should create address ', function(done) {
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            should.exist(address);
            address.walletId.should.equal(wallet.id);
            address.network.should.equal('livenet');
            address.address.should.equal('0xE299d49C2cf9BfaFb7C6E861E80bb8c83f961622');
            address.isChange.should.be.false;
            address.coin.should.equal('eth');
            address.path.should.equal('m/0/0');
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              const notif = notifications.find(n => n.type === 'NewAddress');
              should.exist(notif);
              notif.data.address.should.equal(address.address);
              done();
            });
          });
        });

        it('should not create  new addresses ', function(done) {
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.walletId.should.equal(wallet.id);
            address.network.should.equal('livenet');
            address.address.should.equal('0xE299d49C2cf9BfaFb7C6E861E80bb8c83f961622');
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              should.exist(address);
              address.walletId.should.equal(wallet.id);
              address.network.should.equal('livenet');
              address.path.should.equal('m/0/0');
              address.address.should.equal('0xE299d49C2cf9BfaFb7C6E861E80bb8c83f961622');
              address.isChange.should.be.false;
              address.coin.should.equal('eth');
              done();
            });
          });
        });
      });

      describe('BIP44 testnet (with storage transformation)', function() {
        beforeEach(async function() {
          ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth', network: 'sepolia' }));
        });

        it('should create  addresses', function(done) {
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.walletId.should.equal(wallet.id);
            address.path.should.equal('m/0/0');
            address.network.should.equal('sepolia');
            address.address.should.equal('0xE299d49C2cf9BfaFb7C6E861E80bb8c83f961622');
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              should.exist(address);
              address.walletId.should.equal(wallet.id);
              address.network.should.equal('sepolia');
              address.path.should.equal('m/0/0');
              address.address.should.equal('0xE299d49C2cf9BfaFb7C6E861E80bb8c83f961622');
              address.isChange.should.be.false;
              address.coin.should.equal('eth');

              // main addresses should transfrom addresses
              server.getAddresses({ noChange: true }, function(err, addresses) {
                should.not.exist(err);
                addresses.length.should.equal(1);
                addresses[0].address.should.equal('0xE299d49C2cf9BfaFb7C6E861E80bb8c83f961622');
                done();
              });
            });
          });
        });

        it('should sync  addresses with transformed strings', function(done) {
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.walletId.should.equal(wallet.id);
            address.path.should.equal('m/0/0');
            address.network.should.equal('sepolia');
            address.address.should.equal('0xE299d49C2cf9BfaFb7C6E861E80bb8c83f961622');
            server.syncWallet(wallet, function(err) {
              should.not.exist(err);
              const calls = blockchainExplorer.addAddresses.getCalls();
              calls[0].args[1].should.deep.equal(['0xE299d49C2cf9BfaFb7C6E861E80bb8c83f961622']);
              done();
            });
          });
        });
      });
    });

    describe('XRP', function() {
      let server;
      let wallet;

      describe('BIP44 livenet', function() {
        beforeEach(async function() {
          ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'xrp' }));
        });

        it('should create address ', function(done) {
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            should.exist(address);
            address.walletId.should.equal(wallet.id);
            address.network.should.equal('livenet');
            address.address.should.equal('rLsz9LPd3arEWQ6CsvD839E8c9dkdBopUG');
            address.isChange.should.be.false;
            address.coin.should.equal('xrp');
            address.path.should.equal('m/0/0');
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              const notif = notifications.find(n => n.type === 'NewAddress');
              should.exist(notif);
              notif.data.address.should.equal(address.address);
              done();
            });
          });
        });

        it('should not create  new addresses ', function(done) {
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.walletId.should.equal(wallet.id);
            address.network.should.equal('livenet');
            address.address.should.equal('rLsz9LPd3arEWQ6CsvD839E8c9dkdBopUG');
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              should.exist(address);
              address.walletId.should.equal(wallet.id);
              address.network.should.equal('livenet');
              address.path.should.equal('m/0/0');
              address.address.should.equal('rLsz9LPd3arEWQ6CsvD839E8c9dkdBopUG');
              address.isChange.should.be.false;
              address.coin.should.equal('xrp');
              done();
            });
          });
        });
      });

      describe('BIP44 testnet (with storage transformation)', function() {
        beforeEach(async function() {
          ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'xrp', network: 'testnet' }));
        });

        it('should create  addresses', function(done) {
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.walletId.should.equal(wallet.id);
            address.path.should.equal('m/0/0');
            address.network.should.equal('testnet');
            address.address.should.equal('rLsz9LPd3arEWQ6CsvD839E8c9dkdBopUG');
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              should.exist(address);
              address.walletId.should.equal(wallet.id);
              address.network.should.equal('testnet');
              address.path.should.equal('m/0/0');
              address.address.should.equal('rLsz9LPd3arEWQ6CsvD839E8c9dkdBopUG');
              address.isChange.should.be.false;
              address.coin.should.equal('xrp');

              // main addresses should transfrom addresses
              server.getAddresses({ noChange: true }, function(err, addresses) {
                should.not.exist(err);
                addresses.length.should.equal(1);
                addresses[0].address.should.equal('rLsz9LPd3arEWQ6CsvD839E8c9dkdBopUG');
                done();
              });
            });
          });
        });

        it('should sync  addresses with transformed strings', function(done) {
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.walletId.should.equal(wallet.id);
            address.path.should.equal('m/0/0');
            address.network.should.equal('testnet');
            address.address.should.equal('rLsz9LPd3arEWQ6CsvD839E8c9dkdBopUG');
            server.syncWallet(wallet, function(err) {
              should.not.exist(err);
              const calls = blockchainExplorer.addAddresses.getCalls();
              calls[0].args[1].should.deep.equal(['rLsz9LPd3arEWQ6CsvD839E8c9dkdBopUG']);
              done();
            });
          });
        });
      });
    });
  });



  describe('#getAddresses', function() {
    let server;
    let wallet;
    const numMainAddresses = 5;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 2, {}));
      await helpers.createAddresses(server, wallet, numMainAddresses, 0);
    });

    it('should get all addresses', function(done) {
      server.getAddresses({}, function(err, addresses) {
        should.not.exist(err);
        addresses.length.should.equal(5);
        addresses[0].path.should.equal('m/0/0');
        addresses[4].path.should.equal('m/0/4');
        done();
      });
    });
    it('should get first N addresses', function(done) {
      server.getAddresses({
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
      server.getAddresses({
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

    describe('noChange', function() {
      const numChangeAddresses = 3;

      beforeEach(async function() {
        await helpers.createAddresses(server, wallet, 0, numChangeAddresses);
      });

      it('should get all addresses', function(done) {
        server.getAddresses({}, function(err, addresses) {
          should.not.exist(err);
          addresses.length.should.equal(numMainAddresses + numChangeAddresses);
          addresses.some(addr => !addr.isChange).should.be.true;
          addresses.some(addr => addr.isChange).should.be.true;
          done();
        });
      });

      it('should get main addresses', function(done) {
        server.getAddresses({ noChange: true }, function(err, addresses) {
          should.not.exist(err);
          addresses.length.should.equal(numMainAddresses);
          addresses.some(addr => !addr.isChange).should.be.true;
          addresses.some(addr => addr.isChange).should.be.false;
          done();
        });
      });
    });
  });

  describe('Preferences tokens', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
    });

    it('should save & retrieve preferences', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com',
        language: 'es',
        unit: 'bit',
        dummy: 'ignored',
        tokenAddresses: TOKENS,
      }, function(err) {
        should.not.exist(err);
        server.getPreferences({}, function(err, preferences) {
          should.not.exist(err);
          should.exist(preferences);
          preferences.email.should.equal('dummy@dummy.com');
          preferences.language.should.equal('es');
          preferences.unit.should.equal('bit');
          preferences.tokenAddresses.should.deep.equal(TOKENS);
          should.not.exist(preferences.dummy);
          done();
        });
      });
    });


    it('should concatenate token preferences', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com',
        language: 'es',
        unit: 'bit',
        dummy: 'ignored',
        tokenAddresses: [TOKENS[0]],
      }, function(err) {
        should.not.exist(err);
        server.getPreferences({}, function(err, preferences) {
          should.not.exist(err);
          preferences.tokenAddresses.should.deep.equal([TOKENS[0]]);
          server.savePreferences({
            email: 'dummy@dummy.com',
            language: 'es',
            unit: 'bit',
            dummy: 'ignored',
            tokenAddresses: [TOKENS[1]],
          }, function(err) {
            server.getPreferences({}, function(err, preferences) {
              should.not.exist(err);
              should.exist(preferences);
              preferences.email.should.equal('dummy@dummy.com');
              preferences.language.should.equal('es');
              preferences.unit.should.equal('bit');
              preferences.tokenAddresses.should.deep.equal(TOKENS);
              should.not.exist(preferences.dummy);
              done();
            });
          });
        });
      });
    });

    it('should concatenate token preferences (case2)', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com',
        language: 'es',
        unit: 'bit',
        dummy: 'ignored',
        tokenAddresses: [TOKENS[0]],
      }, function(err) {
        should.not.exist(err);
        server.getPreferences({}, function(err, preferences) {
          should.not.exist(err);
          preferences.tokenAddresses.should.deep.equal([TOKENS[0]]);
          server.savePreferences({
            email: 'dummy@dummy.com',
            language: 'es',
            unit: 'bit',
            dummy: 'ignored',
            tokenAddresses: TOKENS,
          }, function(err) {
            server.getPreferences({}, function(err, preferences) {
              should.not.exist(err);
              should.exist(preferences);
              preferences.email.should.equal('dummy@dummy.com');
              preferences.language.should.equal('es');
              preferences.unit.should.equal('bit');
              preferences.tokenAddresses.should.deep.equal(TOKENS);
              should.not.exist(preferences.dummy);
              done();
            });
          });
        });
      });
    });
  });


  describe('Preferences', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 2));
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

    it('should fail to save wrong preferences', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com',
        tokenAddresses: ['hola'],
      }, function(err) {
        err.message.toString().should.contain('tokenAddresses');
        done();
      });
    });

    it('should save preferences only for requesting copayer', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com'
      }, function(err) {
        should.not.exist(err);
        helpers.getAuthServer(wallet.copayers[1].id).then(function(server2) {
          server2.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.not.exist(preferences.email);
            done();
          });
        });
      });
    });
    it('should save preferences incrementally', async function() {
      await util.promisify(server.savePreferences).call(server, {
        email: 'dummy@dummy.com',
      });
      let preferences = await util.promisify(server.getPreferences).call(server, {});
      should.exist(preferences);
      preferences.email.should.equal('dummy@dummy.com');
      should.not.exist(preferences.language);

      await util.promisify(server.savePreferences).call(server, { language: 'es' });
      preferences = await util.promisify(server.getPreferences).call(server, {});
      should.exist(preferences);
      preferences.email.should.equal('dummy@dummy.com');
      preferences.language.should.equal('es');

      await util.promisify(server.savePreferences).call(server, {
        language: null,
        unit: 'bit',
      });
      preferences = await util.promisify(server.getPreferences).call(server, {});
      should.exist(preferences);
      preferences.email.should.equal('dummy@dummy.com');
      should.not.exist(preferences.language);
      preferences.unit.should.equal('bit');
    });

    it.skip('should save preferences only for requesting wallet', function(done) { });

    it('should validate entries', async function() {
      const invalid = [{
        preferences: {
          email: ' ',
        },
        expected: 'email'
      }, {
        preferences: {
          email: 'dummy@' + new Array(50).fill('domain').join(''),
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
      },];

      for (const item of invalid) {
        try {
          await util.promisify(server.savePreferences).call(server, item.preferences);
          throw new Error('should have thrown');
        } catch (err) {
          const regex = new RegExp(item.expected, 'gm');
          err.message.should.match(regex);
        }
      }
    });
  });

  describe('#getUtxos', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
    });

    it('should get UTXOs for wallet addresses', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
        server.getUtxos({}, function(err, utxos) {
          should.not.exist(err);
          should.exist(utxos);
          utxos.length.should.equal(2);
          utxos.reduce((sum, u) => sum += u.satoshis, 0).should.equal(3 * 1e8);
          server.getAddresses({ noChange: true }, function(err, addresses) {
            const utxo = utxos[0];
            const address = addresses.find(a => a.address === utxo.address);
            should.exist(address);
            utxo.path.should.equal(address.path);
            utxo.publicKeys.should.deep.equal(address.publicKeys);
            done();
          });
        });
      });
    });


    it('should get UTXOs for wallet addresses', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
        server.getUtxos({}, function(err, utxos) {
          should.not.exist(err);
          should.exist(utxos);
          utxos.length.should.equal(2);
          utxos.reduce((sum, u) => sum += u.satoshis, 0).should.equal(3 * 1e8);
          server.getAddresses({ noChange: true }, function(err, addresses) {
            const utxo = utxos[0];
            const address = addresses.find(a => a.address === utxo.address);
            should.exist(address);
            utxo.path.should.equal(address.path);
            utxo.publicKeys.should.deep.equal(address.publicKeys);
            done();
          });
        });
      });
    });

    it('should return empty UTXOs for specific addresses if network mismatch', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2, 3]).then(function(utxos) {
        new Set(utxos.map(u => u.address)).size.should.be.above(1); // >1 unique address
        server.getUtxos({
          addresses: ['mrM5kMkqZccK5MxZYSsM3SjqdMaNKLJgrJ']
        }, function(err, utxos) {
          should.not.exist(err);
          utxos.should.be.empty;
          done();
        });
      });
    });
    it('should return empty UTXOs for specific addresses if coin mismatch', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2, 3]).then(function(utxos) {
        new Set(utxos.map(u => u.address)).size.should.be.above(1); // >1 unique address
        server.getUtxos({
          addresses: ['CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X']
        }, function(err, utxos) {
          should.not.exist(err);
          utxos.should.be.empty;
          done();
        });
      });
    });

    it('should  get UTXOs for specific addresses', function(done) {
      server.createAddress({}, function(err, address) {
        helpers.stubUtxos(server, wallet, [1, 2, 3], { addresses: [address] }).then(function(utxos) {
          server.getUtxos({
            addresses: [address.address]
          }, function(err, utxos) {
            utxos.length.should.equal(3);
            done();
          });
        });
      });
    });
    it('should not fail when getting UTXOs for wallet with 0 UTXOs and pending txps', function(done) {
      helpers.stubUtxos(server, wallet, [1, 1]).then(function() {
        const txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 1e8,
          }],
          feePerKb: 100e2,
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(txp) {
          blockchainExplorer.getUtxos = function(addresses, height, cb) {
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


    it('should skip dust UTXOs ', function(done) {
      helpers.stubUtxos(server, wallet, ['1 sat', 2, '10 sat', '100 sat', '1000 sat']).then(function() {
        server.getUtxos({}, function(err, utxos) {
          should.not.exist(err);
          should.exist(utxos);
          utxos.length.should.equal(2);
          utxos.reduce((sum, u) => sum += u.satoshis, 0).should.equal(2 * 1e8 + 1000);
          server.getAddresses({ noChange: true }, function(err, addresses) {
            const utxo = utxos[0];
            const address = addresses.find(a => a.address === utxo.address);
            should.exist(address);
            utxo.path.should.equal(address.path);
            utxo.publicKeys.should.deep.equal(address.publicKeys);
            done();
          });
        });
      });
    });

    it('should report no UTXOs if only dust', function(done) {
      helpers.stubUtxos(server, wallet, ['1 sat', '10 sat', '100 sat', '500 sat']).then(function() {
        server.getUtxos({}, function(err, utxos) {
          should.not.exist(err);
          should.exist(utxos);
          utxos.length.should.equal(0);
          utxos.reduce((sum, u) => sum += u.satoshis, 0).should.equal(0);
          done();
        });
      });
    });
  });



  describe('Multiple request Pub Keys', function() {
    let server;
    let wallet;
    let opts;
    let reqPrivKey;
    let ws;

    function getAuthServer(copayerId, privKey, cb) {
      const msg = 'dummy';
      const sig = helpers.signMessage(msg, privKey);
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
      const requestPubKey = reqPrivKey.toPublicKey();
      const xPrivKey = TestData.copayers[0].xPrivKey_44H_0H_0H;
      const requestPubKeyStr = requestPubKey.toString();
      const sig = helpers.signRequestPubKey(requestPubKeyStr, xPrivKey);
      const copayerId = Model.Copayer.xPubToCopayerId('btc', TestData.copayers[0].xPubKey_44H_0H_0H);
      opts = {
        copayerId: copayerId,
        requestPubKey: requestPubKeyStr,
        signature: sig,
      };
      ws = new WalletService();
    });

    describe('#addAccess 1-1', function() {
      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
        await helpers.stubUtxos(server, wallet, 1);
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
          err.should.be.instanceof(ClientError);
          err.code.should.equal('NOT_AUTHORIZED');
          done();
        });
      });

      it('should fail to access with wrong privkey after gaining access', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          server.getBalance(res.wallet.walletId, function(err, bal) {
            should.not.exist(err);
            const privKey = new Bitcore.PrivateKey();
            getAuthServer(opts.copayerId, privKey, function(err, server2) {
              err.should.be.instanceof(ClientError);
              err.code.should.equal('NOT_AUTHORIZED');
              done();
            });
          });
        });
      });

      it('should be able to create TXs after regaining access', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {
            const txOpts = {
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
      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(2, 2));
        await helpers.stubUtxos(server, wallet, 1);
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
            const txOpts = {
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 0.8e8
              }],
              feePerKb: 100e2,
            };
            helpers.createAndPublishTx(server, txOpts, reqPrivKey).then(function() {
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
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
    });

    it('should get balance', function(done) {
      helpers.stubUtxos(server, wallet, [1, 'u2', 3]).then(function() {
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
          server.getAddresses({ noChange: true }, function(err, addresses) {
            should.not.exist(err);
            addresses = new Set(addresses.map(a => a.address));
            addresses.intersection(new Set(balance.byAddress.map(a => a.address))).size.should.equal(2);
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
      blockchainExplorer.getUtxos = sinon.stub().callsArgWith(2, null, []);
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
      helpers.stubUtxos(server, wallet, 1).then(function(utxos) {
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
      blockchainExplorer.getUtxos = sinon.stub().callsArgWith(2, 'dummy error');
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
      helpers.stubUtxos(server, wallet, 1).then(function() {
        const spy = sinon.spy(server, '_getBlockchainExplorer');
        server.getBalance({
          coin: 'bch'
        }, function(err, balance) {
          err.message.should.contain('not longer supported');
          done();
        });
      });
    });
  });

  describe('#getFeeLevels', function() {
    let server;
    let wallet;
    let clock;

    beforeEach(async function() {
      sinon.stub(Defaults, 'FEE_LEVELS').value({
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
      });
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
      clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
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
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
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
        fees = Object.fromEntries(fees.map(item => [item.level, item.feePerKb]));
        const defaults = Object.fromEntries(Defaults.FEE_LEVELS['btc'].map(item => [item.name, item.defaultValue]));
        fees.priority.should.equal(defaults.priority);
        fees.normal.should.equal(defaults.normal);
        fees.economy.should.equal(defaults.economy);
        done();
      });
    });

    it('should get old fee levels after fail', function(done) {
      sinon.stub(Defaults, 'FEE_LEVEL_CACHE_DURATION').value(0);
      helpers.stubFeeLevels({
        1: 40002,
        2: 20000,
        6: 18000,
        24: 9001,
      }, true);
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
        fees.urgent.feePerKb.should.equal(60003);
        blockchainExplorer.estimateFee = sinon.stub().yields('dummy error');
        server.getFeeLevels({}, function(err, fees) {
          should.not.exist(err);
          fees = Object.fromEntries(fees.map(item => [item.level, item]));
          fees.urgent.feePerKb.should.equal(60003);
          fees.superEconomy.feePerKb.should.equal(9001);
          done();
        });
      });
    });

    it('should get not cache old fee levels after fail', function(done) {
      sinon.stub(Defaults, 'FEE_LEVEL_CACHE_DURATION').value(0);
      helpers.stubFeeLevels({
        1: 40002,
        2: 20000,
        6: 18000,
        24: 9001,
      }, true);
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
        fees.urgent.feePerKb.should.equal(60003);
        blockchainExplorer.estimateFee = sinon.stub().yields('dummy error');
        server.getFeeLevels({}, function(err, fees) {
          should.not.exist(err);
          fees = Utils.fromPairs(fees.map(item => [item.level, item]));
          fees.urgent.feePerKb.should.equal(60003);
          fees.superEconomy.feePerKb.should.equal(9001);

          helpers.stubFeeLevels({
            1: 400,
            2: 200,
            6: 180,
            24: 90,
          }, true);
          server.getFeeLevels({}, function(err, fees) {
            should.not.exist(err);
            fees = Object.fromEntries(fees.map(item => [item.level, item]));
            fees.urgent.feePerKb.should.equal(600);
            fees.superEconomy.feePerKb.should.equal(90);
            done();
          });
        });
      });
    });

    it('should not store cache old fee levels after 1+ fail', function(done) {
      sinon.stub(Defaults, 'FEE_LEVEL_CACHE_DURATION').value(100);
      helpers.stubFeeLevels({
        1: -1,
        2: -1,
        6: 200,
        24: 101,
      }, true);
      server.getFeeLevels({}, function(err, fees, cached) {
        should.not.exist(err);
        should.not.exist(cached);
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
        // should use default value because value and fallback = -1
        fees.priority.feePerKb.should.equal(
          Defaults.FEE_LEVELS.btc[1].defaultValue
        );
        // using the given value
        fees.superEconomy.feePerKb.should.equal(101);
        helpers.stubFeeLevels({
          1: 400,
          2: 200,
          6: 180,
          24: 90,
        }, true);
        // should query again, NOT using cache.
        server.getFeeLevels({}, function(err, fees, cached) {
          should.not.exist(cached);
          should.not.exist(err);
          fees = Object.fromEntries(fees.map(item => [item.level, item]));
          fees.urgent.feePerKb.should.equal(600);
          fees.superEconomy.feePerKb.should.equal(90);
          // now, it should be cached.
          server.getFeeLevels({}, function(err, fees, cached) {
            should.exist(cached);
            done();
          });
        });
      });
    });

    it('should not store cache old fee levels after 1+ fail (Case 2)', function(done) {
      sinon.stub(Defaults, 'FEE_LEVEL_CACHE_DURATION').value(100);
      //  not given values will fail
      helpers.stubFeeLevels({
        6: 200,
        24: 101,
      });
      server.getFeeLevels({}, function(err, fees, cached) {
        should.not.exist(err);
        should.not.exist(cached);
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
        // should use default value because value and fallback = -1
        fees.priority.feePerKb.should.equal(
          Defaults.FEE_LEVELS.btc[1].defaultValue
        );
        // using the given value
        fees.superEconomy.feePerKb.should.equal(101);
        helpers.stubFeeLevels({
          1: 400,
          2: 200,
          6: 180,
          24: 90,
        }, true);
        // should query again, NOT using cache.
        server.getFeeLevels({}, function(err, fees, cached) {
          should.not.exist(cached);
          should.not.exist(err);
          fees = Object.fromEntries(fees.map(item => [item.level, item]));
          fees.urgent.feePerKb.should.equal(600);
          fees.superEconomy.feePerKb.should.equal(90);
          // now, it should be cached.
          server.getFeeLevels({}, function(err, fees, cached) {
            should.exist(cached);
            done();
          });
        });
      });
    });

    it('should STORE cache old fee levels if NO fail', function(done) {
      sinon.stub(Defaults, 'FEE_LEVEL_CACHE_DURATION').value(100);
      helpers.stubFeeLevels({
        1: 500,
        2: 400,
        6: 200,
        24: 101,
      }, true);
      server.getFeeLevels({}, function(err, fees, cached) {
        should.not.exist(err);
        should.not.exist(cached);
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
        // using the given value
        fees.priority.feePerKb.should.equal(500);
        fees.superEconomy.feePerKb.should.equal(101);
        helpers.stubFeeLevels({
          1: 400,
          2: 200,
          6: 180,
          24: 90,
        }, true);
        // should USE cache.
        server.getFeeLevels({}, function(err, fees, cached) {
          should.not.exist(err);
          should.exist(cached);
          fees = Object.fromEntries(fees.map(item => [item.level, item]));
          // old cached values
          fees.urgent.feePerKb.should.equal(750);
          fees.superEconomy.feePerKb.should.equal(101);
          done();
        });
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
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
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
        fees = Object.fromEntries(fees.map(item => [item.level, item]));

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
      Defaults.FEE_LEVELS['btc'].find(lvl => lvl.nbBlocks === 6).defaultValue.should.equal(25000);
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
        fees = Object.fromEntries(fees.map(item => [item.level, item]));

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
      }, true);
      server.getFeeLevels({}, function(err, fees, fromCache) {
        should.not.exist(err);
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
        fees.urgent.feePerKb.should.equal(60000);
        fees.priority.feePerKb.should.equal(40000);
        should.not.exist(fromCache);
        server.getFeeLevels({}, function(err, fees, fromCache) {
          should.not.exist(err);
          fees = Object.fromEntries(fees.map(item => [item.level, item]));
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
        fees = Object.fromEntries(fees.map(item => [item.level, item]));
        fees.urgent.feePerKb.should.equal(60000);
        fees.priority.feePerKb.should.equal(40000);
        should.not.exist(fromCache);
        clock.tick(31 * 60 * 1000);
        server.getFeeLevels({}, function(err, fees, fromCache) {
          should.not.exist(err);
          fees = Object.fromEntries(fees.map(item => [item.level, item]));
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
        server.getFeeLevels({ coin: 'bch' }, function(err, fees, fromCache) {
          should.not.exist(err);
          should.not.exist(fromCache);
          server.getFeeLevels({ coin: 'bch', network: 'testnet3' }, function(err, fees, fromCache) {
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
      const server = new WalletService();
      const walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_45H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId).then(function(server) {
            server.createAddress({}, function(err, address) {
              should.not.exist(address);
              should.exist(err);
              err.should.be.instanceof(ClientError);
              err.code.should.equal('WALLET_NOT_COMPLETE');
              err.message.should.equal('Wallet is not complete');
              done();
            });
          });
        });
      });
    });

    it('should fail to create tx when wallet is not complete', function(done) {
      const server = new WalletService();
      const walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_45H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId).then(function(server) {
            const txOpts = {
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 0.8e8
              }],
              feePerKb: 100e2
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(tx);
              should.exist(err);
              err.should.be.instanceof(ClientError);
              err.code.should.equal('WALLET_NOT_COMPLETE');
              done();
            });
          });
        });
      });
    });
  });

  describe('Network suspended tests', function() {
    let configStub;

    beforeEach(function() {
      configStub = sinon.stub(config, 'suspendedChains');
    });

    it('should fail to create tx when wallet is BCH and suspendedChains includes bch', function(done) {
      configStub.value(['bch', 'xrp']);

      const server = new WalletService();
      const walletOpts = {
        coin: 'bch',
        name: 'my wallet',
        m: 1,
        n: 1,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        const copayerOpts = helpers.getSignedCopayerOpts({
          coin: 'bch',
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_44H_0H_0H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId).then(function(server) {
            const txOpts = {
              outputs: [{
                toAddress: 'qz0d6gueltx0feta7z9777yk97sz9p6peu98mg5vac',
                amount: 0.8e8
              }],
              feePerKb: 100e2
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(tx);
              should.exist(err);
              err.should.be.instanceof(ClientError);
              err.code.should.equal('NETWORK_SUSPENDED');
              err.message.should.include('BCH');
              done();
            });
          });
        });
      });
    });
  });

  const testSet = [
    {
      coin: 'btc',
      key: 'id44btc',
      addr: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
      lockedFunds: 0,
      flags: {},
    },
    {
      coin: 'bch',
      key: 'id44bch',
      addr: 'qpgjyj728rhu4gca2dqfzlpl8acnhzequshhgvev53',
      lockedFunds: 0,
      flags: {},
    },
    {
      coin: 'bch',
      key: 'id44bch',
      addr: 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X',
      lockedFunds: 0,
      flags: { noCashAddr: true },
    },
    {
      coin: 'eth',
      key: 'id44btc',
      addr: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
      lockedFunds: 0,
      flags: { noChange: true, noUtxoTests: true, },
    },
    {
      coin: 'xrp',
      key: 'id44btc',
      addr: 'rDzTZxa7NwD9vmNf5dvTbW4FQDNSRsfPv6',
      lockedFunds: Defaults.MIN_XRP_BALANCE,
      flags: { noChange: true, noUtxoTests: true },
    },
    {
      coin: 'doge',
      key: 'id44btc',
      addr: 'DTZ1W1qmXM9w4xJa9MMp2cAjdQv4PWSs9V',
      lockedFunds: 0,
      flags: {},
    },
    {
      coin: 'ltc',
      key: 'id44btc',
      addr: 'LUDZDsJHVwgZBc5HdfbbBgqU6hJZwWNseV',
      lockedFunds: 0,
      flags: {},
    }
  ];

  for (const x of testSet) {

    const coin = x.coin;
    const ts = TO_SAT[coin];
    const idKey = x.key;
    const addressStr = x.addr;
    const flags = x.flags;
    const lockedFunds = x.lockedFunds;
    let fromAddr;

    describe(`#createTx ${coin} flags ${JSON.stringify(flags)}`, function() {
      describe(`Tx proposal creation & publishing ${coin}`, function() {
        let server;
        let wallet;

        beforeEach(async function() {
          ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin }));
          fromAddr = null;
          const address = await util.promisify(server.createAddress).call(server, {});
          fromAddr = address.address;
        });
        
        it('should create a tx', function(done) {
          helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
            const coinAmount = {
              btc: 8000,
              bch: 8000,
              eth: 8000,
              xrp: 8000,
              doge: 1e8,
              ltc: 8000
            };
            const amount = coinAmount[coin];
            const txOpts = Object.assign({
              outputs: [{
                toAddress: addressStr,
                amount: amount,
              }],
              message: 'some message',
              customData: 'some custom data',
              feePerKb: 123e2,
              from: fromAddr,
            }, flags);

            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              tx.walletM.should.equal(1);
              tx.walletN.should.equal(1);
              tx.requiredRejections.should.equal(1);
              tx.requiredSignatures.should.equal(1);
              tx.isAccepted().should.be.false;
              tx.isRejected().should.be.false;
              tx.isPending().should.be.false;
              tx.isTemporary().should.be.true;
              tx.amount.should.equal(coinAmount[coin]);
              tx.feePerKb.should.equal(123e2);
              tx.outputs[0].toAddress.should.equal(addressStr);
              tx.outputs[0].amount.should.equal(amount);

              if (coin == 'eth') {
                tx.gasPrice.should.equal(12300);
                tx.nonce.should.equal('5');
                tx.outputs.should.deep.equal([{
                  toAddress: addressStr,
                  gasLimit: 21000,
                  amount: amount,
                }]);
              }

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
            helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
              const txOpts = Object.assign({
                outputs: [],
                feePerKb: 123e2,
              }, flags);
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                should.not.exist(tx);
                err.message.should.equal('No outputs were specified');
                done();
              });
            });
          });

          it('should fail to create tx for invalid address', function(done) {
            helpers.stubUtxos(server, wallet, 1).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: 'invalid address',
                  amount: 1e8
                }],
                feePerKb: 100e2,
              }, flags);
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                should.not.exist(tx);
                // may fail due to Non-base58 character, or Checksum mismatch, or other
                done();
              });
            });
          });

          if (['btc', 'bch', 'doge', 'ltc'].includes(coin)) {
            const coinAmount = {
              btc: 8000,
              bch: 8000,
              doge: 1e8,
              ltc: 8000
            };

            it(`should not fail to create ${coin} tx with valid OP_RETURN script and amount`, function(done) {
              helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
                const amount = coinAmount[coin];
                const testScript = '6a423d3a4554482e555344433a3078466231343633393239633337414531334533624232343337413330633039423239373031323732313a36303335373834393136373a743a3330';
                const txOpts = Object.assign({
                  outputs: [{
                    toAddress: addressStr,
                    amount: amount,
                  },
                  {
                    script: testScript,
                    amount: 0,
                  }],
                  message: 'some message',
                  customData: 'some custom data',
                  feePerKb: 123e2,
                  from: fromAddr,
                }, flags);

                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(err);
                  should.exist(tx);
                  tx.walletM.should.equal(1);
                  tx.walletN.should.equal(1);
                  tx.requiredRejections.should.equal(1);
                  tx.requiredSignatures.should.equal(1);
                  tx.isAccepted().should.be.false;
                  tx.isRejected().should.be.false;
                  tx.isPending().should.be.false;
                  tx.isTemporary().should.be.true;
                  tx.amount.should.equal(coinAmount[coin]);
                  tx.feePerKb.should.equal(123e2);
                  tx.outputs[0].toAddress.should.equal(addressStr);
                  tx.outputs[0].amount.should.equal(amount);
                  tx.outputs[1].script.should.equal(testScript);
                  tx.outputs[1].amount.should.equal(0);

                  should.not.exist(tx.feeLevel);
                  server.getPendingTxs({}, function(err, txs) {
                    should.not.exist(err);
                    txs.should.be.empty;
                    done();
                  });
                });
              });
            });

            it(`should fail to create ${coin} tx for invalid amount`, function(done) {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 0,
                }],
                feePerKb: 100e2,
              }, flags);
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(tx);
                should.exist(err);
                err.message.should.equal('Invalid amount');
                done();
              });
            });

            it(`should fail to create ${coin} tx with a script other than OP_RETURN`, function(done) {
              helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
                const txOpts = Object.assign({
                  outputs: [
                    {
                      toAddress: addressStr,
                      amount: coinAmount[coin],
                    },
                    {
                      script: '76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac',
                      amount: 5000000000,
                    }],
                  feePerKb: 100e2,
                }, flags);
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(tx);
                  should.exist(err);
                  err.message.should.equal('The only supported script is OP_RETURN');
                  done();
                });
              });
            });

            it(`should fail to create ${coin} tx with OP_RETURN script and invalid amount`, function(done) {
              helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
                const txOpts = Object.assign({
                  outputs: [
                    {
                      toAddress: addressStr,
                      amount: coinAmount[coin],
                    },
                    {
                      script: '6a423d3a4554482e555344433a3078466231343633393239633337414531334533624232343337413330633039423239373031323732313a36303335373834393136373a743a3330',
                      amount: 10,
                    }],
                  feePerKb: 100e2,
                }, flags);
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(tx);
                  should.exist(err);
                  err.message.should.equal('The amount of an output with OP_RETURN script must be 0');
                  done();
                });
              });
            });

            it(`should fail to create ${coin} tx with wrong data type of OP_RETURN script`, function(done) {
              helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
                const txOpts = Object.assign({
                  outputs: [
                    {
                      toAddress: addressStr,
                      amount: coinAmount[coin],
                    },
                    {
                      script: 123,
                      amount: 0,
                    }],
                  feePerKb: 100e2,
                }, flags);
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(tx);
                  should.exist(err);
                  err.message.should.equal('Script must be a valid data type');
                  done();
                });
              });
            });

            it(`should fail to create ${coin} tx with an output with invalid script and valid data type`, function(done) {
              helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
                const txOpts = Object.assign({
                  outputs: [
                    {
                      toAddress: addressStr,
                      amount: coinAmount[coin],
                    },
                    {
                      script: 'wrong script',
                      amount: 0,
                    }],
                  feePerKb: 100e2,
                }, flags);
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(tx);
                  should.exist(err);
                  err.message.should.equal('The only supported script is OP_RETURN');
                  done();
                });
              });
            });
          } else if (coin === 'eth') {
            it('should not fail to create ETH chain based tx for 0 amount', function(done) {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 0,
                }],
                feePerKb: 2000000000,
              }, flags);
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                should.exist(tx);
                done();
              });
            });
          }
          it('should fail to specify both feeLevel & feePerKb', function(done) {
            helpers.stubUtxos(server, wallet, 2).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
                feeLevel: 'normal',
                feePerKb: 123e2,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.exist(err);
                should.not.exist(txp);
                err.toString().should.contain('Only one of feeLevel/feePerKb');
                done();
              });
            });
          });


          if (!flags.noUtxoTests) {
            it('should fail to create tx for address of different network', function(done) {
              helpers.stubUtxos(server, wallet, 1).then(function() {
                const txOpts = Object.assign({
                  outputs: [{
                    toAddress: 'myE38JHdxmQcTJGP1ZiX4BiGhDxMJDvLJD',
                    amount: 1e8
                  }],
                  feePerKb: 100e2,
                }, flags);
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(tx);
                  should.exist(err);
                  err.should.be.instanceof(ClientError);
                  err.code.should.equal('INCORRECT_ADDRESS_NETWORK');
                  err.message.should.equal('Incorrect address network');
                  done();
                });
              });
            });
            it('should be able to create tx with inputs argument', function(done) {
              helpers.stubUtxos(server, wallet, [1, 3, 2]).then(function(utxos) {
                server.getUtxos({}, function(err, utxos) {
                  should.not.exist(err);
                  const inputs = [utxos[0], utxos[2]];
                  const txOpts = Object.assign({
                    outputs: [{
                      toAddress: addressStr,
                      amount: 1e8,
                    }],
                    feePerKb: 100e2,
                    inputs: inputs,
                  }, flags);
                  server.createTx(txOpts, function(err, tx) {
                    should.not.exist(err);
                    should.exist(tx);
                    tx.inputs.length.should.equal(2);
                    const txids = tx.inputs.map(i => i.txid);
                    txids.should.contain(utxos[0].txid);
                    txids.should.contain(utxos[2].txid);
                    done();
                  });
                });
              });
            });
            if (coin !== 'doge') { // TODO
              it('should be able to specify change address', function(done) {
                helpers.stubUtxos(server, wallet, [1, 2]).then(function(utxos) {
                  const txOpts = Object.assign({
                    outputs: [{
                      toAddress: addressStr,
                      amount: 0.8e8,
                    }],
                    feePerKb: 100e2,
                    changeAddress: utxos[0].address,
                  }, flags);
                  server.createTx(txOpts, function(err, tx) {
                    should.not.exist(err);
                    should.exist(tx);
                    const t = ChainService.getBitcoreTx(tx);

                    t.getChangeOutput().script.toAddress().toString(true).should.equal(txOpts.changeAddress);
                    done();
                  });
                });
              });
            }
            it('should be fail if specified change address is not from the wallet', function(done) {
              helpers.stubUtxos(server, wallet, [1, 2]).then(function(utxos) {
                const addr = new Bitcore_[coin].PrivateKey().publicKey.toAddress();
                const txOpts = Object.assign({
                  outputs: [{
                    toAddress: addressStr,
                    amount: 1e8,
                  }],
                  feePerKb: 100e2,
                  changeAddress: addr.toString(true),
                }, flags);
                server.createTx(txOpts, function(err, tx) {
                  should.exist(err);
                  err.should.be.instanceof(ClientError);
                  err.code.should.equal('INVALID_CHANGE_ADDRESS');
                  done();
                });
              });
            });

            it('should be able to specify inputs & absolute fee', function(done) {
              helpers.stubUtxos(server, wallet, [1, 2]).then(function(utxos) {
                const txOpts = Object.assign({
                  outputs: [{
                    toAddress: addressStr,
                    amount: 1e8,
                  }],
                  inputs: utxos,
                  fee: 1000e2,
                }, flags);
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(err);
                  should.exist(tx);
                  tx.amount.should.equal(helpers.toSatoshi(1));
                  should.not.exist(tx.feePerKb);
                  tx.fee.should.equal(1000e2);
                  const t = ChainService.getBitcoreTx(tx);
                  t.getFee().should.equal(1000e2);
                  t.getChangeOutput().satoshis.should.equal(3e8 - 1e8 - 1000e2);
                  done();
                });
              });
            });
          }
        });

        describe('Foreign ID', function() {
          it('should create a tx with foreign ID', function(done) {
            helpers.stubUtxos(server, wallet, 2).then(function() {
              const txOpts = Object.assign({
                txProposalId: '123',
                outputs: [{
                  toAddress: addressStr,
                  amount: 1 * ts,
                }],
                feePerKb: 100e2,
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                should.exist(tx);
                tx.id.should.equal('123');
                done();
              });
            });
          });
          it('should return already created tx if same foreign ID is specified and tx still unpublished', function(done) {
            helpers.stubUtxos(server, wallet, 2).then(function() {
              const txOpts = Object.assign({
                txProposalId: '123',
                outputs: [{
                  toAddress: addressStr,
                  amount: 1 * ts,
                }],
                feePerKb: 100e2,
                from: fromAddr,
              }, flags);
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
            helpers.stubUtxos(server, wallet, [2, 2, 2]).then(function() {
              const txOpts = Object.assign({
                txProposalId: '123',
                outputs: [{
                  toAddress: addressStr,
                  amount: 1 * ts,
                }],
                feePerKb: 100e2,
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                should.exist(tx);
                tx.id.should.equal('123');
                const publishOpts = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
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
            helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 1 * ts,
                }],
                feePerKb: 100e2,
                message: 'some message',
                customData: 'some custom data',
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                const publishOpts = helpers.getProposalSignatureOpts(txp, TestData.copayers[0].privKey_1H_0);
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
            helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 1 * ts,
                }],
                feePerKb: 100e2,
                dryRun: true,
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                const publishOpts = helpers.getProposalSignatureOpts(txp, TestData.copayers[0].privKey_1H_0);
                server.publishTx(publishOpts, function(err) {
                  should.exist(err);
                  err.should.be.instanceof(ClientError);
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
            helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 1 * ts,
                }],
                feePerKb: 100e2,
                message: 'some message',
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                server.getNotifications({}, function(err, notifications) {
                  should.not.exist(err);
                  notifications.map(n => n.type).should.not.contain('NewTxProposal');
                  const publishOpts = helpers.getProposalSignatureOpts(txp, TestData.copayers[0].privKey_1H_0);
                  server.publishTx(publishOpts, function(err) {
                    should.not.exist(err);
                    server.getNotifications({}, function(err, notifications) {
                      should.not.exist(err);
                      const n = notifications.find(n => n.type === 'NewTxProposal');
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
            helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 1 * ts,
                }],
                feePerKb: 100e2,
                message: 'some message',
                from: fromAddr,
              }, flags);
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
            helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 1 * ts,
                }],
                feePerKb: 100e2,
                message: 'some message',
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                const publishOpts = {
                  txProposalId: txp.id,
                  proposalSignature: helpers.signMessage(txp.getRawTx(), TestData.copayers[1].privKey_1H_0),
                };
                server.publishTx(publishOpts, function(err) {
                  should.exist(err);
                  err.message.should.contain('Invalid proposal signature');
                  done();
                });
              });
            });
          });

          if (!flags.noUtxoTests) {
            it('should fail to publish a temporary tx proposal if utxos are locked by other pending proposals', async function() {
              const coinAmount = {
                btc: 0.8,
                bch: 0.8,
                eth: 0.8,
                xrp: 0.8,
                doge: 1,
                ltc: 0.8
              };
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: coinAmount[coin] * ts,
                }],
                message: 'some message',
                feePerKb: 100e2,
                from: fromAddr,
              }, flags);
              await helpers.stubUtxos(server, wallet, [2, 2]);
              let txp1 = await util.promisify(server.createTx).call(server, txOpts);
              const txp2 = await util.promisify(server.createTx).call(server, txOpts);
              should.exist(txp1);
              should.exist(txp2);
              let publishOpts = helpers.getProposalSignatureOpts(txp1, TestData.copayers[0].privKey_1H_0);
              txp1 = await util.promisify(server.publishTx).call(server, publishOpts);
              publishOpts = helpers.getProposalSignatureOpts(txp2, TestData.copayers[0].privKey_1H_0);
              try {
                await util.promisify(server.publishTx).call(server, publishOpts);
                throw new Error('should have thrown');
              } catch (err) {
                err.should.be.instanceof(ClientError);
                err.code.should.equal('UNAVAILABLE_UTXOS');
              }              
              let txs = await util.promisify(server.getPendingTxs).call(server, {});
              txs.length.should.equal(1);
              // A new tx proposal should use the next available UTXO
              let txp3 = await util.promisify(server.createTx).call(server, txOpts);
              should.exist(txp3);
              publishOpts = helpers.getProposalSignatureOpts(txp3, TestData.copayers[0].privKey_1H_0);
              txp3 = await util.promisify(server.publishTx).call(server, publishOpts);
              txs = await util.promisify(server.getPendingTxs).call(server, {});
              txs.length.should.equal(2);              
            });

            it('should fail to publish a temporary tx proposal if utxos are already spent', async function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 1e8,
                }],
                message: 'some message',
                feePerKb: 100e2,
              }, flags);
              await helpers.stubUtxos(server, wallet, [1, 2]);
              let txp1 = await util.promisify(server.createTx).call(server, txOpts);
              const txp2 = await util.promisify(server.createTx).call(server, txOpts);
              should.exist(txp1);
              should.exist(txp2);
              
              // Sign & Broadcast txp1
              let publishOpts = helpers.getProposalSignatureOpts(txp1, TestData.copayers[0].privKey_1H_0);
              txp1 = await util.promisify(server.publishTx).call(server, publishOpts);
              const signatures = helpers.clientSign(txp1, TestData.copayers[0].xPrivKey_44H_0H_0H);
              txp1 = await util.promisify(server.signTx).call(server, {
                txProposalId: txp1.id,
                signatures: signatures
              });
              helpers.stubBroadcast(txp1.txid);
              txp1 = await util.promisify(server.broadcastTx).call(server, { txProposalId: txp1.id });
              should.exist(txp1.txid);
              txp1.status.should.equal('broadcasted');
              
              // Try to publish txp2, which should fail since its utxos are already spent
              publishOpts = helpers.getProposalSignatureOpts(txp2, TestData.copayers[0].privKey_1H_0);
              try {
                await util.promisify(server.publishTx).call(server, publishOpts);
                throw new Error('should have thrown');
              } catch (err) {
                err.should.be.instanceof(ClientError);
                err.code.should.equal('UNAVAILABLE_UTXOS');
              }
            });

            if (coin === 'btc') {
              it('should fail to publish ( replaceTxByFee -> undefined ) a temporary tx proposal if utxos are already spent in a RBF tx', async function() {
                const txOpts = Object.assign({
                  outputs: [{
                    toAddress: addressStr,
                    amount: 1e8,
                  }],
                  message: 'some message',
                  feePerKb: 100e2,
                  enableRBF: true
                }, flags);
                await helpers.stubUtxos(server, wallet, [1, 2]);
                let txp1 = await util.promisify(server.createTx).call(server, txOpts);
                const txp2 = await util.promisify(server.createTx).call(server, txOpts);
                should.exist(txp1);
                should.exist(txp2);
                
                // Sign & Broadcast txp1
                let publishOpts = helpers.getProposalSignatureOpts(txp1, TestData.copayers[0].privKey_1H_0);
                txp1 = await util.promisify(server.publishTx).call(server, publishOpts);
                const signatures = helpers.clientSign(txp1, TestData.copayers[0].xPrivKey_44H_0H_0H);
                txp1 = await util.promisify(server.signTx).call(server, {
                  txProposalId: txp1.id,
                  signatures: signatures
                });
                helpers.stubBroadcast(txp1.txid);
                txp1 = await util.promisify(server.broadcastTx).call(server, {
                  txProposalId: txp1.id
                });
                should.exist(txp1.txid);
                txp1.status.should.equal('broadcasted');
                
                // Try to publish txp2, which should fail since its utxos are already spent
                publishOpts = helpers.getProposalSignatureOpts(txp2, TestData.copayers[0].privKey_1H_0);
                try {
                  await util.promisify(server.publishTx).call(server, publishOpts);
                  throw new Error('should have thrown');
                } catch (err) {
                  err.should.be.instanceof(ClientError);
                  err.code.should.equal('UNAVAILABLE_UTXOS');
                }
              });

              it('should not fail to publish, sign and broadcast ( replaceTxByFee -> true ) a tx proposal if utxos are already spent in a RBF tx', async function() {
                const txOpts1 = Object.assign({
                  outputs: [{
                    toAddress: addressStr,
                    amount: 1e8,
                  }],
                  message: 'some message',
                  feePerKb: 100e2,
                  enableRBF: true
                }, flags);
                const txOpts2 = Object.assign({
                  outputs: [{
                    toAddress: addressStr,
                    amount: 1e8,
                  }],
                  message: 'some message',
                  feePerKb: 120e2
                }, flags);
                await helpers.stubUtxos(server, wallet, [1, 2]);

                let txp1 = await util.promisify(server.createTx).call(server, txOpts1);
                let txp2 = await util.promisify(server.createTx).call(server, { ...txOpts2, ...{ replaceTxByFee: true, inputs: txp1.inputs } });
                should.exist(txp1);
                should.exist(txp2);
                
                // Sign & Broadcast txp1
                let publishOpts = helpers.getProposalSignatureOpts(txp1, TestData.copayers[0].privKey_1H_0);
                txp1 = await util.promisify(server.publishTx).call(server, publishOpts);
                let signatures = helpers.clientSign(txp1, TestData.copayers[0].xPrivKey_44H_0H_0H);
                txp1 = await util.promisify(server.signTx).call(server, {
                  txProposalId: txp1.id,
                  signatures: signatures
                });
                helpers.stubBroadcast(txp1.txid);
                txp1 = await util.promisify(server.broadcastTx).call(server, {
                  txProposalId: txp1.id
                });
                should.exist(txp1.txid);
                txp1.status.should.equal('broadcasted');

                // Sign & Broadcast txp2
                publishOpts = helpers.getProposalSignatureOpts(txp2, TestData.copayers[0].privKey_1H_0);
                txp2 = await util.promisify(server.publishTx).call(server, publishOpts);
                signatures = helpers.clientSign(txp2, TestData.copayers[0].xPrivKey_44H_0H_0H);
                txp2 = await util.promisify(server.signTx).call(server, {
                  txProposalId: txp2.id,
                  signatures: signatures
                });
                helpers.stubBroadcast(txp2.txid);
                txp2 = await util.promisify(server.broadcastTx).call(server, {
                  txProposalId: txp2.id
                });
                should.exist(txp2.txid);
                txp2.status.should.equal('broadcasted');
              });
            }
          }
        });

        describe('Fee levels', function() {
          let level;
          let expected;
          let expectedNormal;

          before(() => {
            if (Constants.UTXO_CHAINS[coin.toUpperCase()]) {
              const normal = coin == 'doge' ? 1e8 : 200e2; // normal BCH, DOGE
              helpers.stubFeeLevels({
                1: 400e2,
                2: normal,
                6: 180e2, // economy BTC
                10: 180e2,
                15: 100e2,
                24: 90e2,
                25: 90e2
              }, null, coin);
            } else if (coin === 'eth') {
              helpers.stubFeeLevels({
                1: 10e9, // urgent ETH
                2: 5e9,  // priority ETH
                3: 1e9,  // normal ETH
                4: 1e9   // economy/superEconomy ETH
              }, null, coin);
            } else if (coin === 'xrp') {
              helpers.stubFeeLevels({
                1: 12
              }, null, coin);
            }
            switch (coin) {
              case 'bch':
                level = 'normal';
                expected = 210e2;
                expectedNormal = 210e2;
                break;
              case 'eth':
                level = 'normal';
                expected = 1e9;
                expectedNormal = 1e9;
                break;
              case 'xrp':
                level = 'normal';
                expected = 12;
                expectedNormal = 12;
                break;
              case 'doge':
                level = 'normal';
                expected = 1e8;
                expectedNormal = 1e8;
                break;
              case 'ltc':
                level = 'normal';
                expected = 200e2;
                expectedNormal = 200e2;
                break;
              default:
                level = 'economy';
                expected = 180e2;
                expectedNormal = 200e2;
            };
          });

          it('should create a tx specifying feeLevel', function(done) {
            helpers.stubUtxos(server, wallet, 2).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: ts,
                }],
                gasPrice: 1,
                feeLevel: level,
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                txp.feeLevel.should.equal(level);
                txp.feePerKb.should.equal(expected);
                done();
              });
            });
          });

          it('should fail if the specified fee level does not exist', function(done) {
            helpers.stubUtxos(server, wallet, 2).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: ts,
                }],
                feeLevel: 'madeUpLevel',
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.exist(err);
                should.not.exist(txp);
                err.toString().should.contain('Invalid fee level');
                done();
              });
            });
          });

          it('should assume "normal" fee level if no feeLevel and no feePerKb/fee is specified', function(done) {
            helpers.stubUtxos(server, wallet, 2).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: ts,
                }],
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                txp.feePerKb.should.equal(expectedNormal);
                txp.feeLevel.should.equal('normal');
                done();
              });
            });
          });
        });

        it('should generate new change address for each created tx', function(done) {
          const coinAmount = {
            btc: 8000,
            bch: 8000,
            eth: 8000,
            xrp: 8000,
            doge: 1e8,
            ltc: 8000
          };
          const amount = coinAmount[coin];
          helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: addressStr,
                amount
              }],
              feePerKb: 100e2,
              from: fromAddr,
            }, flags);
            server.createTx(JSON.parse(JSON.stringify(txOpts)), function(err, tx1) {
              should.not.exist(err);
              should.exist(tx1);
              server.createTx(txOpts, function(err, tx2) {
                should.not.exist(err);
                should.exist(tx2);
                if (flags.noChange) {
                  should.not.exist(tx1.changeAddress);
                  should.not.exist(tx2.changeAddress);
                } else {
                  tx1.changeAddress.address.should.not.equal(tx2.changeAddress.address);
                }
                done();
              });
            });
          });
        });

        it('should support creating a tx with no change address', function(done) {
          const coinFee = {
            btc: 3800,
            bch: 3800,
            xrp: 3800,
            eth: 210000000,
            doge: 1e6,
            ltc: 3800
          };
          helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
            const max = 3 * ts - coinFee[coin]; // Fees for this tx at 100bits/kB = 3740 sat
            const txOpts = Object.assign({
              outputs: [{
                toAddress: addressStr,
                amount: max,
                gasLimit: (coin == 'eth') ? 21000 : null
              }],
              feePerKb: 100e2,
              from: fromAddr,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              const t = ChainService.getBitcoreTx(txp).toObject();
              t.outputs.length.should.equal(1);
              t.outputs[0].satoshis.should.equal(max);
              done();
            });
          });
        });

        it('should support creating a txp with multiple transactions', function(done) {
          const coinFee = {
            btc: 3800,
            bch: 3800,
            xrp: 3800,
            eth: 210000000,
            doge: 1e6,
            ltc: 3800
          };
          helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
            const amount = ts - coinFee[coin];
            const txOpts = Object.assign({
              outputs: [{
                toAddress: addressStr,
                amount,
              }, {
                toAddress: addressStr,
                amount: 2 * amount,
              }],
              multiTx: true,
              feePerKb: 100e2,
              from: fromAddr,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              if (coin != 'xrp') {
                should.exist(err);
                return done();
              }
              should.not.exist(err);
              should.exist(txp);
              txp.outputOrder.length.should.equal(2);
              const t = ChainService.getBitcoreTx(txp).toObject();
              t.outputs.length.should.equal(2);
              t.outputs[txp.outputOrder[0]].amount.should.equal(txOpts.outputs[txp.outputOrder[0]].amount);
              t.outputs[txp.outputOrder[1]].amount.should.equal(txOpts.outputs[txp.outputOrder[1]].amount);
              done();
            });
          });
        });

        it('should fail gracefully if unable to reach the blockchain', function(done) {
          blockchainExplorer.getUtxos = sinon.stub().callsArgWith(2, 'dummy error');
          blockchainExplorer.getBalance = sinon.stub().callsArgWith(1, 'dummy error');
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            const txOpts = Object.assign({
              outputs: [{
                toAddress: addressStr,
                amount: 1 * ts,
              }],
              feePerKb: 100e2,
            }, flags);
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.toString().should.equal('dummy error');
              done();
            });
          });
        });

        it('should fail gracefully when bitcore throws exception on raw tx creation', function(done) {
          const coinAmount = {
            btc: 0.5,
            bch: 0.5,
            eth: 0.5,
            xrp: 0.5,
            doge: 1,
            ltc: 0.5
          };
          helpers.stubUtxos(server, wallet, 2, { coin }).then(function() {
            sinon.stub(CWC.Transactions, 'create').throws(new Error('dummy exception'));
            sinon.stub(CWC.BitcoreLib.default, 'Transaction').throws(new Error('dummy exception'));
            sinon.stub(CWC.BitcoreLibCash.default, 'Transaction').throws(new Error('dummy exception'));
            sinon.stub(CWC.BitcoreLibDoge.default, 'Transaction').throws(new Error('dummy exception'));
            sinon.stub(CWC.BitcoreLibLtc.default, 'Transaction').throws(new Error('dummy exception'));
            const txOpts = Object.assign({
              outputs: [{
                toAddress: addressStr,
                amount: coinAmount[coin] * ts,
              }],
              feePerKb: 100e2,
            }, flags);
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.message.should.equal('dummy exception');
              done();
            });
          });
        });

        if (coin !== 'doge') { // TODO
          it('should fail with different error for insufficient funds and locked funds', function(done) {
            const ts = TO_SAT[coin];
            helpers.stubUtxos(server, wallet, [1, 1], { coin }).then(function() {
              const txAmount = +((1.1 * ts).toFixed(0));
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: txAmount,
                }],
                feePerKb: 100e2,
                from: fromAddr,
              }, flags);
              helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
                server.getBalance({}, function(err, balance) {
                  should.not.exist(err);
                  balance.totalAmount.should.equal(2 * ts + lockedFunds);
                  if (flags.noChange) {
                    balance.lockedAmount.should.equal(txAmount + tx.fee + lockedFunds);
                    txOpts.outputs[0].amount = 2 * ts;
                  } else {
                    balance.lockedAmount.should.equal(2 * ts);
                    txOpts.outputs[0].amount = 1 * ts;
                  }
                  server.createTx(txOpts, function(err, tx) {
                    should.exist(err);
                    err.should.be.instanceof(ClientError);
                    err.code.should.equal('LOCKED_FUNDS');
                    err.message.should.equal('Funds are locked by pending transaction proposals');
                    done();
                  });
                });
              });
            });
          });
        }

        if (!flags.noUtxoTests) {
          it('should fail to create a tx exceeding max size in kb', function(done) {
            sinon.stub(Defaults, 'MAX_TX_SIZE_IN_KB_BTC').value(1);

            helpers.stubUtxos(server, wallet, new Array(9).fill(1), { coin }).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 8 * ts,
                }],
                feePerKb: 100e2,
                from: fromAddr,
              }, flags);
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                err.should.be.instanceof(ClientError);
                err.code.should.equal('TX_MAX_SIZE_EXCEEDED');
                done();
              });
            });
          });

          it('should fail to create tx for dust amount in outputs', function(done) {
            helpers.stubUtxos(server, wallet, 1).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: Defaults.MIN_OUTPUT_AMOUNT - 1,
                }],
                feePerKb: 100e2,
              }, flags);
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                err.should.be.instanceof(ClientError);
                err.code.should.equal('DUST_AMOUNT');
                err.message.should.equal('Amount below dust threshold');
                done();
              });
            });
          });

          if (coin !== 'doge') { // TODO
            it('should create tx with 0 change output', function(done) {
              helpers.stubUtxos(server, wallet, 2).then(function() {
                const fee = 2260; // The exact fee of the resulting tx
                const amount = 2e8 - fee;
                const txOpts = Object.assign({
                  outputs: [{
                    toAddress: addressStr,
                    amount: amount,
                  }],
                  feePerKb: 100e2,
                }, flags);
                server.createTx(txOpts, function(err, tx) {
                  should.not.exist(err);
                  should.exist(tx);
                  const bitcoreTx = ChainService.getBitcoreTx(tx);
                  bitcoreTx.outputs.length.should.equal(1);
                  bitcoreTx.outputs[0].satoshis.should.equal(tx.amount);
                  done();
                });
              });
            });

            it('should create tx when there is a pending tx and enough UTXOs', function(done) {
              helpers.stubUtxos(server, wallet, [1.1, 1.2, 1.3], { coin }).then(function() {
                const txOpts = Object.assign({
                  outputs: [{
                    toAddress: addressStr,
                    amount: 1.5 * TO_SAT[coin],
                  }],
                  feePerKb: 100e2,
                }, flags);
                helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
                  should.exist(tx);
                  txOpts.outputs[0].amount = 1 * TO_SAT[coin];
                  helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
                    should.exist(tx);
                    server.getPendingTxs({}, function(err, txs) {
                      should.not.exist(err);
                      txs.length.should.equal(2);
                      server.getBalance({}, function(err, balance) {
                        should.not.exist(err);
                        balance.totalAmount.should.equal(3.6 * TO_SAT[coin]);
                        if (coin == 'eth') {
                          balance.lockedAmount.should.equal(2300000000000000000);
                        } else {
                          balance.lockedAmount.should.equal(3.6 * TO_SAT[coin]);
                        }
                        done();
                      });
                    });
                  });
                });
              });
            });
          }
          it('should fail to create tx when there is a pending tx and not enough UTXOs', function(done) {
            helpers.stubUtxos(server, wallet, [1.1, 1.2, 1.3], { coin }).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: 1.5 * TO_SAT[coin],
                }],
                feePerKb: 100e2,
              }, flags);
              helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
                should.exist(tx);
                txOpts.outputs[0].amount = TO_SAT[coin] * ((coin == 'eth') ? 2.2 : 1.8);
                server.createTx(txOpts, function(err, tx) {
                  err.should.be.instanceof(ClientError);
                  err.code.should.equal('LOCKED_FUNDS');
                  should.not.exist(tx);
                  server.getPendingTxs({}, function(err, txs) {
                    should.not.exist(err);
                    txs.length.should.equal(1);
                    server.getBalance({}, function(err, balance) {
                      should.not.exist(err);
                      balance.totalAmount.should.equal(3.6 * TO_SAT[coin]);
                      if (coin != 'eth') {
                        const amountInputs = txs[0].inputs.reduce((sum, input) => sum += input.satoshis, 0);
                        balance.lockedAmount.should.equal(amountInputs);
                        balance.lockedAmount.should.be.below(balance.totalAmount);
                        balance.availableAmount.should.equal(balance.totalAmount - balance.lockedAmount);
                      } else {
                        balance.lockedAmount.should.equal(1.5 * TO_SAT[coin]);
                      }
                      done();
                    });
                  });
                });
              });
            });
          });
        }

        it('should be able to send max funds', function(done) {
          helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: addressStr,
                amount: null,
                gasLimit: 21000
              }],
              feePerKb: (coin == 'eth') ? 1e8 : 10000,
              sendMax: true,
              from: fromAddr,
            }, flags);
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              should.not.exist(tx.changeAddress);
              tx.amount.should.equal(3 * TO_SAT[coin] - tx.fee);
              const t = ChainService.getBitcoreTx(tx);
              t.getFee().should.equal(tx.fee);
              should.not.exist(t.getChangeOutput());
              t.toObject().inputs.length.should.equal(tx.inputs.length);
              t.toObject().outputs[0].satoshis.should.equal(tx.amount);
              done();
            });
          });
        });


        if (!flags.noUtxoTests) {
          it('should  send max with appropiate fee', function(done) {
            helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
              const txOpts = Object.assign({
                outputs: [{
                  toAddress: addressStr,
                  amount: null,
                  gasLimit: 21000
                }],
                feePerKb: coin == 'bch' ? 1000 : 10000,
                sendMax: true,
                from: fromAddr,
              }, flags);

              helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(txp) {
                should.exist(txp);
                should.not.exist(txp.changeAddress);
                const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
                server.signTx({
                  txProposalId: txp.id,
                  signatures: signatures,
                }, function(err, txp) {
                  should.not.exist(err);
                  should.exist(txp);

                  helpers.stubBroadcast(txp.txid);
                  server.broadcastTx({
                    txProposalId: txp.id
                  }, function(err, txp) {
                    txp.amount.should.equal(3 * TO_SAT[coin] - txp.fee);

                    const t = ChainService.getBitcoreTx(txp);
                    t.getFee().should.equal(txp.fee);

                    const actualFeeRate = t.getFee() / (txp.raw.length / 2);
                    done();
                  });
                });
              });
            });
          });


          if (coin !== 'doge' && coin !== 'ltc') { // TODO
            it('should accept a tx proposal signed with a custom key', function(done) {
              const reqPrivKey = new Bitcore.PrivateKey();
              const reqPubKey = reqPrivKey.toPublicKey().toString();
              const xPrivKey = TestData.copayers[0].xPrivKey_44H_0H_0H;
              const accessOpts = {
                copayerId: TestData.copayers[0][idKey],
                requestPubKey: reqPubKey,
                signature: helpers.signRequestPubKey(reqPubKey, xPrivKey),
              };

              server.addAccess(accessOpts, function(err) {
                should.not.exist(err);
                helpers.stubUtxos(server, wallet, [1, 2], { coin }).then(function() {
                  const txOpts = Object.assign({
                    outputs: [{
                      toAddress: addressStr,
                      amount: 0.8 * 1e8,
                    }],
                    message: 'some message',
                    feePerKb: 100e2,
                  }, flags);
                  server.createTx(txOpts, function(err, txp) {
                    should.not.exist(err);
                    should.exist(txp);

                    const publishOpts = {
                      txProposalId: txp.id,
                      proposalSignature: helpers.signMessage(txp.getRawTx(), reqPrivKey),
                    };

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
          }

          it('should shuffle outputs unless specified', function(done) {
            let amount;
            let outputAmount;

            if (coin === 'doge') {
              amount = 1000;
              outputAmount = 1e8;
            } else {
              amount = 1;
              outputAmount = 100e2;
            }
            helpers.stubUtxos(server, wallet, amount).then(function() {
              const txOpts = Object.assign({
                outputs: new Array(30).fill(0).map((_, i) => ({
                  toAddress: addressStr,
                  amount: (i + 1) * outputAmount,
                })),
                feePerKb: 123e2,
                noShuffleOutputs: false,
              }, flags);
              server.createTx(txOpts, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);
                let t = ChainService.getBitcoreTx(txp);
                let changeOutput = t.getChangeOutput().satoshis;
                let outputs = t.outputs.map(o => o.satoshis).filter(o => o !== changeOutput);

                outputs.should.not.deep.equal(txOpts.outputs.map(o => o.amount));
                txOpts.noShuffleOutputs = true;
                server.createTx(txOpts, function(err, txp) {
                  should.not.exist(err);
                  should.exist(txp);

                  t = ChainService.getBitcoreTx(txp);
                  changeOutput = t.getChangeOutput().satoshis;
                  outputs = t.outputs.map(o => o.satoshis).filter(o => o !== changeOutput);

                  outputs.should.deep.equal(txOpts.outputs.map(o => o.amount));
                  done();
                });
              });
            });
          });
        }
      });
    });

    describe('Backoff time ' + coin, function() {
      let server;
      let wallet;
      let txid;
      let clock;

      beforeEach(async function() {
        sinon.stub(Defaults, 'BACKOFF_OFFSET').value(3);
        ({ server, wallet } = await helpers.createAndJoinWallet(2, 2));
        const range2to5 = new Array(4).fill(0).map((_, i) => i + 2);
        await helpers.stubUtxos(server, wallet, range2to5);
      });

      afterEach(function() {
        clock.restore();
      });

      it('should follow backoff time after consecutive rejections', async function() {
        clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
        const txOpts = Object.assign({
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 1e8,
          }],
          feePerKb: 100e2,
        }, flags);

        for (let i = 0; i < 3; i++) {
          const tx = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
          await util.promisify(server.rejectTx).call(server, {
            txProposalId: tx.id,
            reason: 'some reason',
          });
        }
          
        // Allow a 4th tx
        let tempTxp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
        await util.promisify(server.rejectTx).call(server, {
          txProposalId: tempTxp.id,
          reason: 'some reason',
        });

        try {
          // Do not allow before backoff time
          await util.promisify(server.createTx).call(server, txOpts);
          throw new Error('should have thrown');
        } catch (err) {
          err.should.be.instanceof(ClientError);
          err.code.should.equal('TX_CANNOT_CREATE');
        }
        clock.tick((Defaults.BACKOFF_TIME + 1) * 1000);
        tempTxp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
        await util.promisify(server.rejectTx).call(server, {
          txProposalId: tempTxp.id,
          reason: 'some reason',
        });

        // Do not allow a 5th tx before backoff time
        clock.tick((Defaults.BACKOFF_TIME - 1) * 1000);
        try {
          await util.promisify(server.createTx).call(server, txOpts);
          throw new Error('should have thrown');
        } catch (err) {
          err.should.be.instanceof(ClientError);
          err.code.should.equal('TX_CANNOT_CREATE');
        }

        clock.tick(2000);
        tempTxp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
        await util.promisify(server.rejectTx).call(server, {
          txProposalId: tempTxp.id,
          reason: 'some reason',
        });
      });
    });

    if (Constants.UTXO_CHAINS[coin.toUpperCase()]) {
      describe(`UTXO Selection: ${coin}`, function() {
        let server;
        let wallet;

        beforeEach(async function() {
          ({ server, wallet } = await helpers.createAndJoinWallet(1, 2));
        });

        it('should exclude unconfirmed utxos if specified', function(done) {
          helpers.stubUtxos(server, wallet, [1.3, 'u2', 'u0.1', 1.2]).then(function(utxos) {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 3e8
              }],
              feePerKb: 100e2,
              excludeUnconfirmedUtxos: true,
            }, flags);
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.should.be.instanceof(ClientError);
              err.code.should.equal('INSUFFICIENT_FUNDS');
              err.message.should.equal('Insufficient funds');
              txOpts.outputs[0].amount = 2.5e8;
              server.createTx(txOpts, function(err, tx) {
                should.exist(err);
                err.should.be.instanceof(ClientError);
                err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
                err.message.should.include('Insufficient funds for fee. RequiredFee: 4500 Coin: btc feePerKb: 10000');
                err.messageData.should.deep.equal({
                  requiredFee: 4500,
                  coin: 'btc',
                  feePerKb: 10000
                });
                done();
              });
            });
          });
        });

        it('should use non-locked confirmed utxos when specified', function(done) {
          helpers.stubUtxos(server, wallet, [1.3, 'u2', 'u0.1', 1.2]).then(function(utxos) {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 1.4e8
              }],
              feePerKb: 100e2,
              excludeUnconfirmedUtxos: true,
            }, flags);
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
              should.exist(tx);
              tx.inputs.length.should.equal(2);
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.lockedConfirmedAmount.should.equal(helpers.toSatoshi(2.5));
                balance.availableConfirmedAmount.should.equal(0);
                txOpts.outputs[0].amount = 0.01e8;
                server.createTx(txOpts, function(err, tx) {
                  should.exist(err);
                  err.should.be.instanceof(ClientError);
                  err.code.should.equal('LOCKED_FUNDS');
                  done();
                });
              });
            });
          });
        });

        it('should not use UTXO provided in utxosToExclude option', function(done) {
          helpers.stubUtxos(server, wallet, [1, 2, 3]).then(function(utxos) {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 3.5e8,
              }],
              feePerKb: 100e2,
              utxosToExclude: [utxos[2].txid + ':' + utxos[2].vout],
            }, flags);
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.should.be.instanceof(ClientError);
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
          helpers.stubUtxos(server, wallet, [1, '350bit', '100bit', '100bit', '100bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 200e2,
              }],
              feePerKb: 10e2,
            }, flags);
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
          // NOTE: this test has a chance of failing of 1 in 1,073,741,824 :P
          const range1to30 = new Array(30).fill(0).map((_, i) => i + 1);
          helpers.stubUtxos(server, wallet, range1to30).then(function(utxos) {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: utxos.reduce((sum, u) => sum += u.satoshis, 0) - 0.5e8,
              }],
              feePerKb: 100e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.inputs.length.should.equal(30);
              txp.inputs.every((input, i) => i === 0 || input.satoshis < txp.inputs[i - 1].satoshis).should.be.false;
              done();
            });
          });
        });
        it('should select a confirmed utxos if within thresholds relative to tx amount', function(done) {
          helpers.stubUtxos(server, wallet, [1, 'u 350bit', '100bit', '100bit', '100bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 200e2,
              }],
              feePerKb: 10e2,
            }, flags);
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
          helpers.stubUtxos(server, wallet, [1, '800bit', '800bit', '800bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 2000e2,
              }],
              feePerKb: 10e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.inputs.length.should.equal(3);
              txp.inputs.every((input) => input.satoshis == 800e2).should.be.true;
              done();
            });
          });
        });

        it('should select smallest big utxo if small utxos are insufficient', function(done) {
          helpers.stubUtxos(server, wallet, [3, 1, 2, '100bit', '100bit', '100bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 300e2,
              }],
              feePerKb: 10e2,
            }, flags);
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
          sinon.stub(Defaults, 'UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR').value(2);
          // The 605 bits input cannot be selected even if it is > 2 * tx amount
          // because it cannot cover for fee on its own.
          helpers.stubUtxos(server, wallet, [1, '605bit', '100bit', '100bit', '100bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 300e2,
              }],
              feePerKb: 1200e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.inputs.length.should.equal(1);
              txp.inputs[0].satoshis.should.equal(1e8);
              done();
            });
          });
        });

        it('should select smallest big utxo if small utxos exceed maximum fee', function(done) {
          helpers.stubUtxos(server, wallet, [3, 1, 2].concat(new Array(20).fill('1000bit'))).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 12000e2,
              }],
              feePerKb: 20e2,
            }, flags);
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
          helpers.stubUtxos(server, wallet, [9, 1, 1, 0.5, 0.2, 0.2, 0.2]).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 3e8,
              }],
              feePerKb: 10e2,
            }, flags);
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
          sinon.stub(Defaults, 'UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR').value(0.0001);
          sinon.stub(Defaults, 'MAX_TX_SIZE_IN_KB_BTC').value(2);

          helpers.stubUtxos(server, wallet, [100].concat(new Array(19).fill(1))).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 15e8,
              }],
              feePerKb: 120e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.inputs.length.should.equal(1);
              txp.inputs[0].satoshis.should.equal(100e8);
              done();
            });
          });
        });

        it('should ignore utxos not contributing enough to cover increase in fee', function(done) {
          helpers.stubUtxos(server, wallet, ['100bit', '100bit', '100bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 200e2,
              }],
              feePerKb: 80e2,
            }, flags);
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
          helpers.stubUtxos(server, wallet, ['100bit', '100bit', '100bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 400e2,
              }],
              feePerKb: 10e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.exist(err);
              should.not.exist(txp);
              err.should.be.instanceof(ClientError);
              err.code.should.equal('INSUFFICIENT_FUNDS');
              done();
            });
          });
        });

        it('should fail to select utxos if not enough to cover fees', function(done) {
          helpers.stubUtxos(server, wallet, ['100bit', '100bit', '100bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 299e2,
              }],
              feePerKb: 10e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.exist(err);
              should.not.exist(txp);
              err.should.be.instanceof(ClientError);
              err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
              done();
            });
          });
        });

        it('should prefer a higher fee (breaking all limits) if inputs have 6+ confirmations', function(done) {
          helpers.stubUtxos(server, wallet, ['2c 2000bit'].concat(new Array(20).fill('100bit'))).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 1500e2,
              }],
              feePerKb: 10e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.inputs.every(input => input.satoshis == 100e2).should.be.true;
              done();
            });
          });
        });

        it('should select unconfirmed utxos if not enough confirmed utxos', function(done) {
          helpers.stubUtxos(server, wallet, ['u 1btc', '0.5btc']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 0.8e8,
              }],
              feePerKb: 100e2,
            }, flags);
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
          helpers.stubUtxos(server, wallet, ['1c200bit', '200bit'].concat(new Array(20).fill('1bit'))).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 200e2,
              }],
              feePerKb: 90e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.inputs.length.should.equal(2);
              done();
            });
          });
        });

        it('should ignore utxos not economically worth to send and fail if not enough utxos to cover fees', function(done) {
          helpers.stubUtxos(server, wallet, [].concat(new Array(20).fill('10bit'))).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 200e2,
              }],
              feePerKb: 90e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.exist(err);
              err.should.be.instanceof(ClientError);
              err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
              done();
            });
          });
        });

        it('should use small utxos if fee is low', function(done) {
          helpers.stubUtxos(server, wallet, [].concat(new Array(10).fill('30bit'))).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 200e2,
              }],
              feePerKb: 10e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.inputs.length.should.equal(8);
              done();
            });
          });
        });

        it('should correct fee if resulting change would be below threshold', function(done) {
          helpers.stubUtxos(server, wallet, ['180bit', '500sat']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 150e2,
              }],
              feePerKb: 100e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              txp.inputs.length.should.equal(1);
              (txp.inputs.reduce((sum, i) => sum += i.satoshis, 0) - txp.outputs[0].amount - txp.fee).should.equal(0);
              const changeOutput = ChainService.getBitcoreTx(txp).getChangeOutput();
              should.not.exist(changeOutput);
              done();
            });
          });
        });

        it('should ignore small utxos if fee is higher', function(done) {
          helpers.stubUtxos(server, wallet, [].concat(new Array(10).fill('30bit'))).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 200e2,
              }],
              feePerKb: 80e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.exist(err);
              err.should.be.instanceof(ClientError);
              err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
              done();
            });
          });
        });

        it('should always select inputs as long as there are sufficient funds', function(done) {
          helpers.stubUtxos(server, wallet, [80, '50bit', '50bit', '50bit', '50bit', '50bit']).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 101e2,
              }],
              feePerKb: 100e2,
            }, flags);
            server.createTx(txOpts, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              done();
            });
          });
        });

        it('should not use UTXOs of recently broadcasted txs', function(done) {
          helpers.stubUtxos(server, wallet, [1, 1]).then(function() {
            const txOpts = Object.assign({
              outputs: [{
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: 1.5e8,
              }],
              feePerKb: 100e2,
            }, flags);
            helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(txp) {
              should.exist(txp);
              const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
              server.signTx({
                txProposalId: txp.id,
                signatures: signatures,
              }, function(err, txp) {
                should.not.exist(err);
                should.exist(txp);

                helpers.stubBroadcast(txp.txid);
                server.broadcastTx({
                  txProposalId: txp.id
                }, function(err, txp) {
                  should.not.exist(err);
                  should.exist(txp.txid);
                  txp.status.should.equal('broadcasted');
                  server.createTx(txOpts, function(err, txp) {
                    should.exist(err);
                    err.should.be.instanceof(ClientError);
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
    };
  }

  describe('#createTX Segwit tests', () => {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, {
        coin: 'btc',
        useNativeSegwit: true,
      }));
    });

    it('should set the desired Fee rate on segwit TXs', function(done) {
      helpers.stubFeeLevels({});
      const addr = '134kthjj3BaGTRMPiB1moohBdtKfyCrt9c';
      const amount = 75909000;
      helpers.stubUtxos(server, wallet, [0.36023362, 0.39923362]).then(function() {
        const txOpts = {
          outputs: [{
            toAddress: addr,
            amount: amount,
          }],
          message: 'some message',
          customData: 'some custom data',
          feePerKb: 129 * 1000,
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(txp) {
          const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txp.id,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err, err);
            should.exist(txp);

            helpers.stubBroadcast(txp.txid);
            server.broadcastTx({
              txProposalId: txp.id
            }, function(err, txp) {
              should.not.exist(err, err);
              txp.outputs.should.deep.equal([{
                toAddress: addr,
                amount: amount,
              }]);
              done();
            });
          });
        });
      });
    });
  });

  describe('#createTX ETH Only tests', () => {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, {
        coin: 'eth',
      }));
    });

    it('should allow to create a TX with fee and no inputs', function(done) {
      helpers.stubFeeLevels({});
      server.createAddress({}, from => {
        helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
          const amount = 0.8 * 1e8;
          const txOpts = {
            outputs: [{
              toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
              amount: amount,
            }],
            from,
            message: 'some message',
            customData: 'some custom data',
            fee: 252000000000000,
          };
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            tx.outputs.should.deep.equal([{
              toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
              gasLimit: 21000,
              amount: amount,
            }]);
            tx.gasPrice.should.equal(12000000000);
            tx.outputs[0].gasLimit.should.equal(21000);
            (tx.gasPrice * tx.outputs[0].gasLimit).should.equal(txOpts.fee);
            done();
          });
        });
      });
    });

    it('should allow to create a TX with multiple outputs and set the correct fee', function(done) {
      helpers.stubFeeLevels({});
      server.createAddress({}, from => {
        helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
          const amount = 0;
          const txOpts = {
            outputs: [{
              toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
              amount: amount,
            }, {
              toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
              amount: amount,
            }],
            from,
            message: 'some message',
            customData: 'some custom data'
          };
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            tx.outputs.should.deep.equal([{
              toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
              gasLimit: 21000,
              amount: amount
            }, {
              toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
              gasLimit: 21000,
              amount: amount
            }]);
            tx.gasPrice.should.equal(1000000000);
            tx.outputs[0].gasLimit.should.equal(21000);
            (tx.gasPrice * tx.outputs[0].gasLimit).should.equal(21000000000000);
            done();
          });
        });
      });
    });

    it('should fail if not enough available amount to cover fees', function(done) {
      helpers.stubFeeLevels({});
      server.createAddress({}, from => {
        helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
          const amount = 2.1 * 1e18;
          const txOpts = {
            outputs: [{
              toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
              amount: amount,
            }],
            from,
            message: 'some message',
            customData: 'some custom data',
            fee: 1 * 1e18
          };
          server.createTx(txOpts, function(err, txp) {
            should.exist(err);
            should.not.exist(txp);
            err.should.be.instanceof(ClientError);
            err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
            done();
          });
        });
      });
    });
  });

  describe('cashAddr backwards compat', function() {
    // / LEGACY MODE
    it('should create a BCH tx proposal with cashaddr outputs (w/o prefix) and return Copay addr', function(done) {
      const copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
      const cashAddr = BCHAddressTranslator.translate(copayAddr, 'cashaddr');
      const amount = 0.8 * 1e8;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        helpers.stubUtxos(s, w, [1, 2]).then(function() {
          const txOpts = {
            outputs: [{
              toAddress: cashAddr,
              amount: amount,
            }],
            message: 'some message',
            customData: 'some custom data',
            feePerKb: 123e2,
            noCashAddr: true,
          };
          s.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            tx.walletM.should.equal(1);
            tx.walletN.should.equal(1);
            tx.requiredRejections.should.equal(1);
            tx.requiredSignatures.should.equal(1);
            tx.isAccepted().should.be.false;
            tx.isRejected().should.be.false;
            tx.isPending().should.be.false;
            tx.isTemporary().should.be.true;
            tx.outputs.should.deep.equal([{
              toAddress: cashAddr,
              amount: amount,
            }]);
            tx.amount.should.equal(helpers.toSatoshi(0.8));
            tx.feePerKb.should.equal(123e2);
            should.not.exist(tx.feeLevel);
            const publishOpts: any = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
            publishOpts.noCashAddr = true;
            s.publishTx(publishOpts, function(err, txp) {
              txp.changeAddress.address.should.equal('CWwtFMy3GMr5qMEtvEdUDjePfShzkJXCnh');
              s.getPendingTxs({ noCashAddr: true }, function(err, txs) {
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

    // / CASHADDR MODE
    it('should create a BCH tx proposal with cashaddr outputs (w/o prefix) and return CASH addr', function(done) {
      const copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
      const cashAddr = BCHAddressTranslator.translate(copayAddr, 'cashaddr');
      const amount = 0.8 * 1e8;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        helpers.stubUtxos(s, w, [1, 2]).then(function() {
          const txOpts = {
            outputs: [{
              toAddress: copayAddr,
              amount: amount,
            }],
            message: 'some message',
            customData: 'some custom data',
            feePerKb: 123e2,
            noCashAddr: true,
          };
          s.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            tx.walletM.should.equal(1);
            tx.walletN.should.equal(1);
            tx.requiredRejections.should.equal(1);
            tx.requiredSignatures.should.equal(1);
            tx.isAccepted().should.be.false;
            tx.isRejected().should.be.false;
            tx.isPending().should.be.false;
            tx.isTemporary().should.be.true;
            tx.outputs.should.deep.equal([{
              toAddress: copayAddr,
              amount: amount,
            }]);
            tx.amount.should.equal(helpers.toSatoshi(0.8));
            tx.feePerKb.should.equal(123e2);
            should.not.exist(tx.feeLevel);
            const publishOpts: any = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
            publishOpts.noCashAddr = false;
            s.publishTx(publishOpts, function(err, txp) {
              txp.changeAddress.address.should.equal('qz0d6gueltx0feta7z9777yk97sz9p6peu98mg5vac');
              s.getPendingTxs({ noCashAddr: false }, function(err, txs) {
                should.not.exist(err);
                txs.length.should.equal(1);
                txs[0].changeAddress.address.should.equal('qz0d6gueltx0feta7z9777yk97sz9p6peu98mg5vac');
                txs[0].outputs.should.deep.equal([{
                  toAddress: cashAddr,
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
      const copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
      const cashAddr = BCHAddressTranslator.translate(copayAddr, 'cashaddr');
      const amount = 0.8 * 1e8;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        helpers.stubUtxos(s, w, [1, 2]).then(function() {
          const txOpts = {
            outputs: [{
              toAddress: 'bitcoincash:' + cashAddr,
              amount: amount,
            }],
            message: 'some message',
            customData: 'some custom data',
            feePerKb: 123e2,
            noCashAddr: true,
          };
          s.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            tx.walletM.should.equal(1);
            tx.walletN.should.equal(1);
            tx.requiredRejections.should.equal(1);
            tx.requiredSignatures.should.equal(1);
            tx.isAccepted().should.be.false;
            tx.isRejected().should.be.false;
            tx.isPending().should.be.false;
            tx.isTemporary().should.be.true;
            tx.outputs.should.deep.equal([{
              toAddress: 'bitcoincash:' + cashAddr,
              amount: amount,
            }]);
            tx.amount.should.equal(helpers.toSatoshi(0.8));
            tx.feePerKb.should.equal(123e2);
            should.not.exist(tx.feeLevel);
            const publishOpts: any = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
            publishOpts.noCashAddr = true;
            s.publishTx(publishOpts, function(err, txp) {
              txp.changeAddress.address.should.equal('CWwtFMy3GMr5qMEtvEdUDjePfShzkJXCnh');
              s.getPendingTxs({ noCashAddr: true }, function(err, txs) {
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
      const copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
      const cashAddr = BCHAddressTranslator.translate(copayAddr, 'cashaddr');
      const amount = 0.8 * 1e8;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        helpers.stubUtxos(s, w, [1, 2]).then(function() {
          const txOpts = {
            outputs: [{
              toAddress: cashAddr,
              amount: amount,
              message: 'xxx',
            }],
            message: 'some message',
            customData: 'some custom data',
            feePerKb: 123e2,
            noCashAddr: true,
          };
          s.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            tx.walletM.should.equal(1);
            tx.walletN.should.equal(1);
            tx.requiredRejections.should.equal(1);
            tx.requiredSignatures.should.equal(1);
            tx.isAccepted().should.be.false;
            tx.isRejected().should.be.false;
            tx.isPending().should.be.false;
            tx.isTemporary().should.be.true;
            tx.outputs.should.deep.equal([{
              toAddress: cashAddr,
              amount: amount,
              message: 'xxx',
            }]);
            tx.amount.should.equal(helpers.toSatoshi(0.8));
            tx.feePerKb.should.equal(123e2);
            should.not.exist(tx.feeLevel);
            const publishOpts = helpers.getProposalSignatureOpts(tx, TestData.copayers[0].privKey_1H_0);
            s.publishTx(publishOpts, function(err) {
              s.getPendingTxs({ noCashAddr: true }, function(err, txs) {
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
  });

  describe('cashAddr edge cases (v3 api)', function() {
    it('should fail to create BCH tx proposal with cashaddr w/prefix', function(done) {
      const copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
      const cashAddr = BCHAddressTranslator.translate(copayAddr, 'cashaddr');
      const amount = 0.8 * 1e8;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        helpers.stubUtxos(s, w, [1, 2]).then(function() {
          const txOpts = {
            outputs: [{
              toAddress: 'bitcoincash:' + cashAddr,
              amount: amount,
            }],
            message: 'some message',
            customData: 'some custom data',
            feePerKb: 123e2,
          };
          s.createTx(txOpts, function(err, tx) {
            err.message.should.contain('cashaddr wo prefix');
            done();
          });
        });
      });
    });

    it('should fail to create BCH tx proposal with  legacy addr  ', function(done) {
      const copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
      const cashAddr = BCHAddressTranslator.translate(copayAddr, 'cashaddr');
      const amount = 0.8 * 1e8;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        helpers.stubUtxos(s, w, [1, 2]).then(function() {
          const txOpts = {
            outputs: [{
              toAddress: copayAddr,
              amount: amount,
            }],
            message: 'some message',
            customData: 'some custom data',
            feePerKb: 123e2,
          };
          s.createTx(txOpts, function(err, tx) {
            err.message.should.contain('cashaddr wo prefix');
            done();
          });
        });
      });
    });

    it('should allow cashaddr on change address', function(done) {
      const copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
      const cashAddr = BCHAddressTranslator.translate(copayAddr, 'cashaddr');
      const amount = 0.8 * 1e8;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        helpers.createAddresses(s, w, 1, 1).then(function({ main: mainAddresses, change: changeAddress }) {
          helpers.stubUtxos(s, w, [1, 2]).then(function() {
            const txOpts = {
              outputs: [{
                toAddress: cashAddr,
                amount: amount,
              }],
              message: 'some message',
              customData: 'some custom data',
              feePerKb: 123e2,
              changeAddress: changeAddress[0].address,
            };
            s.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              tx.changeAddress.address.should.equal(changeAddress[0].address);
              tx.changeAddress.address.should.equal('qz0d6gueltx0feta7z9777yk97sz9p6peu98mg5vac');
              done();
            });
          });
        });
      });
    });

    it('should not allow cashaddr w prefix on change address', function(done) {
      const copayAddr = 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X';
      const cashAddr = BCHAddressTranslator.translate(copayAddr, 'cashaddr');
      const amount = 0.8 * 1e8;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        helpers.createAddresses(s, w, 1, 1).then(function({ main: mainAddresses, change: changeAddress }) {
          helpers.stubUtxos(s, w, [1, 2]).then(function() {
            const txOpts = {
              outputs: [{
                toAddress: cashAddr,
                amount: amount,
              }],
              message: 'some message',
              customData: 'some custom data',
              feePerKb: 123e2,
              changeAddress: 'bitcoincash:' + changeAddress[0].address,
            };
            s.createTx(txOpts, function(err, tx) {
              err.message.should.contain('wo prefix');
              done();
            });
          });
        });
      });
    });
  });


  describe('Transaction notes', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 2));
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
      const clock = sinon.useFakeTimers({ toFake: ['Date'] });
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
          const creator = note.editedBy;
          helpers.getAuthServer(wallet.copayers[1].id).then(function(server) {
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
      helpers.stubUtxos(server, wallet, 2).then(function() {
        const txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 1e8,
          }],
          message: 'some message',
          feePerKb: 100e2,
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(txp) {
          should.exist(txp);
          const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
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
          const creator = note.editedBy;
          helpers.getAuthServer(wallet.copayers[1].id).then(function(server) {
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
      helpers.createAddresses(server, wallet, 1, 1).then(function({ main: mainAddresses, change: changeAddress }) {
        blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
        server._normalizeTxHistory = function(a, b, c, e, d) { return d(null, b); };
        const txs = [{
          txid: '123',
          blockheight: 100,
          height: 100,
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
        helpers.stubHistory(null, null, txs);
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
            const tx = txs[0];
            should.exist(tx.note);
            tx.note.body.should.equal('just some note');
            tx.note.editedBy.should.equal(server.copayerId);
            should.exist(tx.note.editedOn);
            done();
          });
        });
      });
    });

    it('should get all notes edited past a given date', async function() {
      const clock = sinon.useFakeTimers({ toFake: ['Date'] });
      let notes = await util.promisify(server.getTxNotes).call(server, {});
      notes.should.be.empty;

      await util.promisify(server.editTxNote).call(server, {
        txid: '123',
        body: 'note body'
      });
      notes = await util.promisify(server.getTxNotes).call(server, { minTs: 0 });
      notes.length.should.equal(1);
      notes[0].txid.should.equal('123');
        
      clock.tick(60 * 1000);
      await util.promisify(server.editTxNote).call(server, {
        txid: '456',
        body: 'another note'
      });
      notes = await util.promisify(server.getTxNotes).call(server, { minTs: 0 });
      notes.length.should.equal(2);
      should.exist(notes.find(n => n.txid === '123'));
      should.exist(notes.find(n => n.txid === '456'));
        
      notes = await util.promisify(server.getTxNotes).call(server, { minTs: 50 });
      notes.length.should.equal(1);
      notes[0].txid.should.equal('456');
        
      clock.tick(60 * 1000);
      await util.promisify(server.editTxNote).call(server, {
        txid: '123',
        body: 'an edit'
      });
      notes = await util.promisify(server.getTxNotes).call(server, { minTs: 100 });
      notes.length.should.equal(1);
      notes[0].txid.should.equal('123');
      notes[0].body.should.equal('an edit');

      notes = await util.promisify(server.getTxNotes).call(server, {});
      notes.length.should.equal(2);

      clock.restore();
    });
  });

  describe('Single-address wallet', function() {
    let server;
    let wallet;
    let firstAddress;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 2, {
        singleAddress: true,
      }));
      const a = await util.promisify(server.createAddress).call(server, {});
      should.exist(a.address);
      firstAddress = a;
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
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
        server.getAddresses({ noChange: true }, function(err, addr) {
          should.not.exist(err);
          addr.length.should.equal(1);
          done();
        });
      });
    });

    it('should reuse address as change address on tx proposal creation', function(done) {
      helpers.stubUtxos(server, wallet, 2).then(function() {
        const toAddress = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';
        const opts = {
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
      helpers.stubUtxos(server, wallet, 2).then(function() {
        const toAddress = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';
        const opts = {
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
      helpers.stubUtxos(server, wallet, 2).then(function() {
        const toAddress = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';
        const opts = {
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
  });

  describe('#getSendMaxInfo', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));
    });

    function sendTx(info, cb) {
      const txOpts = {
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
        const t = ChainService.getBitcoreTx(tx);
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
      helpers.stubUtxos(server, wallet, [0.1, 0.2, 0.3, 0.4]).then(function() {
        server.getSendMaxInfo({
          feePerKb: 10000,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.inputs.length.should.equal(4);
          info.size.should.equal(1238);
          info.fee.should.equal(info.size * 10000 / 1000);
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
      helpers.stubUtxos(server, wallet, [300e-6, 300e-6]).then(function() {
        server.getSendMaxInfo({
          feePerKb: 500e2,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.size.should.equal(646);
          info.fee.should.equal(32300);
          info.amount.should.equal(27700);

          // const _min_output_amount = Defaults.MIN_OUTPUT_AMOUNT;
          // Defaults.MIN_OUTPUT_AMOUNT = 300e2;
          sinon.stub(Defaults, 'MIN_OUTPUT_AMOUNT').value(300e2);
          server.getSendMaxInfo({
            feePerKb: 500e2,
            returnInputs: true,
          }, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.size.should.equal(0);
            info.amount.should.equal(0);
            // Defaults.MIN_OUTPUT_AMOUNT = _min_output_amount;
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
        helpers.stubUtxos(server, wallet, [0.1, 0.2, 0.3, 0.4]).then(function() {
          server.getSendMaxInfo({
            feeLevel: 'economy',
            returnInputs: true,
          }, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.feePerKb.should.equal(180e2);
            info.fee.should.equal(info.size * 180e2 / 1000);
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
        helpers.stubUtxos(server, wallet, [0.1, 0.2, 0.3, 0.4]).then(function() {
          server.getSendMaxInfo({}, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.feePerKb.should.equal(200e2);
            info.fee.should.equal(info.size * 200e2 / 1000);
            done();
          });
        });
      });

      it('should fail on invalid fee level', function(done) {
        helpers.stubUtxos(server, wallet, [0.1, 0.2, 0.3, 0.4]).then(function() {
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
      const range1to30 = new Array(30).fill(0).map((_, i) => i + 1);
      helpers.stubUtxos(server, wallet, range1to30).then(function(utxos) {
        server.getSendMaxInfo({
          feePerKb: 100e2,
          returnInputs: true
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          const amounts = info.inputs.map(i => i.satoshis);
          amounts.length.should.equal(30);
          amounts.every(function(amount, i) {
            if (i == 0) return true;
            return amount < amounts[i - 1];
          }).should.be.false;
          done();
        });
      });
    });

    it('should exclude unconfirmed inputs', function(done) {
      helpers.stubUtxos(server, wallet, ['u0.1', 0.2, 0.3, 0.4]).then(function() {
        server.getSendMaxInfo({
          feePerKb: 10000,
          excludeUnconfirmedUtxos: true,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.inputs.length.should.equal(3);
          info.size.should.equal(942);
          info.fee.should.equal(info.size * 10000 / 1000);
          info.amount.should.equal(0.9e8 - info.fee);
          sendTx(info, done);
        });
      });
    });

    it('should exclude locked inputs', function(done) {
      helpers.stubUtxos(server, wallet, ['u0.1', 0.1, 0.1, 0.1]).then(function() {
        const txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.09e8,
          }],
          feePerKb: 100e2,
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
          should.exist(tx);
          server.getSendMaxInfo({
            feePerKb: 10000,
            excludeUnconfirmedUtxos: true,
            returnInputs: true,
          }, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.inputs.length.should.equal(2);
            info.size.should.equal(646);
            info.fee.should.equal(info.size * 10000 / 1000);
            info.amount.should.equal(0.2e8 - info.fee);
            sendTx(info, done);
          });
        });
      });
    });

    it('should ignore utxos not contributing to total amount (below their cost in fee)', function(done) {
      // 10 sat and 100 sat should be completely ignored. (under dust)
      helpers.stubUtxos(server, wallet, ['u0.1', '100 sat', 0.2, 0.3, 0.4, '10bit', '100bit', '200bit', '10 sat']).then(function() {
        server.getSendMaxInfo({
          feePerKb: 0.001e8,
          returnInputs: true,
        }, function(err, info) {
          should.not.exist(err);
          should.exist(info);
          info.inputs.length.should.equal(4);
          info.size.should.equal(1238);
          info.fee.should.equal(info.size * 0.001e8 / 1000);
          info.amount.should.equal(1e8 - info.fee);
          info.utxosBelowFee.should.equal(3);
          info.amountBelowFee.should.equal(310e2);
          server.getSendMaxInfo({
            feePerKb: 0.0001e8,
            returnInputs: true,
          }, function(err, info) {
            should.not.exist(err);
            should.exist(info);
            info.inputs.length.should.equal(6);
            info.size.should.equal(1830);
            info.fee.should.equal(info.size * 0.0001e8 / 1000);
            info.amount.should.equal(1.0003e8 - info.fee);
            info.utxosBelowFee.should.equal(1);
            info.amountBelowFee.should.equal(1e3);
            sendTx(info, done);
          });
        });
      });
    });

    it('should work when all inputs are below their cost in fee', function(done) {
      helpers.stubUtxos(server, wallet, ['u 10bit', '10bit', '20bit']).then(function() {
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
      sinon.stub(Defaults, 'MAX_TX_SIZE_IN_KB_BTC').value(2);
      helpers.stubUtxos(server, wallet, new Array(9).fill(1)).then(function() {
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
          sendTx(info, done);
        });
      });
    });
  });

  describe('Check requiredFeeRate  BTC', function() {
    let server;
    let wallet;

    // some of these tests, particularly case 26, can run a bit long
    //  and cause the ci pipeline to fail
    this.timeout(4000);

    beforeEach(function() {
      helpers.stubFeeLevels({
        1: 40002,
        2: 20000,
        6: 18000,
        24: 9001,
      }, true);
    });

    const cases: {
      name: string;
      requiredFeeRate: number;
      sendMax?: boolean;
      fromSegwit: boolean;
      utxos: (number | string)[];
      outputs: { toAddress: string, amount: number }[];
      vSize?: number;
      n?: number;
      m?: number;
      segwitVersion?: number;
      i?: number;
    }[] = [
      {
        name: 'Legacy, sendmax',
        requiredFeeRate: 10000,
        sendMax: true,
        fromSegwit: false,
        utxos: [1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        name: 'Segwit, sendmax',
        requiredFeeRate: 10000,
        sendMax: true,
        fromSegwit: true,
        utxos: [1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        name: 'Segwit, sendmax, 4 inputs',
        requiredFeeRate: 25000,
        sendMax: true,
        fromSegwit: true,
        utxos: [0.1, 0.2, 0.3, 0.4],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        name: 'Segwit, sendmax, 3 inputs',
        requiredFeeRate: 25000,
        sendMax: true,
        fromSegwit: true,
        utxos: [0.1, 0.3, 0.4],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        name: 'Segwit, non-sendmax, 2 inputs',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [1, 2],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10000,
        }],
        vSize: 141, // from https://btc.com/tools/tx/decode
      },
      {
        name: 'Segwit, non-sendmax, 3 inputs',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: ['100000 sat', '20000 sat', 1],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10000,
        }],
        vSize: 141, // from https://btc.com/tools/tx/decode
      },
      {
        name: 'Segwit, non-sendmax, 1 inputs, 1 legacy output',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [1.2],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 1e8,
        }],
        vSize: 144,
      },
      {
        name: 'Segwit, non-sendmax, 3 inputs, 1 legacy output',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [0.4, 0.4, 0.4],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 1e8,
        }],
      },
      // CASE 8
      {
        name: 'Segwit, non-sendmax, 6 inputs',
        requiredFeeRate: 30000,
        fromSegwit: true,
        utxos: [0.2, 0.2, 0.1, 0.1, 0.3, 0.15],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 1e8,
        }],
      },
      {
        n: 2,
        name: 'Legacy, sendmax',
        requiredFeeRate: 10000,
        sendMax: true,
        fromSegwit: false,
        utxos: [1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        n: 2,
        vSize: 123, // from https://btc.com/tools/tx/decode
        name: 'Segwit, sendmax',
        requiredFeeRate: 10000,
        sendMax: true,
        fromSegwit: true,
        utxos: [1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        n: 2,
        name: 'Segwit, sendmax, 4 inputs',
        requiredFeeRate: 25000,
        sendMax: true,
        fromSegwit: true,
        utxos: [0.1, 0.2, 0.3, 0.4],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        n: 2,
        name: 'Segwit, sendmax, 3 inputs',
        requiredFeeRate: 25000,
        sendMax: true,
        fromSegwit: true,
        utxos: [0.1, 0.3, 0.4],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        n: 2,
        name: 'Segwit, non-sendmax, 2 inputs',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [1, 2],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10000,
        }],
        vSize: 141, // from https://btc.com/tools/tx/decode
      },
      {
        n: 2,
        name: 'Segwit, non-sendmax, 3 inputs',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: ['100000 sat', '20000 sat', 1],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10000,
        }],
        vSize: 141, // from https://btc.com/tools/tx/decode
      },
      {
        n: 2,
        name: 'Segwit, non-sendmax, 1 inputs, 1 legacy output',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [1.1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 1e8,
        }],
        vSize: 144,
      },
      {
        n: 2,
        vSize: 321,
        name: 'Segwit, non-sendmax, 3 inputs, 1 legacy output',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [0.4, 0.4, 0.4],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 1e8,
        }],
      },
      {
        n: 2,
        name: 'Segwit, non-sendmax, 6 inputs',
        requiredFeeRate: 30000,
        fromSegwit: true,
        utxos: [0.2, 0.2, 0.1, 0.1, 0.3, 0.15],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 1e8,
        }],
      },
      {
        m: 2,
        n: 3,
        name: 'Legacy, sendmax',
        requiredFeeRate: 10000,
        sendMax: true,
        fromSegwit: false,
        utxos: [1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        m: 2,
        n: 3,
        vSize: 123, // from https://btc.com/tools/tx/decode
        name: 'Segwit, sendmax',
        requiredFeeRate: 10000,
        sendMax: true,
        fromSegwit: true,
        utxos: [1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        m: 2,
        n: 3,
        name: 'Segwit, sendmax, 4 inputs',
        requiredFeeRate: 25000,
        sendMax: true,
        fromSegwit: true,
        utxos: [0.1, 0.2, 0.3, 0.4],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        m: 2,
        n: 3,
        name: 'Segwit, sendmax, 3 inputs',
        requiredFeeRate: 25000,
        sendMax: true,
        fromSegwit: true,
        utxos: [0.1, 0.3, 0.4],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        m: 2,
        n: 3,
        name: 'Segwit, non-sendmax, 2 inputs',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [1, 2],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10000,
        }],
        vSize: 141, // from https://btc.com/tools/tx/decode
      },
      {
        m: 2,
        n: 3,
        name: 'Segwit, non-sendmax, 3 inputs',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: ['100000 sat', '20000 sat', 1],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10000,
        }],
        vSize: 141, // from https://btc.com/tools/tx/decode
      },
      {
        m: 2,
        n: 3,
        name: 'Segwit, non-sendmax, 1 inputs, 1 legacy output',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [1.1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 1e8,
        }],
        vSize: 144,
      },
      {
        m: 2,
        n: 3,
        vSize: 321,
        name: 'Segwit, non-sendmax, 3 inputs, 1 legacy output',
        requiredFeeRate: 25000,
        fromSegwit: true,
        utxos: [0.4, 0.4, 0.4],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 1e8,
        }],
      },
      {
        m: 2,
        n: 3,
        name: 'Segwit, non-sendmax, 6 inputs',
        requiredFeeRate: 30000,
        fromSegwit: true,
        utxos: [0.2, 0.2, 0.1, 0.1, 0.3, 0.15],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 1e8,
        }],
      },
      // Taproot
      {
        name: 'Taproot, sendmax',
        requiredFeeRate: 10000,
        sendMax: true,
        fromSegwit: true,
        segwitVersion: 1,
        utxos: [1],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        name: 'Taproot, sendmax, 4 inputs',
        requiredFeeRate: 25000,
        sendMax: true,
        fromSegwit: true,
        segwitVersion: 1,
        utxos: [0.1, 0.2, 0.3, 0.4],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        name: 'Taproot, sendmax, 3 inputs',
        requiredFeeRate: 25000,
        sendMax: true,
        fromSegwit: true,
        segwitVersion: 1,
        utxos: [0.1, 0.3, 0.4],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10, // overwritten in sendMax
        }],
      },
      {
        name: 'Taproot, non-sendmax, 2 inputs',
        requiredFeeRate: 25000,
        fromSegwit: true,
        segwitVersion: 1,
        utxos: [1, 2],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10000,
        }],
        vSize: 141, // from https://btc.com/tools/tx/decode
      },
      {
        name: 'Taproot, non-sendmax, 3 inputs',
        requiredFeeRate: 25000,
        fromSegwit: true,
        segwitVersion: 1,
        utxos: ['100000 sat', '20000 sat', 1],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 10000,
        }],
        vSize: 141, // from https://btc.com/tools/tx/decode
      },
      {
        name: 'Taproot, non-sendmax, 1 inputs, 1 legacy output',
        requiredFeeRate: 25000,
        fromSegwit: true,
        segwitVersion: 1,
        utxos: [1.2],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 1e8,
        }],
        vSize: 144,
      },
      {
        name: 'Taproot, non-sendmax, 3 inputs, 1 legacy output',
        requiredFeeRate: 25000,
        fromSegwit: true,
        segwitVersion: 1,
        utxos: [0.4, 0.4, 0.4],
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 1e8,
        }],
      },
      // CASE 34
      {
        name: 'Taproot, non-sendmax, 6 inputs',
        requiredFeeRate: 30000,
        fromSegwit: true,
        segwitVersion: 1,
        utxos: [0.2, 0.2, 0.1, 0.1, 0.3, 0.15],
        outputs: [{
          toAddress: 'bc1q9ytgh0jywlxv0zr8w3ytd6z5rpgct6tuvmh4pl',
          amount: 1e8,
        }],
      },
    ];

    function checkTx(txOpts, x, cb) {
      function sign(copayerM, tx, cb) {
        helpers.getAuthServer(wallet.copayers[copayerM].id).then(function(server) {
          const signatures = helpers.clientSign(tx, TestData.copayers[copayerM].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: tx.id,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err, err);

            if (++copayerM == x.m) {
              return cb(txp);
            } else {
              return sign(copayerM, tx, cb);
            }
          });
        });
      }

      helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
        sign(0, tx, (txp) => {
          should.exist(txp.raw);
          txp.status.should.equal('accepted');
          const t = ChainService.getBitcoreTx(txp);

          // Check size and fee rate
          (txp.raw.length / 2).should.equal(t.size);
          const feeRate = t.getFee() / (x.fromSegwit ? t.vsize : t.size) * 1000;
          console.log(`Wire Size: ${t.size} vSize: ${t.vsize} (Segwit: ${x.fromSegwit}, SegwitVersion: ${x.segwitVersion || 0})  Fee:${t.getFee()} ActualRate:${Math.round(feeRate)} RequiredRate:${x.requiredFeeRate}`);

          // size should be above (or equal) the required FeeRate
          feeRate.should.not.be.below(x.requiredFeeRate);
          feeRate.should.be.below(x.requiredFeeRate * 1.5); // no more that 50% extra
          return cb(feeRate);
        });
      });
    };

    for (let i = 0; i < cases.length; i++) {
      const x = cases[i];
      x.i = i;
      x.m = x.m || 1;
      x.n = x.n || 1;

      it(`case  ${i} : ${x.name} (${x.m}-of-${x.n})`, async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(x.m, x.n, { useNativeSegwit: x.fromSegwit, segwitVersion: x.segwitVersion }));
        await helpers.stubUtxos(server, wallet, x.utxos);
        const info = await util.promisify(server.getSendMaxInfo).call(server, {
          feePerKb: x.requiredFeeRate,
          returnInputs: true,
        });
        should.exist(info);

        const txOpts = {
          outputs: x.outputs,
          payProUrl: 'aaa.com',
        };

        if (x.sendMax) {
          Object.assign(txOpts, {
            fee: info.fee,
            inputs: info.inputs
          });
          txOpts.outputs[0].amount = info.amount;
        } else {
          Object.assign(txOpts, { feePerKb: x.requiredFeeRate });
        }

        const fee1 = await new Promise<number>(r => checkTx(txOpts, x, r));
        should.exist(fee1);

        // CASE 8
        if (x.i == 8) {
          await helpers.beforeEach();
          // check with paypro fee is bigger.
          console.log(`## case ${x.i}: Again with no paypro`);
          ({ server, wallet } = await helpers.createAndJoinWallet(x.m, x.n, { useNativeSegwit: x.fromSegwit }));
          await helpers.stubUtxos(server, wallet, x.utxos);
          txOpts.payProUrl = null;
          const fee2 = await new Promise<number>(r => checkTx(txOpts, x, r));
          console.log(`## Fee PayPro: ${fee1} vs ${fee2}`);
          fee1.should.be.above(fee2);
        }
      });
    }
  });


  describe('Check requiredFeeRate  DOGE', function() {
    let server;
    let wallet;

    beforeEach(function() {
      helpers.stubFeeLevels({
        1: 40002,
        2: 1e8,
        24: 0.5e8,
      }, true);
    });

    const cases: {
      name: string;
      requiredFeeRate: number;
      utxos: (number | string)[];
      outputs: { toAddress: string, amount?: number }[];
      n?: number;
      sendMax?: boolean;
      fromSegwit?: boolean;
      i?: number;
      m?: number;
    }[] = [
      {
        name: 'Legacy',
        requiredFeeRate: 755000,
        utxos: [100],
        outputs: [{
          toAddress: 'DMHR9z3hVfEMkfsxfP7CbVtYdPh2f5ESqo',
          amount: 2048378600,
        }],
      },
      {
        n: 2,
        name: 'Legacy, sendmax',
        requiredFeeRate: 755000,
        sendMax: true,
        fromSegwit: false,
        utxos: [100],
        outputs: [{
          toAddress: 'DMHR9z3hVfEMkfsxfP7CbVtYdPh2f5ESqo',
        }],
      },
      {
        n: 2,
        name: 'Legacy, above min relay fee',
        requiredFeeRate: 1e8,
        fromSegwit: false,
        utxos: Array(10).fill(1), // 10 utxo's of 1 DOGE each
        outputs: [{
          toAddress: 'DMHR9z3hVfEMkfsxfP7CbVtYdPh2f5ESqo',
          amount: 8e8
        }]
      },
    ];

    function checkTx(txOpts, x, cb) {
      function sign(copayerM, tx, cb) {
        helpers.getAuthServer(wallet.copayers[copayerM].id).then(function(server) {
          const signatures = helpers.clientSign(tx, TestData.copayers[copayerM].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: tx.id,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err, err);

            if (++copayerM == x.m) {
              return cb(txp);
            } else {
              return sign(copayerM, tx, cb);
            }
          });
        });
      }

      helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
        sign(0, tx, (txp) => {
          should.exist(txp.raw);
          txp.status.should.equal('accepted');

          const t = ChainService.getBitcoreTx(txp);
          const vSize = x.vSize || t._estimateSize(); // use given vSize if available
          // Check size and fee rate
          const actualSize = txp.raw.length / 2;
          const actualFeeRate = t.getFee() / (x.fromSegwit ? vSize : actualSize) * 1000;
          console.log(`Wire Size:${actualSize} vSize: ${vSize} (Segwit: ${x.fromSegwit})  Fee: ${t.getFee()} ActualRate:${Math.round(actualFeeRate)} RequiredRate:${x.requiredFeeRate}`);

          // Fee should be more than min relay fee
          t.getFee().should.be.gte(CWC.BitcoreLibDoge.Transaction.DUST_AMOUNT);

          if (t.getFee() > CWC.BitcoreLibDoge.Transaction.DUST_AMOUNT) {
            // size should be above (or equal) the required FeeRate
            actualFeeRate.should.not.be.below(x.requiredFeeRate);
            actualFeeRate.should.be.below(x.requiredFeeRate * 1.5); // no more that 50% extra
          }
          return cb(actualFeeRate);
        });
      });
    };

    for (let i = 0; i < cases.length; i++) {
      const x = cases[i];
      x.i = i;
      x.m = x.m || 1;
      x.n = x.n || 1;

      it(`case ${i}: ${x.name} (${x.m}-of-${x.n})`, async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(x.m, x.n, { useNativeSegwit: x.fromSegwit, coin: 'doge' }));
        await helpers.stubUtxos(server, wallet, x.utxos);
        const info = await util.promisify(server.getSendMaxInfo).call(server, {
          feePerKb: x.requiredFeeRate,
          returnInputs: true,
        });
        should.exist(info);
        
        const txOpts = {
          outputs: x.outputs,
          payProUrl: 'aaa.com'
        };

        if (x.sendMax) {
          Object.assign(txOpts, {
            fee: info.fee,
            inputs: info.inputs
          });
          txOpts.outputs[0].amount = info.amount;
        } else {
          Object.assign(txOpts, { feePerKb: x.requiredFeeRate });
        }

        const fee1 = await new Promise<number>(r => checkTx(txOpts, x, r));
        should.exist(fee1);

        // CASE 8
        if (x.i == 8) {
          await helpers.beforeEach();
          // check with paypro fee is bigger.
          console.log(`## case ${x.i}: Again with no paypro`);
          ({ server, wallet } = await helpers.createAndJoinWallet(x.m, x.n, { useNativeSegwit: x.fromSegwit }));
          await helpers.stubUtxos(server, wallet, x.utxos);
          txOpts.payProUrl = null;
          const fee2 = await new Promise<number>(r => checkTx(txOpts, x, r));
          console.log(`## Fee PayPro: ${fee1} vs ${fee2}`);
          fee1.should.be.above(fee2);
        }
      });
    }
  });


  describe('#rejectTx', function() {
    let server;
    let wallet;
    let txid;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 2));
      const range1to8 = new Array(8).fill(0).map((_, i) => i + 1);
      await helpers.stubUtxos(server, wallet, range1to8);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10e8,
        }],
        feePerKb: 100e2,
      };
      const tx = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      should.exist(tx);
      txid = tx.id;
    });

    it('should reject a TX', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        const tx = txs[0];
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
              const actors = tx.getActors();
              actors.length.should.equal(1);
              actors[0].should.equal(wallet.copayers[0].id);
              const action = tx.getActionBy(wallet.copayers[0].id);
              action.type.should.equal('reject');
              action.comment.should.equal('some reason');
              done();
            });
          });
        });
      });
    });

    it('should fail to reject non-pending TX', async function() {
      let pendingTxs = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxs[0].id.should.equal(txid);
      
      await util.promisify(server.rejectTx).call(server, {
        txProposalId: txid,
        reason: 'some reason',
      });
      pendingTxs = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxs.should.be.empty;

      const s = await helpers.getAuthServer(wallet.copayers[1].id);
      try {
        await util.promisify(s.rejectTx).call(s, {
          txProposalId: txid,
          reason: 'some other reason',
        });
        throw new Error('should have thrown');
      } catch (err) {
        err.should.be.instanceof(ClientError);
        err.code.should.equal('TX_NOT_PENDING');
      }
    });
  });

  describe('#signTx', function() {
    describe('1-of-1 (BIP44 & P2PKH)', function() {
      let server;
      let wallet;
      let txid;

      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
        const from = await util.promisify(server.createAddress).call(server, {});
        await helpers.stubUtxos(server, wallet, [1, 2]);
        const txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 2.5e8,
          }],
          from,
          feePerKb: 100e2,
        };
        const tx = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
        should.exist(tx);
        tx.addressType.should.equal('P2PKH');
        txid = tx.id;
      });

      it('should sign a TX with multiple inputs, different paths, and return raw', function(done) {
        blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
        server.getPendingTxs({}, function(err, txs) {
          const tx = txs[0];
          tx.id.should.equal(txid);
          const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
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
              const tx = txs[0];
              should.not.exist(err);
              tx.status.should.equal('accepted');
              tx.raw.should.contain(signatures[0]);
              done();
            });
          });
        });
      });
    });

    describe('1-of-1 (BIP44 ETH)', function() {
      let server;
      let wallet;
      let txpid;

      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
        const from = await util.promisify(server.createAddress).call(server, {});
        await helpers.stubUtxos(server, wallet, [3]);
        const txOpts = {
          outputs: [{
            toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
            amount: 2.5e8,
          }],
          from,
          feePerKb: 100e2,
        };
        const tx = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
        should.exist(tx);
        tx.addressType.should.equal('P2PKH');
        txpid = tx.id;
      });

      it('should sign a TX and return raw', function(done) {
        blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
        server.getPendingTxs({}, function(err, txs) {
          const tx = txs[0];
          tx.id.should.equal(txpid);
          const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          should.not.exist(tx.raw);
          server.signTx({
            txProposalId: txpid,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('accepted');
            txp.raw.length.should.equal(1);
            // The raw Tx should contain the Signatures.
            txp.raw[0].length.should.equal(208);
            // this depends on transaction count stub
            txp.txid.should.equal('0x7805fbd1b393552dc3be013fcfdc00f5ba30a6c7931ca7c3b9832d9f69fbf7bc');

            // Get pending should also contains the raw TX
            server.getPendingTxs({}, function(err, txs) {
              const tx = txs[0];
              should.not.exist(err);
              tx.status.should.equal('accepted');
              txp.raw.length.should.equal(1);
              txp.raw[0].length.should.equal(208);
              done();
            });
          });
        });
      });

      it('should fail sign a TX  with empty signature', function(done) {
        blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
        server.getPendingTxs({}, function(err, txs) {
          const tx = txs[0];
          tx.id.should.equal(txpid);
          should.not.exist(tx.raw);
          server.signTx({
            txProposalId: txpid,
            signatures: '',
          }, function(err, txp) {
            err.should.be.instanceof(ClientError);
            err.code.should.contain('BAD_SIG');
            server.getPendingTxs({}, function(err, txs) {
              const tx = txs[0];
              should.not.exist(err);
              tx.status.should.equal('pending');
              done();
            });
          });
        });
      });

      it('should fail sign a TX  with wrong signature', function(done) {
        blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
        server.getPendingTxs({}, function(err, txs) {
          const tx = txs[0];
          tx.id.should.equal(txpid);
          should.not.exist(tx.raw);
          server.signTx({
            txProposalId: txpid,
            signatures: 'a bad signature',
          }, function(err, txp) {
            err.should.be.instanceof(ClientError);
            err.code.should.contain('BAD_SIG');
            server.getPendingTxs({}, function(err, txs) {
              const tx = txs[0];
              should.not.exist(err);
              tx.status.should.equal('pending');
              done();
            });
          });
        });
      });
    });

    describe('Multisig', function() {
      let server;
      let wallet;
      let txid;

      beforeEach(async function() {
        ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));
        const range1to8 = new Array(8).fill(0).map((_, i) => i + 1);
        await helpers.stubUtxos(server, wallet, range1to8);
        const txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 20e8,
          }],
          feePerKb: 100e2,
        };
        const tx = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
        should.exist(tx);
        txid = tx.id;
      });

      it('should sign a TX with multiple inputs, different paths', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          const tx = txs[0];
          tx.id.should.equal(txid);

          const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err);
            should.not.exist(tx.raw);
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              const tx = txs[0];
              tx.id.should.equal(txid);

              const actors = tx.getActors();
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
          const tx = txs[0];
          tx.id.should.equal(txid);
          const signatures = helpers.clientSign(tx, TestData.copayers[1].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            err.should.be.instanceof(ClientError);
            err.code.should.equal('BAD_SIGNATURES');
            done();
          });
        });
      });

      it('should fail if one signature is broken', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          const tx = txs[0];
          tx.id.should.equal(txid);

          const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
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
          const tx = txs[0];
          tx.id.should.equal(txid);

          const signatures = ['11', '22', '33', '44', '55'];
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
          const tx = txs[0];
          tx.id.should.equal(txid);

          const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H).slice(0, tx.inputs.length - 1);
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
          const tx = txs[0];
          tx.id.should.equal(txid);

          const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            server.rejectTx({
              txProposalId: txid,
            }, function(err) {
              err.should.be.instanceof(ClientError);
              err.code.should.contain('COPAYER_VOTED');
              done();
            });
          });
        });
      });

      it('should fail when rejected a previously signed TX', function(done) {
        server.getPendingTxs({}, function(err, txs) {
          const tx = txs[0];
          tx.id.should.equal(txid);

          server.rejectTx({
            txProposalId: txid,
          }, function(err) {
            const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
            server.signTx({
              txProposalId: txid,
              signatures: signatures,
            }, function(err) {
              err.should.be.instanceof(ClientError);
              err.code.should.contain('COPAYER_VOTED');
              done();
            });
          });
        });
      });

      it('should fail to sign a non-pending TX', async function() {
        await util.promisify(server.rejectTx).call(server, {
          txProposalId: txid,
          reason: 'some reason',
        });
        const copayer1Server = await helpers.getAuthServer(wallet.copayers[1].id);
        await util.promisify(copayer1Server.rejectTx).call(copayer1Server, {
          txProposalId: txid,
          reason: 'some reason',
        });
           
        const pendingTxs = await util.promisify(server.getPendingTxs).call(server, {});
        pendingTxs.should.be.empty;
        const copayer2Server = await helpers.getAuthServer(wallet.copayers[2].id);
        const tx = await util.promisify(copayer2Server.getTx).call(copayer2Server, {
          txProposalId: txid
        });
        const signatures = helpers.clientSign(tx, TestData.copayers[2].xPrivKey_44H_0H_0H);
        try {
          await util.promisify(copayer2Server.signTx).call(copayer2Server, {
            txProposalId: txid,
            signatures: signatures,
          });
          throw new Error('should have thrown');
        } catch (err) {
          err.should.be.instanceof(ClientError);
          err.code.should.equal('TX_NOT_PENDING');
        }
      });
    });
  });

  describe('#broadcastTx & #broadcastRawTx', function() {
    let server;
    let wallet;
    let txpid;
    let txid;

    beforeEach(async function() {
      ({ wallet, server } = await helpers.createAndJoinWallet(1, 1));
      await helpers.stubUtxos(server, wallet, [10, 10]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 9e8,
        }],
        message: 'some message',
        feePerKb: 100e2,
      };
      let txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      should.exist(txp);
      const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
      txp = await util.promisify(server.signTx).call(server, {
        txProposalId: txp.id,
        signatures: signatures,
      });
      should.exist(txp);
      txp.isAccepted().should.be.true;
      txp.isBroadcasted().should.be.false;
      txid = txp.txid;
      txpid = txp.id;
    });

    it('should broadcast a tx', function(done) {
      const clock = sinon.useFakeTimers({ now: 1234000, toFake: ['Date'] });
      helpers.stubBroadcast(txid);
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.exist(txp.raw);
          // used to be like this. No sure why we won't like raw to be shown.
          // should.not.exist(txp.raw);
          txp.txid.should.equal(txid);
          txp.isBroadcasted().should.be.true;
          txp.broadcastedOn.should.equal(1234);
          clock.restore();
          done();
        });
      });
    });

    it('should broadcast a tx and set locktime & version', function(done) {
      const clock = sinon.useFakeTimers({ now: 1234000, toFake: ['Date'] });
      helpers.stubBroadcast(txid);
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.exist(txp.raw);
          const tx = new Bitcore.Transaction(txp.raw);
          clock.restore();
          done();
        });
      });
    });

    it('should broadcast a raw tx', function(done) {
      helpers.stubBroadcast(txid);
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
      helpers.stubBroadcast(txid);
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.broadcastTx({
          txProposalId: txpid
        }, function(err) {
          should.exist(err);
          err.should.be.instanceof(ClientError);
          err.code.should.equal('TX_ALREADY_BROADCASTED');
          done();
        });
      });
    });

    it('should fail to brodcast a tx is txid is wrong', function(done) {
      helpers.stubBroadcast('xx');
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.exist(err);
        err.should.contain('broadcast error');
        done();
      });
    });

    it('should auto process already broadcasted txs', function(done) {
      helpers.stubBroadcast(txid);
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

    it('should process only broadcasted txs', async function() {
      helpers.stubBroadcast(txid);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 9e8,
        }],
        feePerKb: 100e2,
      };
      const txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      let pendingTxs = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxs.length.should.equal(2);
      blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, {
        txid: 999
      });
      pendingTxs = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxs.length.should.equal(1);
      pendingTxs[0].status.should.equal('pending');
      should.not.exist(pendingTxs[0].txid);
    });

    it('should fail to brodcast a not yet accepted tx', function(done) {
      helpers.stubBroadcast(txid);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 9e8,
        }],
        feePerKb: 100e2,
      };
      helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(txp) {
        should.exist(txp);
        server.broadcastTx({
          txProposalId: txp.id
        }, function(err) {
          should.exist(err);
          err.should.be.instanceof(ClientError);
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

  describe('#broadcastTx ETH', function() {
    let server;
    let wallet;
    let txpid;
    let txid;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      const from = await util.promisify(server.createAddress).call(server, {});
      await helpers.stubUtxos(server, wallet, [10, 10]);
      const txOpts = {
        outputs: [{
          toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
          amount: 9e8,
        }],
        from,
        message: 'some message',
        feePerKb: 100e2,
      };
      let txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      should.exist(txp);
      const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
      txp = await util.promisify(server.signTx).call(server, {
        txProposalId: txp.id,
        signatures: signatures,
      });
      should.exist(txp);
      txp.isAccepted().should.be.true;
      txp.isBroadcasted().should.be.false;
      txid = txp.txid;
      txpid = txp.id;
    });

    it('should broadcast a tx', function(done) {
      const clock = sinon.useFakeTimers({ now: 1234000, toFake: ['Date'] });
      helpers.stubBroadcast(txid);
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.exist(txp.raw);
          // used to be like this. No sure why we won't like raw to be shown.
          // should.not.exist(txp.raw);
          txp.txid.should.equal(txid);
          txp.isBroadcasted().should.be.true;
          txp.broadcastedOn.should.equal(1234);
          clock.restore();
          done();
        });
      });
    });
  });

  describe('Tx proposal workflow', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));
      const range1to8 = new Array(8).fill(0).map((_, i) => i + 1);
      await helpers.stubUtxos(server, wallet, range1to8);
    });

    it('other copayers should see pending proposal created by one copayer', async function() {
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10e8
        }],
        feePerKb: 100e2,
        message: 'some message',
      };
      const txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      should.exist(txp);
      const server2 = await helpers.getAuthServer(wallet.copayers[1].id);
      const txps = await util.promisify(server2.getPendingTxs).call(server2, {});
      txps.length.should.equal(1);
      txps[0].id.should.equal(txp.id);
      txps[0].message.should.equal('some message');
    });
  
    it('tx proposals should not be finally accepted until quorum is reached', async function() {
      const from = await util.promisify(server.createAddress).call(server, {});
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10e8
        }],
        from,
        feePerKb: 100e2,
        message: 'some message',
      };
      let txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      should.exist(txp);
      const txpId = txp.id;
      let pendingTxps = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxps.length.should.equal(1);
      txp = pendingTxps[0];
      txp.actions.should.be.empty;
      
      // Copayer0 signs
      let signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
      await util.promisify(server.signTx).call(server, {
        txProposalId: txpId,
        signatures: signatures,
      });
      pendingTxps = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxps.length.should.equal(1);
      txp = pendingTxps[0];
      txp.isPending().should.be.true;
      txp.isAccepted().should.be.false;
      txp.isRejected().should.be.false;
      txp.isBroadcasted().should.be.false;
      txp.actions.length.should.equal(1);
      const action = txp.getActionBy(wallet.copayers[0].id);
      action.type.should.equal('accept');
      let notifications = await util.promisify(server.getNotifications).call(server, {});
      let last = notifications[notifications.length - 1];
      last.type.should.not.equal('TxProposalFinallyAccepted');
      
      // Copayer1 signs
      const s = await helpers.getAuthServer(wallet.copayers[1].id);
      signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
      await util.promisify(s.signTx).call(s, {
        txProposalId: txpId,
        signatures: signatures,
      });
      pendingTxps = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxps.length.should.equal(1);
      txp = pendingTxps[0];
      txp.isPending().should.be.true;
      txp.isAccepted().should.be.true;
      txp.isBroadcasted().should.be.false;
      should.exist(txp.txid);
      txp.actions.length.should.equal(2);
      notifications = await util.promisify(server.getNotifications).call(server, {});
      last = notifications[notifications.length - 1];
      last.type.should.equal('TxProposalFinallyAccepted');
      last.walletId.should.equal(wallet.id);
      last.creatorId.should.equal(wallet.copayers[1].id);
      last.data.txProposalId.should.equal(txp.id);
    });

    it('tx proposals should accept as many rejections as possible without finally rejecting', async function() {
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 10e8
        }],
        feePerKb: 100e2,
        message: 'some message',
      };
      let txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      should.exist(txp);
      const txpId = txp.id;
      let pendingTxps = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxps.length.should.equal(1);
      txp = pendingTxps[0];
      txp.actions.should.be.empty;

      await util.promisify(server.rejectTx).call(server, {
        txProposalId: txpId,
        reason: 'just because'
      });
      pendingTxps = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxps.length.should.equal(1);
      txp = pendingTxps[0];
      txp.isPending().should.be.true;
      txp.isRejected().should.be.false;
      txp.isAccepted().should.be.false;
      txp.actions.length.should.equal(1);
      const action = txp.getActionBy(wallet.copayers[0].id);
      action.type.should.equal('reject');
      action.comment.should.equal('just because');
      
      const s = await helpers.getAuthServer(wallet.copayers[1].id);
      await util.promisify(s.rejectTx).call(s, {
        txProposalId: txpId,
        reason: 'some other reason'
      });
      pendingTxps = await util.promisify(server.getPendingTxs).call(server, {});
      pendingTxps.length.should.equal(0);
            
      txp = await util.promisify(server.getTx).call(server, {
        txProposalId: txpId
      });
      txp.isPending().should.be.false;
      txp.isRejected().should.be.true;
      txp.isAccepted().should.be.false;
      txp.actions.length.should.equal(2);
    });
  });

  describe('#getTx', function() {
    let server;
    let wallet;
    let txpid;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));
      await helpers.stubUtxos(server, wallet, 1);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.5e8
        }],
        feePerKb: 100e2,
        message: 'some message',
      };
      const txp = await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      should.exist(txp);
      txpid = txp.id;
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
      helpers.getAuthServer(wallet.copayers[1].id).then(function(server2) {
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
        err.should.be.instanceof(ClientError);
        err.code.should.equal('TX_NOT_FOUND');
        err.message.should.equal('Transaction proposal not found');
        done();
      });
    });
    
    it.skip('should get accepted/rejected transaction proposal', function(done) { });
    
    it.skip('should get broadcasted transaction proposal', function(done) { });
  });

  describe('#getTxs', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      this.timeout(5000);
      const clock = sinon.useFakeTimers({ toFake: ['Date'] });
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
      const range1to10 = new Array(10).fill(0).map((_, i) => i + 1);
      await helpers.stubUtxos(server, wallet, range1to10);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.1e8
        }],
        feePerKb: 100e2,
        message: 'some message',
      };
      for (let i = 0; i < 10; i++) {
        clock.tick(10 * 1000);
        await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      }
      clock.restore();
    });

    it('should pull 4 txs, down to to time 60', function(done) {
      server.getTxs({
        minTs: 60,
        limit: 8
      }, function(err, txps) {
        should.not.exist(err);
        const times = txps.map(txp => txp.createdOn);
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
        const times = txps.map(txp => txp.createdOn);
        times.should.deep.equal([50, 40, 30, 20, 10]);
        done();
      });
    });

    it('should pull the last 4 txs', function(done) {
      server.getTxs({
        limit: 4
      }, function(err, txps) {
        should.not.exist(err);
        const times = txps.map(txp => txp.createdOn);
        times.should.deep.equal([100, 90, 80, 70]);
        done();
      });
    });

    it('should pull all txs', function(done) {
      server.getTxs({}, function(err, txps) {
        should.not.exist(err);
        const times = txps.map(txp => txp.createdOn);
        times.should.deep.equal([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
        done();
      });
    });

    it('should txs from times 50 to 70', function(done) {
      server.getTxs({
        minTs: 50,
        maxTs: 70,
      }, function(err, txps) {
        should.not.exist(err);
        const times = txps.map(txp => txp.createdOn);
        times.should.deep.equal([70, 60, 50]);
        done();
      });
    });
  });

  describe('#getNotifications', function() {
    let clock;
    let server;
    let wallet;

    beforeEach(async function() {
      clock = sinon.useFakeTimers({ now: 10 * 1000, toFake: ['Date'] });
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
      clock.tick(25 * 1000);
      const range0to4 = new Array(4).fill(0).map((_, i) => i);
      await helpers.stubUtxos(server, wallet, range0to4);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.1e8
        }],
        feePerKb: 100e2,
        message: 'some message',
      };
      for (let i = 0; i < 3; i++) {
        clock.tick(25 * 1000);
        await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      }
      clock.tick(20 * 1000);
    });

    afterEach(function() {
      clock.restore();
    });

    it('should pull all notifications', function(done) {
      server.getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        const types = notifications.map(n => n.type);
        types.should.deep.equal(['NewCopayer', 'NewAddress', 'NewAddress', 'NewTxProposal', 'NewTxProposal', 'NewTxProposal']);
        const walletIds = Array.from(new Set(notifications.map(n => n.walletId)));
        walletIds.length.should.equal(1);
        walletIds[0].should.equal(wallet.id);
        const creators = Array.from(new Set(notifications.map(n => n.creatorId).filter(c => !!c)));
        creators.length.should.equal(1);
        creators[0].should.equal(wallet.copayers[0].id);
        done();
      });
    });
    it('should pull new payment notifications with correct format', function(done) {
      let s2;
      let w2;
      let addr;
      helpers.createAndJoinWallet(1, 1, { coin: 'bch' }).then(function({ server: s, wallet: w }) {
        s2 = s;
        w2 = w;
        clock.tick(25 * 1000);
        helpers.createAddresses(s2, w2, 1, 1).then(function({ main, change }) {
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
              const types = notifications.map(n => n.type);
              types.should.deep.equal(['NewCopayer', 'NewIncomingTx']);
              const walletIds = Array.from(new Set(notifications.map(n => n.walletId)));
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
      server.walletId = 'btc:livenet';
      server._notify('NewBlock', {
        hash: 'dummy hash',
      }, {
        isGlobal: true
      }, function(err) {
        should.not.exist(err);
        server.walletId = 'btc:testnet';
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
            const types = notifications.map(n => n.type);
            types.should.deep.equal(['NewTxProposal', 'NewTxProposal', 'NewBlock']);
            const walletIds = Array.from(new Set(notifications.map(n => n.walletId)));
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
        const types = notifications.map(n => n.type);
        types.should.deep.equal(['NewTxProposal', 'NewTxProposal']);
        done();
      });
    });

    it('should pull notifications after a given notification id', function(done) {
      server.getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        const from = notifications.slice(-2)[0].id; // second to last
        server.getNotifications({
          notificationId: from,
          minTs: +Date.now() - (60 * 1000),
        }, function(err, res) {
          should.not.exist(err);
          res.length.should.equal(1);
          res[0].id.should.equal(notifications[notifications.length -1].id);
          done();
        });
      });
    });

    it('should return empty if no notifications found after a given id', function(done) {
      server.getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        const from = notifications[notifications.length - 1].id; // last one
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
        const newCopayer = notifications[0];
        newCopayer.type.should.equal('NewCopayer');
        newCopayer.walletId.should.equal(wallet.id);
        newCopayer.creatorId.should.equal(wallet.copayers[0].id);
        done();
      });
    });

    it('should notify sign and acceptance', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
        const tx = txs[0];
        const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          server.getNotifications({
            minTs: Date.now(),
          }, function(err, notifications) {
            should.not.exist(err);
            notifications.length.should.equal(2);
            const types = notifications.map(n => n.type);
            types.should.deep.equal(['TxProposalAcceptedBy', 'TxProposalFinallyAccepted']);
            done();
          });
        });
      });
    });

    it('should notify rejection', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        const tx = txs[1];
        server.rejectTx({
          txProposalId: tx.id,
        }, function(err) {
          should.not.exist(err);
          server.getNotifications({
            minTs: Date.now(),
          }, function(err, notifications) {
            should.not.exist(err);
            notifications.length.should.equal(2);
            const types = notifications.map(n => n.type);
            types.should.deep.equal(['TxProposalRejectedBy', 'TxProposalFinallyRejected']);
            done();
          });
        });
      });
    });
  
    it('should notify sign, acceptance, and broadcast, and emit', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        const tx = txs[2];
        const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err, tx) {
          should.not.exist(err);
          helpers.stubBroadcast(tx.txid);
          server.broadcastTx({
            txProposalId: tx.id
          }, function(err, txp) {
            should.not.exist(err);
            server.getNotifications({
              minTs: Date.now(),
            }, function(err, notifications) {
              should.not.exist(err);
              notifications.length.should.equal(3);
              const types = notifications.map(n => n.type);
              types.should.deep.equal(['TxProposalAcceptedBy', 'TxProposalFinallyAccepted', 'NewOutgoingTx']);
              done();
            });
          });
        });
      });
    });

    it('should notify sign, acceptance, and broadcast, and emit (with 3rd party broadcast', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        const tx = txs[2];
        const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
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
              const types = notifications.map(n => n.type);
              types.should.deep.equal(['TxProposalAcceptedBy', 'TxProposalFinallyAccepted', 'NewOutgoingTxByThirdParty']);
              done();
            });
          });
        });
      });
    });
  });

  describe('#removePendingTx', function() {
    let server;
    let wallet;
    let txp;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));
      await helpers.stubUtxos(server, wallet, [1, 2]);
      const txOpts = {
        outputs: [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 0.8e8
        }],
        feePerKb: 100e2,
        message: 'some message',
      };
      await helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0);
      const txs = await util.promisify(server.getPendingTxs).call(server, {});
      txp = txs[0];
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
      const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
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
  
    it('should fail to remove non-pending TX', async function() {
      const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
      await util.promisify(server.signTx).call(server, {
        txProposalId: txp.id,
        signatures: signatures,
      });
      const copayer1Server = await helpers.getAuthServer(wallet.copayers[1].id);
      await util.promisify(copayer1Server.rejectTx).call(copayer1Server, {
        txProposalId: txp.id,
      });
      const copayer2Server = await helpers.getAuthServer(wallet.copayers[2].id);
      await util.promisify(copayer2Server.rejectTx).call(copayer2Server, {
        txProposalId: txp.id,
      });

      const txs = await util.promisify(server.getPendingTxs).call(server, {});
      txs.should.be.empty;

      try {
        await util.promisify(server.removePendingTx).call(server, {
          txProposalId: txp.id
        });
        throw new Error('should have thrown');
      } catch (err) {
        err.should.be.instanceof(ClientError);
        err.code.should.equal('TX_NOT_PENDING');
      } 
    });

    it('should not allow non-creator copayer to remove an unsigned TX ', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id).then(function(server2) {
        server2.removePendingTx({
          txProposalId: txp.id
        }, function(err) {
          should.exist(err);
          err.should.be.instanceof(ClientError);
          err.code.should.contain('TX_CANNOT_REMOVE');
          server2.getPendingTxs({}, function(err, txs) {
            txs.length.should.equal(1);
            done();
          });
        });
      });
    });
  
    it('should not allow creator copayer to remove a TX signed by other copayer, in less than 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id).then(function(server2) {
        const signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            err.should.be.instanceof(ClientError);
            err.code.should.equal('TX_CANNOT_REMOVE');
            err.message.should.contain('Cannot remove');
            done();
          });
        });
      });
    });

    it('should allow creator copayer to remove a TX rejected by other copayer, in less than 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id).then(function(server2) {
        const signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
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
      helpers.getAuthServer(wallet.copayers[1].id).then(function(server2) {
        const signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs[0].deleteLockTime.should.be.above(Defaults.DELETE_LOCKTIME - 10);
            const clock = sinon.useFakeTimers({ now: Date.now() + 1 + 24 * 3600 * 1000, toFake: ['Date'] });
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
      helpers.getAuthServer(wallet.copayers[1].id).then(function(server2) {
        const signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_44H_0H_0H);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          const clock = sinon.useFakeTimers({ now: Date.now() + 2000 + Defaults.DELETE_LOCKTIME * 1000, toFake: ['Date'] });
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

  describe('#scan', function() {
    let server;
    let wallet;

    describe('1-of-1 wallet (BIP44 & P2PKH)', function() {
      beforeEach(async function() {
        this.timeout(5000);
        sinon.stub(Defaults, 'SCAN_ADDRESS_GAP').value(2);
        ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
      });

      it('should scan main addresses', function(done) {
        helpers.stubAddressActivity([
          '1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
          '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
          '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
        ]);
        const expectedPaths = [
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
              const paths = addresses.map(n => n.path);
              paths.sort((a, b) => a - b); // ensure in same order as expectedPaths
              paths.should.deep.equal(expectedPaths);
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
        helpers.stubAddressActivity([
          '1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
          '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
          '1DY9exavapgnCUWDnSTJe1BPzXcpgwAQC4', // m/0/5
          '1LD7Cr68LvBPTUeXrr6YXfGrogR7TVj3WQ', // m/1/3
        ]);
        const expectedPaths = [
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
              const paths = addresses.map(n => n.path);
              paths.sort((a, b) => a - b); // ensure in same order as expectedPaths
              paths.should.deep.equal(expectedPaths);
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
                err.should.be.instanceof(ClientError);
                err.code.should.equal('WALLET_NEED_SCAN');
                done();
              });
            });
          });
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
                err.should.be.instanceof(ClientError);
                err.code.should.equal('WALLET_NEED_SCAN');
                done();
              });
            });
          });
        });
      });

      it.skip('index cache: should use cache, if previous scan failed', function(done) {
        helpers.stubAddressActivity([
          '1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
          '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
          '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
        ], 4);

        // First without activity
        const addr = '1KbTiFvjbN6B5reCVS4tTT49vPQkvsqnE2'; // m/0/3

        server.scan({ startingStep: 1 }, function(err) {
          should.exist('failed on request');
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            // Because it failed
            wallet.addressManager.receiveAddressIndex.should.equal(0);
            wallet.addressManager.changeAddressIndex.should.equal(0);

            helpers.stubAddressActivity([
              '1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
              '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
              '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
            ], -1);
            const getAddressActivitySpy = sinon.spy(blockchainExplorer, 'getAddressActivity');

            server.scan({ startingStep: 1 }, function(err) {
              should.not.exist(err);
              // should prederive 3 address, so
              // First call should be m/0/3
              const calls = getAddressActivitySpy.getCalls();
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
        helpers.stubAddressActivity([
          '1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
          '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
          '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
        ]);

        // First without activity
        const addr = '1KbTiFvjbN6B5reCVS4tTT49vPQkvsqnE2'; // m/0/3

        const startingStep = Infinity; // TODO what should this be?
        server.scan({ startingStep }, function(err) {
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.addressManager.receiveAddressIndex.should.equal(3);
            wallet.addressManager.changeAddressIndex.should.equal(1);

            const getAddressActivitySpy = sinon.spy(blockchainExplorer, 'getAddressActivity');

            server.scan({}, function(err) {
              should.not.exist(err);
              const calls = getAddressActivitySpy.getCalls();
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
        sinon.stub(Defaults, 'SCAN_ADDRESS_GAP').value(5);
        helpers.stubAddressActivity([
          '1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
          '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
          '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
        ]);

        // First without activity
        const addr = '1KbTiFvjbN6B5reCVS4tTT49vPQkvsqnE2'; // m/0/3

        server.scan({ startingStep: 1000 }, function(err) {
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.addressManager.receiveAddressIndex.should.equal(3);
            wallet.addressManager.changeAddressIndex.should.equal(1);
            server.getAddresses({ noChange: true }, function(err, addr) {
              should.not.exist(err);
              addr.length.should.equal(3);
              done();
            });
          });
        });
      });

      it('powerScan: should add skipped addresses', function(done) {
        sinon.stub(Defaults, 'SCAN_ADDRESS_GAP').value(5);
        this.timeout(10000);
        helpers.stubAddressActivity([
          '1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0
          '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/2
          '1Lz4eBV8xVkSGkjhHSRkgQvi79ieYgWJWc', // m/0/99
          '1HhAmuUfUszfAdK1jyumvBQoSj9tLB3PE',  // m/0/199
          '1PTrZzp5Kk78uVxnPUHYEHBktADgv3RhrC', // m/0/200
          '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/1/0
          '12vSXvVzY1KjAVRz18KrsKgMoy89fQ7Xo4', // m/1/9
        ]);

        // First without activity
        const addr = '1KbTiFvjbN6B5reCVS4tTT49vPQkvsqnE2'; // m/0/3

        server.scan({ startingStep: 1000 }, function(err) {
          should.not.exist(err);
          server.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            wallet.addressManager.receiveAddressIndex.should.equal(201);
            wallet.addressManager.changeAddressIndex.should.equal(10);
            server.getAddresses({ noChange: true }, function(err, addr) {
              should.not.exist(err);
              // 201 MAIN addresses (0 to 200)
              addr.length.should.equal(201);
              done();
            });
          });
        });
      });
    });
  });

  describe('#startScan', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      this.timeout(5000);
      sinon.stub(Defaults, 'SCAN_ADDRESS_GAP').value(2);
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, {}));
    });

    afterEach(function() {
      server.messageBroker.removeAllListeners();
    });

    it('should start an asynchronous scan', function(done) {
      helpers.stubAddressActivity([
        '1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG', // m/0/0/0
        '1GdXraZ1gtoVAvBh49D4hK9xLm6SKgesoE', // m/0/0/2
        '1FUzgKcyPJsYwDLUEVJYeE2N3KVaoxTjGS', // m/0/1/0
      ]);
      const expectedPaths = [
        'm/0/0',
        'm/0/1',
        'm/0/2',
        'm/1/0',
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
              const paths = addresses.map(n => n.path);
              paths.sort((a, b) => a - b); // ensure in same order as expectedPaths
              paths.should.deep.equal(expectedPaths);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                address.path.should.equal('m/0/3');
                done();
              });
            });
          });
        }
      });
      server.startScan({}, function(err, ret) {
        should.not.exist(err);
        ret.started.should.equal(true);
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
      sinon.stub(Defaults, 'SCAN_ADDRESS_GAP').value(1);

      let scans = 0;
      server.messageBroker.onMessage(function(n) {
        if (n.type == 'ScanFinished') {
          scans++;
          if (scans == 2) done();
        }
      });

      // Create a second wallet
      const server2 = new WalletService();
      const opts = {
        name: 'second wallet',
        m: 1,
        n: 1,
        pubKey: TestData.keyPair.pub,
      };
      server2.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        const copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'copayer 1',
          xPubKey: TestData.copayers[3].xPubKey_45H,
          requestPubKey: TestData.copayers[3].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId).then(function(server2) {
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

  describe('#startScan ETH', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      this.timeout(5000);
      sinon.stub(Defaults, 'SCAN_ADDRESS_GAP').value(2);
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
    });

    afterEach(function() {
      server.messageBroker.removeAllListeners();
    });

    it('should start an asynchronous scan', function(done) {
      server.startScan({}, function(err, ret) {
        should.not.exist(err);
        should.exist(ret);
        ret.should.deep.equal({ started: true });
        return done();
      });
    });
  });


  describe('PayPro', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
    });

    it('should create a paypro tx', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2]).then(function() {
        const txOpts = {
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
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));
    });

    it('should subscribe copayer to push notifications service (backward compatible)', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id).then(function(server) {
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
            const s = subs[0];
            s.token.should.equal('DEVICE_TOKEN');
            s.packageName.should.equal('com.wallet');
            s.platform.should.equal('Android');
            done();
          });
        });
      });
    });

    it('should subscribe copayer to push notifications service', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id).then(function(server) {
        should.exist(server);
        server.pushNotificationsSubscribe({
          token: 'DEVICE_TOKEN',
          packageName: 'com.wallet',
          platform: 'Android',
          walletId: '123'
        }, function(err) {
          should.not.exist(err);
          server.storage.fetchPushNotificationSubs(wallet.copayers[0].id, function(err, subs) {
            should.not.exist(err);
            should.exist(subs);
            subs.length.should.equal(1);
            const s = subs[0];
            s.token.should.equal('DEVICE_TOKEN');
            s.packageName.should.equal('com.wallet');
            s.platform.should.equal('Android');
            done();
          });
        });
      });
    });

    it('should allow multiple subscriptions for the same copayer (backward compatible)', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id).then(function(server) {
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

    it('should allow multiple subscriptions for the same copayer', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id).then(function(server) {
        should.exist(server);
        server.pushNotificationsSubscribe({
          token: 'DEVICE_TOKEN',
          packageName: 'com.wallet',
          platform: 'Android',
          walletId: '123'
        }, function(err) {
          server.pushNotificationsSubscribe({
            token: 'DEVICE_TOKEN2',
            packageName: 'com.my-other-wallet',
            platform: 'iOS',
            walletId: '123'
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

    it('should unsubscribe copayer to push notifications service (backward compatible)', async function() {
      const copayer0Server = await helpers.getAuthServer(wallet.copayers[0].id);
      should.exist(copayer0Server);
      await util.promisify(copayer0Server.pushNotificationsSubscribe).call(copayer0Server, {
        token: 'DEVICE_TOKEN',
        packageName: 'com.wallet',
        platform: 'Android',
      });
      await util.promisify(copayer0Server.pushNotificationsSubscribe).call(copayer0Server, {
        token: 'DEVICE_TOKEN2',
        packageName: 'com.my-other-wallet',
        platform: 'iOS'
      });
      await util.promisify(copayer0Server.pushNotificationsUnsubscribe).call(copayer0Server, {
        token: 'DEVICE_TOKEN2'
      });
      let subs = await util.promisify(server.storage.fetchPushNotificationSubs).call(server.storage, wallet.copayers[0].id);
      should.exist(subs);
      subs.length.should.equal(1);
      subs[0].token.should.equal('DEVICE_TOKEN');
      
      const copayer1Server = await helpers.getAuthServer(wallet.copayers[1].id);
      await util.promisify(copayer1Server.pushNotificationsUnsubscribe).call(copayer1Server, {
        token: 'DEVICE_TOKEN'
      });
      
      subs = await util.promisify(server.storage.fetchPushNotificationSubs).call(server.storage, wallet.copayers[0].id);
      should.exist(subs);
      subs.length.should.equal(1);
      subs[0].token.should.equal('DEVICE_TOKEN');
    });

    it('should unsubscribe copayer to push notifications service', async function() {
      const server = await helpers.getAuthServer(wallet.copayers[0].id);
      should.exist(server);
      
      await util.promisify(server.pushNotificationsSubscribe).call(server, {
        token: 'DEVICE_TOKEN',
        packageName: 'com.wallet',
        platform: 'Android',
        walletId: '123'
      });
      await util.promisify(server.pushNotificationsSubscribe).call(server, {
        token: 'DEVICE_TOKEN2',
        packageName: 'com.my-other-wallet',
        platform: 'iOS',
        walletId: '123'
      });
            
      await util.promisify(server.pushNotificationsUnsubscribe).call(server, {
        token: 'DEVICE_TOKEN2'
      });
      let subs = await util.promisify(server.storage.fetchPushNotificationSubs).call(server.storage, wallet.copayers[0].id);
      should.exist(subs);
      subs.length.should.equal(1);
      subs[0].token.should.equal('DEVICE_TOKEN');
            
      const copayer1Server = await helpers.getAuthServer(wallet.copayers[1].id);
      await util.promisify(copayer1Server.pushNotificationsUnsubscribe).call(copayer1Server, {
        token: 'DEVICE_TOKEN'
      });
      
      subs = await util.promisify(server.storage.fetchPushNotificationSubs).call(server.storage, wallet.copayers[0].id);
      should.exist(subs);
      subs.length.should.equal(1);
      subs[0].token.should.equal('DEVICE_TOKEN');
    });
  });

  describe('Tx confirmation notifications', function() {
    this.timeout(5000);
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 3));
    });

    it('should subscribe copayer to a tx confirmation', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id).then(function(server) {
        should.exist(server);
        server.txConfirmationSubscribe({
          txid: '123',
        }, async function(err) {
          should.not.exist(err);
          const stream = server.storage.streamActiveTxConfirmationSubs(wallet.copayers[0].id, ['123']);
          const txSub = (await stream.next());
          should.exist(txSub);
          txSub.txid.should.equal('123');
          txSub.isActive.should.be.true;
          done();
        });
      });
    });

    it('should overwrite last subscription', function(done) {
      helpers.getAuthServer(wallet.copayers[0].id).then(function(server) {
        should.exist(server);
        server.txConfirmationSubscribe({
          txid: '123',
        }, function(err) {
          server.txConfirmationSubscribe({
            txid: '123',
          }, async function(err) {
            should.not.exist(err);
            const stream = server.storage.streamActiveTxConfirmationSubs(wallet.copayers[0].id, ['123']);
            let txSub = (await stream.next());
            should.exist(txSub);
            txSub.txid.should.equal('123');
            txSub = (await stream.next());
            should.not.exist(txSub);
            done();
          });
        });
      });
    });

    it('should unsubscribe copayer to the specified tx', async function() {
      const server = await helpers.getAuthServer(wallet.copayers[0].id);
      should.exist(server);
      await util.promisify(server.txConfirmationSubscribe).call(server, {
        txid: '123',
      });
      await util.promisify(server.txConfirmationSubscribe).call(server, {
        txid: '456',
      });
      await util.promisify(server.txConfirmationUnsubscribe).call(server, {
        txid: '123',
      });

      let stream = server.storage.streamActiveTxConfirmationSubs(wallet.copayers[0].id, ['456']);
      let txSub = (await stream.next());
      should.exist(txSub);
      txSub.txid.should.equal('456');
      const copayer1Server = await helpers.getAuthServer(wallet.copayers[1].id);
      await util.promisify(copayer1Server.txConfirmationUnsubscribe).call(copayer1Server, {
        txid: '456'
      });

      stream = server.storage.streamActiveTxConfirmationSubs(wallet.copayers[0].id, ['456']);
      txSub = (await stream.next());
      should.exist(txSub);
      txSub.txid.should.equal('456');
    });
  });

  describe('#getWalletFromIdentifier', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, {}));
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
      helpers.stubBroadcast('111');
      helpers.stubUtxos(server, wallet, '1 btc').then(function() {
        const txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 1000e2
          }],
          feePerKb: 100e2,
          message: 'some message',
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(txp) {
          should.exist(txp);
          const signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_44H_0H_0H);
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

  describe('Sync wallet', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
      wallet.copayers[0].id.should.equal(TestData.copayers[0].id44btc);
    });

    it('should create and register and address', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        blockchainExplorer.register.calledOnce.should.equal(true);
        blockchainExplorer.addAddresses.calledOnce.should.equal(true);
        const calls = blockchainExplorer.addAddresses.getCalls();
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
          const calls = blockchainExplorer.addAddresses.getCalls();
          // should only sync address 2
          calls[1].args[1].should.deep.equal([address2.address]);
          done();
        });
      });
    });

    it('should reregisted address is wallet is deregistered', function(done) {
      helpers.stubFeeLevels({
        1: 40002,
        2: 20000,
        6: 18000,
        24: 9001,
      }, true);
      server.createAddress({}, function(err, address1) {
        helpers.stubHistory(2, 1000);
        // deregisted the wallet
        server.storage.deregisterWallet(wallet.id, () => {
          wallet.beRegistered = false;
          server.getTxHistory({}, function(err) {
            should.not.exist(err);
            blockchainExplorer.register.calledTwice.should.equal(true);
            blockchainExplorer.addAddresses.calledTwice.should.equal(true);
            const calls = blockchainExplorer.addAddresses.getCalls();
            // both calls should registed the same addr
            calls[0].args[1].should.deep.equal([address1.address]);
            calls[1].args[1].should.deep.equal([address1.address]);
            done();
          });
        });
      });
    });

    it('should sync all wallet address if a first sync failed', function(done) {
      blockchainExplorer.addAddresses = sinon.stub().callsArgWith(2, 'error');
      server.createAddress({}, function(err, address1) {
        blockchainExplorer.addAddresses = sinon.stub().callsArgWith(2, null, null);
        server.createAddress({}, function(err, address2) {
          should.not.exist(err);
          const calls = blockchainExplorer.addAddresses.getCalls();
          // should sync both addresses, since it failed the first time
          // (call is 0 becuase the stub was rewritten)
          calls[0].args[1].should.deep.equal([address1.address, address2.address]);
          done();
        });
      });
    });

    it.skip('TODO:  should sync address in batch', function(done) { });
  });

  describe('BTC & BCH wallets with same seed', function() {
    const server = { btc: null, bch: null };
    const wallet = { btc: null, bch: null };

    beforeEach(async function() {
      const { server: s, wallet: w } = await helpers.createAndJoinWallet(1, 1);
      server.btc = s;
      wallet.btc = w;
      w.copayers[0].id.should.equal(TestData.copayers[0].id44btc);
      const { server: s2, wallet: w2 } = await helpers.createAndJoinWallet(1, 1, { coin: 'bch' });
      server.bch = s2;
      wallet.bch = w2;
      w2.copayers[0].id.should.equal(TestData.copayers[0].id44bch);
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
          address.address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
          server.btc.getAddresses({ noChange: true }, function(err, addresses) {
            should.not.exist(err);
            addresses.length.should.equal(1);
            addresses[0].coin.should.equal('btc');
            addresses[0].walletId.should.equal(wallet.btc.id);
            addresses[0].address.should.equal('1L3z9LPd861FWQhf3vDn89Fnc9dkdBo2CG');
            server.bch.getAddresses({ noChange: true }, function(err, addresses) {
              should.not.exist(err);
              addresses.length.should.equal(1);
              addresses[0].coin.should.equal('bch');
              addresses[0].walletId.should.equal(wallet.bch.id);
              addresses[0].address.should.equal('qrg04mz8h67j9dck3f3f3sa560taep87yqnwra9ak6');
              done();
            });
          });
        });
      });
    });
  });

  describe('ERC20 createTx (ETH)', function() {
    let server;
    let wallet;
    const addressStr = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
    });

    it('should fail with different error for ERC20 txs with insufficient ETH to cover miner fee', function(done) {
      const ts = TO_SAT['usdc'];
      server.createAddress({}, from => {
        helpers.stubUtxos(server, wallet, [1, 1], { tokenAddress: TOKENS[0] }).then(function() {
          const txAmount = 1e6;
          const txOpts = {
            coin: 'usdc_e',
            outputs: [{
              toAddress: addressStr,
              amount: txAmount
            }],
            from,
            fee: 4e18,
            tokenAddress: TOKENS[0]
          };
          server.createTx(txOpts, function(err, tx) {
            should.exist(err);
            err.should.be.instanceof(ClientError);
            err.code.should.equal('INSUFFICIENT_ETH_FEE');
            err.message.should.equal('Your linked ETH wallet does not have enough ETH for fee. RequiredFee: 3999999999999990000');
            err.messageData.should.deep.equal({ requiredFee: 3999999999999990000 });
            server.getBalance({ tokenAddress: txOpts.tokenAddress }, function(err, tokenBalance) {
              should.not.exist(err);
              tokenBalance.totalAmount.should.equal(2 * ts);
              tokenBalance.lockedAmount.should.equal(0);
              txOpts.outputs[0].amount = 1 * ts;
              server.getBalance({}, function(err, ethBalance) {
                should.not.exist(err);
                ethBalance.should.not.equal(tokenBalance);
                ethBalance.totalAmount.should.equal(2000000000000000000);
                ethBalance.lockedAmount.should.equal(0);
                done();
              });
            });
          });
        });
      });
    });

    it('should decode ouput data correctly to get invoice value when paypro', function(done) {
      const ts = TO_SAT['usdc'];
      server.createAddress({}, from => {
        helpers.stubUtxos(server, wallet, [1, 1], { tokenAddress: TOKENS[0] }).then(function() {
          const txOpts = {
            coin: 'usdc_e',
            payProUrl: 'payProUrl',
            outputs: [{
              toAddress: addressStr,
              amount: 0,
              data: '0xb6b4af05000000000000000000000000000000000000000000000000000939f52e7b500000000000000000000000000000000000000000000000000000000006a5b66d80000000000000000000000000000000000000000000000000000001758d7da01d546ec66322bb962a8ba8c9c7c1b2ea37f0e4d5e92dfcd938796eeb41fb4aaa6efe746af63df9f38740a10c477b055f4f96fb26962d8d4050dac6d68280c28b60000000000000000000000000000000000000000000000000000000000000001cd7f7eb38ca6bd66b9006c66e42c1400f1921e5134adf77fcf577c267c9210a1d3230a734142b8810a7a7244f14da12fc052904fd68e885ce955f74ed57250bd50000000000000000000000000000000000000000000000000000000000000000'
            }],
            from,
            tokenAddress: TOKENS[0]
          };
          server.createTx(txOpts, function(err, tx) {
            should.exist(err);
            err.should.be.instanceof(ClientError);
            err.code.should.equal('INSUFFICIENT_FUNDS');
            err.message.should.equal('Insufficient funds');
            done();
          });
        });
      });
    });
  });

  describe('ERC20 createTx (MATIC)', function() {
    let server;
    let wallet;
    const addressStr = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'matic' }));
    });

    it('should fail with different error for ERC20 txs with insufficient MATIC to cover miner fee', function(done) {
      const ts = TO_SAT['usdc'];
      server.createAddress({}, from => {
        helpers.stubUtxos(server, wallet, [1, 1], { tokenAddress: TOKENS[0] }).then(function() {
          const txAmount = 1e6;
          const txOpts = {
            chain: 'matic',
            coin: 'usdc_m',
            outputs: [{
              toAddress: addressStr,
              amount: txAmount
            }],
            from,
            fee: 4e18,
            tokenAddress: TOKENS[0]
          };
          server.createTx(txOpts, function(err, tx) {
            should.exist(err);
            err.should.be.instanceof(ClientError);
            err.code.should.equal('INSUFFICIENT_MATIC_FEE');
            err.message.should.equal('Your linked POLYGON wallet does not have enough MATIC for fee. RequiredFee: 3999999999999990000');
            err.messageData.should.deep.equal({ requiredFee: 3999999999999990000 });
            server.getBalance({ tokenAddress: txOpts.tokenAddress }, function(err, tokenBalance) {
              should.not.exist(err);
              tokenBalance.totalAmount.should.equal(2 * ts);
              tokenBalance.lockedAmount.should.equal(0);
              txOpts.outputs[0].amount = 1 * ts;
              server.getBalance({}, function(err, ethBalance) {
                should.not.exist(err);
                ethBalance.should.not.equal(tokenBalance);
                ethBalance.totalAmount.should.equal(2000000000000000000);
                ethBalance.lockedAmount.should.equal(0);
                done();
              });
            });
          });
        });
      });
    });

    it('should decode ouput data correctly to get invoice value when paypro', function(done) {
      const ts = TO_SAT['usdc'];
      server.createAddress({}, from => {
        helpers.stubUtxos(server, wallet, [1, 1], { tokenAddress: TOKENS[0] }).then(function() {
          const txOpts = {
            chain: 'matic',
            coin: 'usdc_m',
            payProUrl: 'payProUrl',
            outputs: [{
              toAddress: addressStr,
              amount: 0,
              data: '0xb6b4af05000000000000000000000000000000000000000000000000000939f52e7b500000000000000000000000000000000000000000000000000000000006a5b66d80000000000000000000000000000000000000000000000000000001758d7da01d546ec66322bb962a8ba8c9c7c1b2ea37f0e4d5e92dfcd938796eeb41fb4aaa6efe746af63df9f38740a10c477b055f4f96fb26962d8d4050dac6d68280c28b60000000000000000000000000000000000000000000000000000000000000001cd7f7eb38ca6bd66b9006c66e42c1400f1921e5134adf77fcf577c267c9210a1d3230a734142b8810a7a7244f14da12fc052904fd68e885ce955f74ed57250bd50000000000000000000000000000000000000000000000000000000000000000'
            }],
            from,
            tokenAddress: TOKENS[0]
          };
          server.createTx(txOpts, function(err, tx) {
            should.exist(err);
            err.should.be.instanceof(ClientError);
            err.code.should.equal('INSUFFICIENT_FUNDS');
            err.message.should.equal('Insufficient funds');
            done();
          });
        });
      });
    });
  });

  describe('getServicesData', () => {
    let server;

    beforeEach(() => {
      server = new WalletService();
    });

    describe('Case with config.services defined in an unusual manner', () => {
      it('should return config.services if it is included in the config file and no opts provided', () => {
        const configServices = {
          buyCrypto: {
            disabled: false,
            moonpay: {
              disabled: true,
              disabledMessage: 'Moonpay is out of service',
              removed: false
            },
          },
          sellCrypto: {
            disabled: false,
            moonpay: {
              disabled: false,
              removed: false
            }
          },
          swapCrypto: {
            disabled: false,
            changelly: {
              disabled: false,
              removed: false
            }
          },
        };
        config.services = configServices;
        const opts = undefined;

        server.getServicesData(opts, (err, config) => {
          should.not.exist(err);
          should.exist(config);
          config.should.deep.equal(configServices);
        });
      });

      it('should return config.services with swap crypto disabled if it is included in the config file, the user is logged out and located in NY', () => {
        const configServices = {
          buyCrypto: {
            disabled: false,
            moonpay: {
              disabled: true,
              disabledMessage: 'Moonpay is out of service',
              removed: false
            },
            ramp: {
              disabled: false,
              removed: false
            },
            simplex: {
              disabled: false,
              removed: false
            },
            wyre: {
              disabled: false,
              removed: false
            }
          },
          sellCrypto: {
            disabled: false,
            moonpay: {
              disabled: false,
              removed: false
            }
          },
          swapCrypto: {
            disabled: false,
            changelly: {
              disabled: false,
              removed: false
            },
            thorswap: {
              disabled: false,
              removed: false
            }
          },
        };
        config.services = configServices;
        const opts = {
          currentLocationCountry: 'US',
          currentLocationState: 'NY',
        };

        server.getServicesData(opts, (err, config) => {
          should.not.exist(err);
          should.exist(config.swapCrypto);
          config.swapCrypto.disabled.should.equal(true);
          config.swapCrypto.disabledMessage.should.equal('Swaps are currently unavailable in your area.');
        });
      });

      it('should return config.services with swap crypto disabled if it is included in the config file and incomplete, the user is logged out and located in NY', () => {
        const configServices = {
          buyCrypto: {
            disabled: false,
            moonpay: {
              disabled: true,
              disabledMessage: 'Moonpay is out of service',
              removed: false
            }
          },
        };
        config.services = configServices;
        const opts = {
          currentLocationCountry: 'US',
          currentLocationState: 'NY',
        };

        server.getServicesData(opts, (err, config) => {
          should.not.exist(err);
          should.exist(config.swapCrypto);
          config.swapCrypto.disabled.should.equal(true);
          config.swapCrypto.disabledMessage.should.equal('Swaps are currently unavailable in your area.');
        });
      });
    });

    describe('Case with config.services defined as expected', () => {
      beforeEach(() => {
        config.services = {
          buyCrypto: {
            disabled: false,
            banxa: {
              disabled: false,
              removed: false
            },
            moonpay: {
              disabled: false,
              removed: false
            },
            ramp: {
              disabled: false,
              removed: false
            },
            sardine: {
              disabled: false,
              removed: false
            },
            simplex: {
              disabled: false,
              removed: false
            },
            transak: {
              disabled: false,
              removed: false
            },
            wyre: {
              disabled: false,
              removed: false
            }
          },
          sellCrypto: {
            disabled: false,
            moonpay: {
              disabled: false,
              removed: false
            },
            simplex: {
              disabled: false,
              removed: false
            }
          },
          swapCrypto: {
            disabled: false,
            changelly: {
              disabled: false,
              removed: false
            },
            thorswap: {
              disabled: false,
              removed: false
            }
          }
        };
      });

      describe('User logged out', () => {
        const swapUsaBannedStates = ['HI', 'LA', 'NY'];
        for (const bannedState of swapUsaBannedStates) {
          it(`should return swap crypto disabled if the user is located in ${bannedState}`, () => {
            const opts = {
              currentLocationCountry: 'US',
              currentLocationState: bannedState,
            };

            server.getServicesData(opts, (err, config) => {
              should.not.exist(err);
              should.exist(config.swapCrypto);
              config.swapCrypto.disabled.should.equal(true);
              config.swapCrypto.disabledMessage.should.equal('Swaps are currently unavailable in your area.');
            });
          });
        };

        it('should return swap crypto enabled if the user is in USA located outside NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'FL',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(false);
          });
        });

        it('should return swap crypto enabled if the user is in other country than USA', () => {
          const opts = {
            currentLocationCountry: 'AR',
            currentLocationState: 'T',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(false);
          });
        });

        const buyCryptoUsaBannedStates = ['NY'];
        for (const bannedState of buyCryptoUsaBannedStates) {
          it(`should return buy crypto disabled if the user is located in ${bannedState}`, () => {
            const opts = {
              currentLocationCountry: 'US',
              currentLocationState: bannedState,
            };

            server.getServicesData(opts, (err, config) => {
              should.not.exist(err);
              should.exist(config.buyCrypto);
              config.buyCrypto.disabled.should.equal(true);
              config.buyCrypto.disabledMessage.should.equal('This service is currently unavailable in your area.');
            });
          });
        };

        it('should return buy crypto enabled if the user is in USA located outside NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'FL',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.buyCrypto);
            config.buyCrypto.disabled.should.equal(false);
          });
        });

        const sellCryptoUsaBannedStates = ['NY'];
        for (const bannedState of sellCryptoUsaBannedStates) {
          it(`should return sell crypto disabled if the user is located in ${bannedState}`, () => {
            const opts = {
              currentLocationCountry: 'US',
              currentLocationState: bannedState,
            };

            server.getServicesData(opts, (err, config) => {
              should.not.exist(err);
              should.exist(config.sellCrypto);
              config.sellCrypto.disabled.should.equal(true);
              config.sellCrypto.disabledMessage.should.equal('This service is currently unavailable in your area.');
            });
          });
        };

        it('should return sell crypto enabled if the user is in USA located outside NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'FL',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.sellCrypto);
            config.sellCrypto.disabled.should.equal(false);
          });
        });
      });

      describe('User logged in', () => {
        it('should return swap crypto disabled if the user is registred in NY and located in NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'NY',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'NY',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(true);
            config.swapCrypto.disabledMessage.should.equal('Swaps are currently unavailable in your area.');
          });
        });

        it('should return swap crypto disabled if the user is registred in NY and located outside NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'FL',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'NY',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(true);
            config.swapCrypto.disabledMessage.should.equal('Swaps are currently unavailable in your area.');
          });
        });

        it('should return swap crypto disabled if the user is registred in NY and located in other country than USA', () => {
          const opts = {
            currentLocationCountry: 'AR',
            currentLocationState: 'T',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'NY',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(true);
            config.swapCrypto.disabledMessage.should.equal('Swaps are currently unavailable in your area.');
          });
        });

        it('should return swap crypto enabled if the user is registred outside NY and located in NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'NY',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'FL',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(false);
          });
        });

        it('should return swap crypto enabled if the user is registred in other country than USA and located in NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'NY',
            bitpayIdLocationCountry: 'AR',
            bitpayIdLocationState: 'T',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(false);
          });
        });

        it('should return swap crypto disabled if platform is ios and version of the app is 14.11.5', () => {
          const opts = {
            currentAppVersion: '14.11.5',
            currentLocationCountry: 'US',
            currentLocationState: 'GA',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'GA',
            platform: {
              os: 'ios',
              version: '1.1.1'
            },
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(true);
            config.swapCrypto.disabledTitle.should.equal('Unavailable');
            config.swapCrypto.disabledMessage.should.equal('Swaps are currently unavailable in your area.');
          });
        });

        it('should return swap crypto enabled if platform is ios and version of the app is other than 14.11.5', () => {
          const opts = {
            currentAppVersion: '14.11.4',
            currentLocationCountry: 'US',
            currentLocationState: 'GA',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'GA',
            platform: {
              os: 'ios',
              version: '1.1.1'
            },
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(false);
          });
        });

        it('should return swap crypto enabled if platform is other than ios', () => {
          const opts = {
            currentAppVersion: '14.11.5',
            currentLocationCountry: 'US',
            currentLocationState: 'GA',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'GA',
            platform: {
              os: 'android',
              version: '1.1.2'
            },
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.swapCrypto);
            config.swapCrypto.disabled.should.equal(false);
          });
        });

        it('should return buy crypto disabled if the user is registred in NY and located outside NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'FL',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'NY',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.buyCrypto);
            config.buyCrypto.disabled.should.equal(true);
            config.buyCrypto.disabledMessage.should.equal('This service is currently unavailable in your area.');
          });
        });

        it('should return buy crypto enabled if the user is registred outside NY and located in NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'NY',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'FL',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.buyCrypto);
            config.buyCrypto.disabled.should.equal(false);
          });
        });

        it('should return sell crypto disabled if the user is registred in NY and located outside NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'FL',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'NY',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.sellCrypto);
            config.sellCrypto.disabled.should.equal(true);
            config.sellCrypto.disabledMessage.should.equal('This service is currently unavailable in your area.');
          });
        });

        it('should return sell crypto enabled if the user is registred outside NY and located in NY', () => {
          const opts = {
            currentLocationCountry: 'US',
            currentLocationState: 'NY',
            bitpayIdLocationCountry: 'US',
            bitpayIdLocationState: 'FL',
          };

          server.getServicesData(opts, (err, config) => {
            should.not.exist(err);
            should.exist(config.sellCrypto);
            config.sellCrypto.disabled.should.equal(false);
          });
        });
      });
    });
  });

  describe('#getCoinsForTx', function() {
    let server;
    let wallet;

    beforeEach(function() {
      blockchainExplorer.getCoinsForTx = sinon.stub().callsArgWith(1, null, [{ txid: '11' }]);
    });

    it('should get Coins', async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
      const coins = await util.promisify(server.getCoinsForTx).call(server, 'abab');
      coins[0].txid.should.equal('11');
    });

    it('should get not get Coins for not utxo chain', async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      const coins = await util.promisify(server.getCoinsForTx).call(server, 'abab');
      coins.should.deep.equal({
        inputs: [],
        outputs: [],
      });
    });
  });

  describe('#getPayId', () => {
    const url = 'https://ematiu.sandbox.payid.org/matias';
    let server;
    let fakeRequest;
    let req;

    beforeEach(() => {
      server = new WalletService();
      req = {
        headers: {},
        body: {}
      };

      fakeRequest = {
        get: (_url, _opts, _cb) => { return _cb(null, { body: {} }); },
      };
    });

    it('should work properly if url is OK', () => {
      server.request = fakeRequest;
      server.getPayId(url).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if get returns error', () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.request = fakeRequest2;
      server.getPayId(url).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });
  });

  describe('#discoverPayId', () => {
    // payId: matias$ematiu.sandbox.payid.org
    let server;
    let fakeRequest;
    let req;

    beforeEach(() => {
      server = new WalletService();
      req = {
        headers: {},
        body: {
          domain: 'ematiu.sandbox.payid.org',
          handle: 'matias',
        }
      };

      fakeRequest = {
        get: (_url, _opts, _cb) => { return _cb(null, { body: {} }); },
      };
    });

    it('should work properly if req is OK', () => {
      server.request = fakeRequest;
      server.discoverPayId(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.domain;

      server.request = fakeRequest;
      server.discoverPayId(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
      });
    });

    it('should return error if get returns error', () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.request = fakeRequest2;
      server.discoverPayId(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should call getPayId with a url obtained from the template field if it exists', () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => {
          return _cb(null, {
            body: {
              subject: 'payid:matias$ematiu.sandbox.payid.org',
              links: [{
                rel: 'https://payid.org/ns/payid-easy-checkout-uri/1.0',
                href: 'https://xpring.io/portal/wallet/xrp/testnet/payto',
                template: 'https://ematiu.sandbox.payid.org/payid/{acctpart}'
              }]
            }
          });
        }
      };

      server.request = fakeRequest2;
      const spy = sinon.spy(server, 'getPayId');
      const url = 'https://ematiu.sandbox.payid.org/payid/matias';
      server.discoverPayId(req.body).then(data => {
        const calls = spy.getCalls();
        calls[0].args[0].should.equal(url);
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should call getPayId with a default url if the template field does not exist', () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => {
          return _cb(null, {
            body: {
              subject: 'payid:matias$ematiu.sandbox.payid.org',
              links: [{
                rel: 'https://payid.org/ns/payid-easy-checkout-uri/1.0',
                href: 'https://xpring.io/portal/wallet/xrp/testnet/payto',
              }]
            }
          });
        }
      };
      const url = 'https://ematiu.sandbox.payid.org/matias';
      server.request = fakeRequest2;
      const spy = sinon.spy(server, 'getPayId');

      server.discoverPayId(req.body).then(data => {
        const calls = spy.getCalls();
        calls[0].args[0].should.equal(url);
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });
  });

  describe('#clearCache', () => {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 2));
    });

    it('clearWalletCache', async () => {
      const val = await server.clearWalletCache({});
      should.exist(val);
      val.should.equal(true);
    });
  });

  describe('#upgradeNeeded', function() {
    let server;
    let wallet;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(2, 2));
    });

    it('should do something', function() {
      (true).should.equal(true);
    });

    describe(UPGRADES.SOL_bwc_$lt_10_10_12, function() {
      describe('should need upgrade: YES', function() {
        it('lower bwc patch version', function() {
          server.clientVersion = 'bwc-10.10.11';
          wallet.chain = 'sol';
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(true);
        });
        it('lower bwc minor version', function() {
          server.clientVersion = 'bwc-10.9.12';
          wallet.chain = 'sol';
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(true);
        });
        it('lower bwc major version', function() {
          server.clientVersion = 'bwc-9.10.12';
          wallet.chain = 'sol';
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(true);
        });
        it('should be case insensitive', function() {
          server.clientVersion = 'bwc-10.10.11';
          wallet.chain = 'sol'; // case insensitive
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(true);
          wallet.chain = 'SOL'; // case insensitive
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(true);
        });
      });
      describe('should need upgrade: NO', function() {
        it('higher bwc patch version', function() {
          server.clientVersion = 'bwc-10.10.12';
          wallet.chain = 'sol';
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(false);
        });
        it('higher bwc minor version', function() {
          server.clientVersion = 'bwc-10.11.11';
          wallet.chain = 'sol';
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(false);
        });
        it('higher bwc major version', function() {
          server.clientVersion = 'bwc-11.10.11';
          wallet.chain = 'sol';
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(false);
        });
        it('different chain', function() {
          server.clientVersion = 'bwc-10.10.11';
          wallet.chain = 'btc';
          server._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet).should.equal(false);
        });
      });
    });

    describe(UPGRADES.BCH_bwc_$lt_8_3_multisig, function() {
      describe('should need upgrade: YES', function() {
        const upgradeMessage = 'BWC clients < 8.3 are no longer supported for multisig BCH wallets.';
        it('lower bwc minor version', function() {
          server.clientVersion = 'bwc-8.2.0';
          wallet.chain = 'bch';
          server._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, wallet).should.equal(upgradeMessage);
        });
        it('lower bwc major version', function() {
          server.clientVersion = 'bwc-7.3.0';
          wallet.chain = 'bch';
          server._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, wallet).should.equal(upgradeMessage);
        });
        it('should be case insensitive', function() {
          server.clientVersion = 'bwc-8.2.0';
          wallet.chain = 'bch'; // case insensitive
          server._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, wallet).should.equal(upgradeMessage);
          wallet.chain = 'BCH'; // case insensitive
          server._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, wallet).should.equal(upgradeMessage);
        });
      });
      describe('should need upgrade: NO', function() {
        it('higher bwc minor version', function() {
          server.clientVersion = 'bwc-8.3.0';
          wallet.chain = 'bch';
          server._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, wallet).should.equal(false);
        });
        it('higher bwc major version', function() {
          server.clientVersion = 'bwc-9.0.0';
          wallet.chain = 'bch';
          server._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, wallet).should.equal(false);
        });
        it('different chain', function() {
          server.clientVersion = 'bwc-8.2.0';
          wallet.chain = 'btc';
          server._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, wallet).should.equal(false);
        });
        it('not multisig', function() {
          server.clientVersion = 'bwc-8.2.0';
          wallet.n = 1;
          server._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, wallet).should.equal(false);
        });
      });
    });

    describe(UPGRADES.bwc_$lt_8_4_multisig_purpose48, function() {
      describe('should need upgrade: YES', function() {
        it('lower bwc minor version', function() {
          server.clientVersion = 'bwc-8.3.0';
          wallet.usePurpose48 = true;
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_4_multisig_purpose48, wallet).should.equal(true);
        });
        it('lower bwc major version', function() {
          server.clientVersion = 'bwc-7.4.0';
          wallet.usePurpose48 = true;
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_4_multisig_purpose48, wallet).should.equal(true);
        });
      });
      describe('should need upgrade: NO', function() {
        it('higher bwc minor version', function() {
          server.clientVersion = 'bwc-8.4.0';
          wallet.usePurpose48 = true;
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_4_multisig_purpose48, wallet).should.equal(false);
        });
        it('higher bwc major version', function() {
          server.clientVersion = 'bwc-9.3.0';
          wallet.usePurpose48 = true;
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_4_multisig_purpose48, wallet).should.equal(false);
        });
        it('not multisig', function() {
          server.clientVersion = 'bwc-8.3.0';
          wallet.usePurpose48 = true;
          wallet.n = 1;
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_4_multisig_purpose48, wallet).should.equal(false);
        });
        it('usePurpose48 is false', function() {
          server.clientVersion = 'bwc-8.3.0';
          wallet.usePurpose48 = false;
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_4_multisig_purpose48, wallet).should.equal(false);
        });
      });
    });

    describe(UPGRADES.bwc_$lt_8_17_multisig_p2wsh, function() {
      describe('should need upgrade: YES', function() {
        it('lower bwc minor version', function() {
          server.clientVersion = 'bwc-8.16.0';
          wallet.addressType = 'P2WSH';
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_17_multisig_p2wsh, wallet).should.equal(true);
        });
        it('lower bwc major version', function() {
          server.clientVersion = 'bwc-7.17.0';
          wallet.addressType = 'P2WSH';
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_17_multisig_p2wsh, wallet).should.equal(true);
        });
        it('addressType is case insensitive', function() {
          server.clientVersion = 'bwc-8.16.0';
          wallet.addressType = 'p2wsh';
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_17_multisig_p2wsh, wallet).should.equal(true);
        });
      });
      describe('should need upgrade: NO', function() {
        it('higher bwc minor version', function() {
          server.clientVersion = 'bwc-8.17.0';
          wallet.addressType = 'P2WSH';
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_17_multisig_p2wsh, wallet).should.equal(false);
        });
        it('higher bwc major version', function() {
          server.clientVersion = 'bwc-9.16.0';
          wallet.addressType = 'P2WSH';
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_17_multisig_p2wsh, wallet).should.equal(false);
        });
        it('not multisig', function() {
          server.clientVersion = 'bwc-8.16.0';
          wallet.addressType = 'P2WSH';
          wallet.n = 1;
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_17_multisig_p2wsh, wallet).should.equal(false);
        });
        it('addressType is not P2WSH', function() {
          server.clientVersion = 'bwc-8.16.0';
          wallet.addressType = 'P2SH';
          server._upgradeNeeded(UPGRADES.bwc_$lt_8_17_multisig_p2wsh, wallet).should.equal(false);
        });
      });
    });

    describe(UPGRADES.version_$gt_maxTxpVersion, function() {
      describe('should need upgrade: YES', function() {
        it('version > maxTxpVersion integers', function() {
          const opts = {
            version: 2,
            maxTxpVersion: 1
          };
          server._upgradeNeeded(UPGRADES.version_$gt_maxTxpVersion, opts).should.equal(true);
        });
        it('version > maxTxpVersion strings', function() {
          const opts = {
            version: '2',
            maxTxpVersion: '1'
          };
          server._upgradeNeeded(UPGRADES.version_$gt_maxTxpVersion, opts).should.equal(true);
        });
      });
      describe('should need upgrade: NO', function() {
        it('version == maxTxpVersion', function() {
          const opts = {
            version: 1,
            maxTxpVersion: '1'
          };
          server._upgradeNeeded(UPGRADES.version_$gt_maxTxpVersion, opts).should.equal(false);
        });
        it('version < maxTxpVersion', function() {
          const opts = {
            version: '1',
            maxTxpVersion: 2
          };
          server._upgradeNeeded(UPGRADES.version_$gt_maxTxpVersion, opts).should.equal(false);
        });
      });
    });

    describe(UPGRADES.BCH_schnorr, function() {
      describe('should need upgrade: YES', function() {
        it('lower bwc minor version', function() {
          const opts = {
            signingMethod: 'schnorr',
            supportBchSchnorr: false
          };
          server._upgradeNeeded(UPGRADES.BCH_schnorr, opts).should.equal(true);
        });
        it('lower bwc major version', function() {
          const opts = {
            signingMethod: 'schnorr',
            supportBchSchnorr: false
          };
          server._upgradeNeeded(UPGRADES.BCH_schnorr, opts).should.equal(true);
        });
      });
      describe('should need upgrade: NO', function() {
        it('signingMethod is not schnorr', function() {
          const opts = {
            signingMethod: 'ecdsa',
            supportBchSchnorr: false
          };
          server._upgradeNeeded(UPGRADES.BCH_schnorr, opts).should.equal(false);
        });
        it('supportBchSchnorr is true', function() {
          const opts = {
            signingMethod: 'ecdsa',
            supportBchSchnorr: true
          };
          server._upgradeNeeded(UPGRADES.BCH_schnorr, opts).should.equal(false);
        });
      });
    });

    describe(UPGRADES.bwc_$lt_1_2, function() {
      describe('should need upgrade: YES', function() {
        const upgradeMessage = 'BWC clients < 1.2 are no longer supported.';
        it('lower bwc minor version', function() {
          server.clientVersion = 'bwc-1.1.0';
          server._upgradeNeeded(UPGRADES.bwc_$lt_1_2, null).should.equal(upgradeMessage);
        });
        it('lower bwc major version', function() {
          server.clientVersion = 'bwc-0.2.0';
          server._upgradeNeeded(UPGRADES.bwc_$lt_1_2, null).should.equal(upgradeMessage);
        });
      });
      describe('should need upgrade: NO', function() {
        it('higher bwc minor version', function() {
          server.clientVersion = 'bwc-1.2.0';
          server._upgradeNeeded(UPGRADES.bwc_$lt_1_2, null).should.equal(false);
        });
        it('higher bwc major version', function() {
          server.clientVersion = 'bwc-2.1.0';
          server._upgradeNeeded(UPGRADES.bwc_$lt_1_2, null).should.equal(false);
        });
      });
    });

    it('should throw an error for an unknown path', function() {
      (function() {
        server._upgradeNeeded('bogus-path', wallet);
      }).should.throw('Unknown upgrade path');
    });
  });
});
