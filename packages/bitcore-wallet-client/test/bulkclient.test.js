'use strict';

var _ = require('lodash');
var chai = require('chai');
chai.config.includeStack = true;
var sinon = require('sinon');
var should = chai.should();
var log = require('../ts_build/lib/log');

var BWS = require('bitcore-wallet-service');

var Client = require('../ts_build').default;
var Key = Client.Key;

var ExpressApp = BWS.ExpressApp;
var Storage = BWS.Storage;

var { helpers, blockchainExplorerMock } = require('./helpers');


var db;
describe('Bulk Client', function () {
    // DONT USE LAMBAS HERE!!! https://stackoverflow.com/questions/23492043/change-default-timeout-for-mocha, or this.timeout() will BREAK!
    //
    var clients, app, sandbox, storage, keys, i;
    this.timeout(8000);

    before(done => {
        i = 0;
        clients = [];
        keys = [];
        helpers.newDb('', (err, in_db) => {
            db = in_db;
            storage = new Storage({
                db: db
            });
            Storage.createIndexes(db);
            return done(err);
        });
    });

    beforeEach(done => {
        var expressApp = new ExpressApp();
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
                clients = _.map(_.range(5), i => {
                    return helpers.newClient(app);
                });
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

    describe('getStatusAll', () => {
        var k;

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
                clients[0].bulkClient.getStatusAll(credentials,(err, wallets) => {
                    should.not.exist(err);
                    wallets.every(wallet => {
                        return wallet.status.balance.totalAmount.should.equal(0) &&
                        wallet.status.balance.availableAmount.should.equal(0) &&
                        wallet.status.balance.lockedAmount.should.equal(0);
                    }).should.equal(true);
                    done();
                });
            });
        });

        it('returns eth wallet and token wallet when getStatusAll is called', done => {
            helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', network: 'livenet' }, () => {
                let walletOptions = {
                    [clients[0].credentials.copayerId]: {
                        tokenAddresses: [
                            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
                        ]
                    }
                };

                clients[0].bulkClient.getStatusAll([clients[0].credentials], { includeExtendedInfo: true, twoStep: true, wallets: walletOptions }, (err, wallets) => {
                    should.not.exist(err);
                    wallets.length.should.equal(2);
                    wallets.findIndex(wallet => wallet.tokenAddress === null).should.be.above(-1);
                    wallets.findIndex(wallet => wallet.tokenAddress === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48').should.be.above(-1);

                    done();
                });
            });
        });

        it('returns eth wallet and multiple token wallets when getStatusAll is called', done => {
            helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', network: 'livenet' }, () => {
                let walletOptions = {
                    [clients[0].credentials.copayerId]: {
                        tokenAddresses: [
                            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd'
                        ]
                    }
                };

                clients[0].bulkClient.getStatusAll([clients[0].credentials], { includeExtendedInfo: true, twoStep: true, wallets: walletOptions }, (err, wallets) => {
                    should.not.exist(err);
                    wallets.length.should.equal(3);
                    wallets.findIndex(wallet => wallet.tokenAddress === null).should.be.above(-1);
                    wallets.findIndex(wallet => wallet.tokenAddress === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48').should.be.above(-1);
                    wallets.findIndex(wallet => wallet.tokenAddress === '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd').should.be.above(-1);

                    done();
                });
            });
        });

        it('returns two eth wallets and token wallets associated with one of them', done => {
            let key = new Key({ seedType: 'new' });
            helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', key: key, network: 'livenet' }, () => {
                helpers.createAndJoinWallet(clients.slice(1), keys, 1, 1, { coin: 'eth', key: key, account: 1, network: 'livenet' }, () => {
                    let walletOptions = {
                        [clients[0].credentials.copayerId]: {
                            tokenAddresses: [
                                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                                '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd'
                            ]
                        }
                    };

                    clients[0].bulkClient.getStatusAll([clients[0].credentials, clients[1].credentials], { includeExtendedInfo: true, twoStep: true, wallets: walletOptions }, (err, wallets) => {
                        should.not.exist(err);
                        wallets.length.should.equal(4);
                        wallets.filter(wallet => wallet.tokenAddress === null).length.should.equal(2);
                        wallets.findIndex(wallet => wallet.tokenAddress === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48').should.be.above(-1);
                        wallets.findIndex(wallet => wallet.tokenAddress === '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd').should.be.above(-1);

                        done();
                    });
                });
            });
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