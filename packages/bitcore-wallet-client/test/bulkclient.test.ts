'use strict';

import chai from 'chai';

chai.config.includeStack = true;
import sinon from 'sinon';
import BWS from 'bitcore-wallet-service';
import log from '../src/lib/log';
import Client from '../src';
import { helpers, blockchainExplorerMock } from './helpers';

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
});
