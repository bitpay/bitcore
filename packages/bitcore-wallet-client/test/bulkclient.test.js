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

    describe('getBalanceAll', () => {
        var k;

        beforeEach(done => {
            k = new Key({ seedType: 'new' });
            db.dropDatabase(err => {
                return done(err);
            });
        });

        it('returns wallets with balance info when getBalanceAll is called', done => {
            clients[0].fromString(
                k.createCredentials(null, {
                    coin: 'btc',
                    network: 'livenet',
                    account: 0,
                    n: 1
                })
            );

            helpers.createAndJoinWallet(clients, keys, 1, 3, {}, () => {
                const clientsWithCredentials = clients.filter((client) => client.credentials);
                clients[0].bulkClient.getBalanceAll(clientsWithCredentials, (err, wallets) => {
                    should.not.exist(err);
                    const walletIds = wallets.map((wal) => Object.keys(wal));
                    wallets[0][walletIds[0]].totalAmount.should.equal(0);
                    wallets[0][walletIds[0]].availableAmount.should.equal(0);
                    wallets[0][walletIds[0]].lockedAmount.should.equal(0);
                    done();
                });
            });

        });

        it('returns multiple wallets when getBalanceAll is called with multiple clients', done => {
            clients[0].fromString(
                k.createCredentials(null, {
                    coin: 'btc',
                    network: 'livenet',
                    account: 0,
                    n: 1
                })
            );

            helpers.createAndJoinWallet(clients, keys, 1, 3, {}, () => {
                const clientsWithCredentials = clients.filter((client) => client.credentials);
                clients[0].bulkClient.getBalanceAll(clientsWithCredentials, (err, wallets) => {
                    should.not.exist(err);
                    wallets.length.should.equal(3);
                    done();
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

            helpers.createAndJoinWallet(clients, keys, 1, 3, {}, () => {
                let clientsWithCredentials = clients.filter((client) => client.credentials);
                clientsWithCredentials[2].credentials.requestPrivKey = '3da1b53f027ed856bb1922dde7438f91309a59fa1a3aaf7f64dd7f46a258c73c';
                clients[0].bulkClient.getBalanceAll(clientsWithCredentials, (err, wallets) => {
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
                let clientsWithCredentials = clients.filter((client) => client.credentials);
                clientsWithCredentials[2].credentials.copayerId = 'badCopayerId';
                clients[0].bulkClient.getBalanceAll(clientsWithCredentials, (err, wallets) => {
                    should.exist(err);
                    should.not.exist(wallets);
                    done();
                });
            });
        });
    });

});