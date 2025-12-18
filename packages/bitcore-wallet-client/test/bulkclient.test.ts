'use strict';

import * as chai from 'chai';

chai.config.includeStack = true;
import sinon from 'sinon';
import BWS from 'bitcore-wallet-service';
import log from '../src/lib/log';
import Client from '../src';
import { helpers, blockchainExplorerMock } from './helpers';
import { Utils } from '../src/lib/common/utils';

const should = chai.should();
const Key = Client.Key;
const ExpressApp = BWS.ExpressApp;
const Storage = BWS.Storage;

describe('Bulk Client', function() {
  // DONT USE LAMBAS HERE!!! https://stackoverflow.com/questions/23492043/change-default-timeout-for-mocha, or this.timeout() will BREAK!
  //
  let clients, app, sandbox, storage, keys, i;
  let db;
  let connection;
  this.timeout(8000);

  before(done => {
    i = 0;
    clients = [];
    keys = [];
    helpers.newDb('', (err, database, conn) => {
      db = database;
      connection = conn;
      storage = new Storage({ db });
      Storage.createIndexes(db);
      return done(err);
    });
  });

  beforeEach(done => {
    const expressApp = new ExpressApp();
    expressApp.start(
      {
        ignoreRateLimiter: true,
        storage: storage,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
        doNotCheckV8: true
      },
      () => {
        app = expressApp.app;

        // Generates 5 clients
        const range0to4 = Array.from({ length: 5 }, (_, i) => i);
        clients = range0to4.map(i => helpers.newClient(app));
        blockchainExplorerMock.reset();
        sandbox = sinon.createSandbox();

        if (!process.env.BWC_SHOW_LOGS) {
          sandbox.stub(log, 'warn');
          sandbox.stub(log, 'info');
          sandbox.stub(log, 'error');
        }
        done();
      }
    );
  });
  afterEach(done => {
    sandbox.restore();
    done();
  });
  after(done => {
    connection.close(done);
  });

  describe('getStatusAll', () => {
    let k;

    beforeEach(done => {
      k = new Key({ seedType: 'new' });
      db.dropDatabase(err => {
        return done(err);
      });
    });

    it('returns multiple wallets when getStatusAll is called with multiple sets of credentials', done => {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        const credentials = Array(3).fill(clients[0].credentials);
        clients[0].bulkClient.getStatusAll(credentials, (err, wallets) => {
          should.not.exist(err);
          wallets.length.should.equal(3);
          done();
        });
      });
    });

    it('returns wallets with status when getStatusAll is called', done => {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        const credentials = Array(3).fill(clients[0].credentials);
        clients[0].bulkClient.getStatusAll(credentials, (err, wallets) => {
          should.not.exist(err);
          wallets
            .every(wallet => {
              return (
                wallet.status.balance.totalAmount.should.equal(0) &&
                wallet.status.balance.availableAmount.should.equal(0) &&
                wallet.status.balance.lockedAmount.should.equal(0)
              );
            })
            .should.equal(true);
          done();
        });
      });
    });

    it('returns eth wallet and token wallet when getStatusAll is called', done => {
      helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', network: 'livenet' }, () => {
        const walletOptions = {
          [clients[0].credentials.copayerId]: {
            tokenAddresses: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']
          }
        };

        clients[0].bulkClient.getStatusAll(
          [clients[0].credentials],
          { includeExtendedInfo: true, twoStep: true, wallets: walletOptions },
          (err, wallets) => {
            should.not.exist(err);
            wallets.length.should.equal(2);
            wallets.findIndex(wallet => wallet.tokenAddress === null).should.be.above(-1);
            wallets
              .findIndex(wallet => wallet.tokenAddress === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
              .should.be.above(-1);

            done();
          }
        );
      });
    });

    it('returns eth wallet and multiple token wallets when getStatusAll is called', done => {
      helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', network: 'livenet' }, () => {
        const walletOptions = {
          [clients[0].credentials.copayerId]: {
            tokenAddresses: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd']
          }
        };

        clients[0].bulkClient.getStatusAll(
          [clients[0].credentials],
          { includeExtendedInfo: true, twoStep: true, wallets: walletOptions },
          (err, wallets) => {
            should.not.exist(err);
            wallets.length.should.equal(3);
            wallets.findIndex(wallet => wallet.tokenAddress === null).should.be.above(-1);
            wallets
              .findIndex(wallet => wallet.tokenAddress === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
              .should.be.above(-1);
            wallets
              .findIndex(wallet => wallet.tokenAddress === '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd')
              .should.be.above(-1);

            done();
          }
        );
      });
    });

    it('returns two eth wallets and token wallets associated with one of them', done => {
      const key = new Key({ seedType: 'new' });
      helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', key: key, network: 'livenet' }, () => {
        helpers.createAndJoinWallet(
          clients.slice(1),
          keys,
          1,
          1,
          { coin: 'eth', key: key, account: 1, network: 'livenet' },
          () => {
            const walletOptions = {
              [clients[0].credentials.copayerId]: {
                tokenAddresses: [
                  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                  '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd'
                ]
              }
            };

            clients[0].bulkClient.getStatusAll(
              [clients[0].credentials, clients[1].credentials],
              { includeExtendedInfo: true, twoStep: true, wallets: walletOptions },
              (err, wallets) => {
                should.not.exist(err);
                wallets.length.should.equal(4);
                wallets.filter(wallet => wallet.tokenAddress === null).length.should.equal(2);
                wallets
                  .findIndex(wallet => wallet.tokenAddress === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
                  .should.be.above(-1);
                wallets
                  .findIndex(wallet => wallet.tokenAddress === '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd')
                  .should.be.above(-1);

                done();
              }
            );
          }
        );
      });
    });

    it('returns two arb wallets and token wallets associated with one of them', done => {
      const key = new Key({ seedType: 'new' });
      helpers.createAndJoinWallet(
        clients,
        keys,
        1,
        1,
        { coin: 'eth', chain: 'arb', key: key, network: 'livenet' },
        () => {
          helpers.createAndJoinWallet(
            clients.slice(1),
            keys,
            1,
            1,
            { coin: 'eth', chain: 'arb', key: key, account: 1, network: 'livenet' },
            () => {
              const walletOptions = {
                [clients[0].credentials.copayerId]: {
                  tokenAddresses: [
                    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd'
                  ]
                }
              };

              clients[0].bulkClient.getStatusAll(
                [clients[0].credentials, clients[1].credentials],
                { includeExtendedInfo: true, twoStep: true, wallets: walletOptions },
                (err, wallets) => {
                  should.not.exist(err);
                  wallets.length.should.equal(4);
                  wallets.filter(wallet => wallet.tokenAddress === null).length.should.equal(2);
                  wallets
                    .findIndex(wallet => wallet.tokenAddress === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
                    .should.be.above(-1);
                  wallets
                    .findIndex(wallet => wallet.tokenAddress === '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd')
                    .should.be.above(-1);

                  done();
                }
              );
            }
          );
        }
      );
    });

    it('fails gracefully when given bad signature', done => {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        const credentials = Array(3).fill(clients[0].credentials);
        credentials[0].requestPrivKey = '3da1b53f027ed856bb1922dde7438f91309a59fa1a3aaf7f64dd7f46a258c73c';
        clients[0].bulkClient.getStatusAll(credentials, (err, wallets) => {
          should.exist(err);
          should.not.exist(wallets);
          done();
        });
      });
    });

    it('fails gracefully when given bad copayerId', done => {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      helpers.createAndJoinWallet(clients, keys, 1, 3, {}, () => {
        const credentials = Array(3).fill(clients[0].credentials);
        credentials[0].copayerId = 'badCopayerId';
        clients[0].bulkClient.getStatusAll(credentials, (err, wallets) => {
          should.exist(err);
          should.not.exist(wallets);
          done();
        });
      });
    });
  });

  describe('_processWallet', () => {
    let bulkClient;
    let mockCredentials;
    let decryptStub;

    beforeEach(() => {
      bulkClient = clients[0].bulkClient;
      mockCredentials = {
        sharedEncryptingKey: 'testEncryptingKey'
      };
      // Create a stub for Utils.decryptMessageNoThrow
      decryptStub = sandbox.stub(Utils, 'decryptMessageNoThrow');
    });

    it('should decrypt wallet name and set encryptedName when decryption changes the value', () => {
      const wallet: any = {
        name: 'encryptedWalletName',
        copayers: []
      };

      decryptStub.withArgs('encryptedWalletName', 'testEncryptingKey').returns('Decrypted Wallet Name');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.name.should.equal('Decrypted Wallet Name');
      wallet.encryptedName.should.equal('encryptedWalletName');
    });

    it('should decrypt wallet name but not set encryptedName when decryption returns the same value', () => {
      const wallet: any = {
        name: 'plainWalletName',
        copayers: []
      };

      decryptStub.withArgs('plainWalletName', 'testEncryptingKey').returns('plainWalletName');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.name.should.equal('plainWalletName');
      should.not.exist(wallet.encryptedName);
    });

    it('should decrypt copayer names and set encryptedName when decryption changes the value', () => {
      const wallet: any = {
        name: 'walletName',
        copayers: [
          { name: 'encryptedCopayerName1' },
          { name: 'encryptedCopayerName2' }
        ]
      };

      decryptStub.withArgs('walletName', 'testEncryptingKey').returns('walletName');
      decryptStub.withArgs('encryptedCopayerName1', 'testEncryptingKey').returns('Copayer 1');
      decryptStub.withArgs('encryptedCopayerName2', 'testEncryptingKey').returns('Copayer 2');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.copayers[0].name.should.equal('Copayer 1');
      wallet.copayers[0].encryptedName.should.equal('encryptedCopayerName1');
      wallet.copayers[1].name.should.equal('Copayer 2');
      wallet.copayers[1].encryptedName.should.equal('encryptedCopayerName2');
    });

    it('should decrypt copayer names but not set encryptedName when decryption returns the same value', () => {
      const wallet: any = {
        name: 'walletName',
        copayers: [
          { name: 'plainCopayerName' }
        ]
      };

      decryptStub.withArgs('walletName', 'testEncryptingKey').returns('walletName');
      decryptStub.withArgs('plainCopayerName', 'testEncryptingKey').returns('plainCopayerName');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.copayers[0].name.should.equal('plainCopayerName');
      should.not.exist(wallet.copayers[0].encryptedName);
    });

    it('should decrypt access names and set encryptedName when decryption changes the value', () => {
      const wallet: any = {
        name: 'walletName',
        copayers: [
          {
            name: 'copayerName',
            requestPubKeys: [
              { name: 'encryptedAccessName1' },
              { name: 'encryptedAccessName2' }
            ]
          }
        ]
      };

      decryptStub.withArgs('walletName', 'testEncryptingKey').returns('walletName');
      decryptStub.withArgs('copayerName', 'testEncryptingKey').returns('copayerName');
      decryptStub.withArgs('encryptedAccessName1', 'testEncryptingKey').returns('Access 1');
      decryptStub.withArgs('encryptedAccessName2', 'testEncryptingKey').returns('Access 2');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.copayers[0].requestPubKeys[0].name.should.equal('Access 1');
      wallet.copayers[0].requestPubKeys[0].encryptedName.should.equal('encryptedAccessName1');
      wallet.copayers[0].requestPubKeys[1].name.should.equal('Access 2');
      wallet.copayers[0].requestPubKeys[1].encryptedName.should.equal('encryptedAccessName2');
    });

    it('should decrypt access names but not set encryptedName when decryption returns the same value', () => {
      const wallet: any = {
        name: 'walletName',
        copayers: [
          {
            name: 'copayerName',
            requestPubKeys: [
              { name: 'plainAccessName' }
            ]
          }
        ]
      };

      decryptStub.withArgs('walletName', 'testEncryptingKey').returns('walletName');
      decryptStub.withArgs('copayerName', 'testEncryptingKey').returns('copayerName');
      decryptStub.withArgs('plainAccessName', 'testEncryptingKey').returns('plainAccessName');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.copayers[0].requestPubKeys[0].name.should.equal('plainAccessName');
      should.not.exist(wallet.copayers[0].requestPubKeys[0].encryptedName);
    });

    it('should return early when access.name is falsy', () => {
      const wallet: any = {
        name: 'walletName',
        copayers: [
          {
            name: 'copayerName',
            requestPubKeys: [
              { name: null },
              { name: 'shouldNotBeProcessed' }
            ]
          }
        ]
      };

      decryptStub.withArgs('walletName', 'testEncryptingKey').returns('walletName');
      decryptStub.withArgs('copayerName', 'testEncryptingKey').returns('copayerName');

      bulkClient._processWallet(wallet, mockCredentials);

      // The second access should not be processed due to early return
      decryptStub.callCount.should.equal(2); // Only wallet name and copayer name
      should.not.exist(wallet.copayers[0].requestPubKeys[0].name);
    });

    it('should handle wallet with no copayers', () => {
      const wallet: any = {
        name: 'encryptedWalletName',
        copayers: null
      };

      decryptStub.withArgs('encryptedWalletName', 'testEncryptingKey').returns('Decrypted Name');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.name.should.equal('Decrypted Name');
      wallet.encryptedName.should.equal('encryptedWalletName');
    });

    it('should handle copayer with no requestPubKeys', () => {
      const wallet: any = {
        name: 'walletName',
        copayers: [
          { name: 'copayerName', requestPubKeys: null }
        ]
      };

      decryptStub.withArgs('walletName', 'testEncryptingKey').returns('walletName');
      decryptStub.withArgs('copayerName', 'testEncryptingKey').returns('copayerName');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.copayers[0].name.should.equal('copayerName');
    });

    it('should handle complex wallet with multiple copayers and access keys', () => {
      const wallet: any = {
        name: 'encryptedWallet',
        copayers: [
          {
            name: 'encryptedCopayer1',
            requestPubKeys: [
              { name: 'encryptedAccess1' },
              { name: 'plainAccess2' }
            ]
          },
          {
            name: 'plainCopayer2',
            requestPubKeys: [
              { name: 'encryptedAccess3' }
            ]
          }
        ]
      };

      decryptStub.withArgs('encryptedWallet', 'testEncryptingKey').returns('Wallet');
      decryptStub.withArgs('encryptedCopayer1', 'testEncryptingKey').returns('Copayer 1');
      decryptStub.withArgs('encryptedAccess1', 'testEncryptingKey').returns('Access 1');
      decryptStub.withArgs('plainAccess2', 'testEncryptingKey').returns('plainAccess2');
      decryptStub.withArgs('plainCopayer2', 'testEncryptingKey').returns('plainCopayer2');
      decryptStub.withArgs('encryptedAccess3', 'testEncryptingKey').returns('Access 3');

      bulkClient._processWallet(wallet, mockCredentials);

      wallet.name.should.equal('Wallet');
      wallet.encryptedName.should.equal('encryptedWallet');
      
      wallet.copayers[0].name.should.equal('Copayer 1');
      wallet.copayers[0].encryptedName.should.equal('encryptedCopayer1');
      wallet.copayers[0].requestPubKeys[0].name.should.equal('Access 1');
      wallet.copayers[0].requestPubKeys[0].encryptedName.should.equal('encryptedAccess1');
      wallet.copayers[0].requestPubKeys[1].name.should.equal('plainAccess2');
      should.not.exist(wallet.copayers[0].requestPubKeys[1].encryptedName);

      wallet.copayers[1].name.should.equal('plainCopayer2');
      should.not.exist(wallet.copayers[1].encryptedName);
      wallet.copayers[1].requestPubKeys[0].name.should.equal('Access 3');
      wallet.copayers[1].requestPubKeys[0].encryptedName.should.equal('encryptedAccess3');
    });

    it('should handle empty string access name (early return)', () => {
      const wallet: any = {
        name: 'walletName',
        copayers: [
          {
            name: 'copayerName',
            requestPubKeys: [
              { name: '' }
            ]
          }
        ]
      };

      decryptStub.withArgs('walletName', 'testEncryptingKey').returns('walletName');
      decryptStub.withArgs('copayerName', 'testEncryptingKey').returns('copayerName');

      bulkClient._processWallet(wallet, mockCredentials);

      // Empty string is falsy, so should trigger early return
      decryptStub.callCount.should.equal(2); // Only wallet name and copayer name
    });
  });
});
