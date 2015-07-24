'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var async = require('async');
var Bitcore = require('bitcore');
var BitcorePayPro = require('bitcore-payment-protocol');
var request = require('supertest');
var tingodb = require('tingodb')({
  memStore: true
});
var log = require('../lib/log');

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var BWS = require('bitcore-wallet-service');

var Client = require('../lib');
var ExpressApp = BWS.ExpressApp;
var Storage = BWS.Storage;
var TestData = require('./testdata');
var ImportData = require('./legacyImportData.js');

var helpers = {};
chai.config.includeStack = true;

helpers.getRequest = function(app) {
  $.checkArgument(app);
  return function(args, cb) {
    var req = request(app);
    var r = req[args.method](args.relUrl);

    if (args.headers) {
      _.each(args.headers, function(v, k) {
        r.set(k, v);
      })
    }
    if (!_.isEmpty(args.body)) {
      r.send(args.body);
    };
    r.end(function(err, res) {
      return cb(err, res, res.body);
    });
  };
};

helpers.newClient = function(app) {
  $.checkArgument(app);
  return new Client({
    request: helpers.getRequest(app),
  });
};

helpers.newDb = function() {
  this.dbCounter = (this.dbCounter || 0) + 1;
  return new tingodb.Db('./db/test' + this.dbCounter, {});
};

helpers.createAndJoinWallet = function(clients, m, n, cb) {
  clients[0].createWallet('wallet name', 'creator', m, n, {
      network: 'testnet'
    },
    function(err, secret) {
      should.not.exist(err);

      if (n > 1) {
        should.exist(secret);
      }

      async.series([

          function(next) {
            async.each(_.range(1, n), function(i, cb) {
              clients[i].joinWallet(secret, 'copayer ' + i, cb);
            }, next);
          },
          function(next) {
            async.each(_.range(n), function(i, cb) {
              clients[i].openWallet(cb);
            }, next);
          },
        ],
        function(err) {
          should.not.exist(err);
          return cb({
            m: m,
            n: n,
            secret: secret,
          });
        });
    });
};

helpers.tamperResponse = function(clients, method, url, args, tamper, cb) {
  clients = [].concat(clients);
  // Use first client to get a clean response from server
  clients[0]._doRequest(method, url, args, function(err, result) {
    should.not.exist(err);
    tamper(result);
    // Return tampered data for every client in the list
    _.each(clients, function(client) {
      client._doRequest = sinon.stub().withArgs(method, url).yields(null, result);
    });
    return cb();
  });
};


var blockchainExplorerMock = {};

blockchainExplorerMock.getUnspentUtxos = function(dummy, cb) {
  var ret = _.map(blockchainExplorerMock.utxos || [], function(x) {
    var y = _.clone(x);
    y.toObject = function() {
      return this;
    };
    return y;
  });
  return cb(null, ret);
};

blockchainExplorerMock.setUtxo = function(address, amount, m) {
  blockchainExplorerMock.utxos.push({
    txid: Bitcore.crypto.Hash.sha256(new Buffer(Math.random() * 100000)).toString('hex'),
    vout: Math.floor((Math.random() * 10) + 1),
    amount: amount,
    address: address.address,
    scriptPubKey: address.publicKeys ? Bitcore.Script.buildMultisigOut(address.publicKeys, m).toScriptHashOut().toString() : '',
  });
};

blockchainExplorerMock.broadcast = function(raw, cb) {
  blockchainExplorerMock.lastBroadcasted = raw;
  return cb(null, (new Bitcore.Transaction(raw)).id);
};

blockchainExplorerMock.setHistory = function(txs) {
  blockchainExplorerMock.txHistory = txs;
};

blockchainExplorerMock.getTransactions = function(addresses, from, to, cb) {
  var list = [].concat(blockchainExplorerMock.txHistory);
  list = _.slice(list, from, to);
  return cb(null, list);
};

blockchainExplorerMock.getAddressActivity = function(addresses, cb) {
  var addr = _.pluck(blockchainExplorerMock.utxos || [], 'address');
  return cb(null, _.intersection(addr, addresses).length > 0);
};

blockchainExplorerMock.setFeeLevels = function(levels) {
  blockchainExplorerMock.feeLevels = levels;
};

blockchainExplorerMock.estimateFee = function(nbBlocks, cb) {
  return cb(null, {
    feePerKB: blockchainExplorerMock.feeLevels[nbBlocks] / 1e8
  });
};

blockchainExplorerMock.reset = function() {
  blockchainExplorerMock.utxos = [];
  blockchainExplorerMock.txHistory = [];
  blockchainExplorerMock.feeLevels = [];
};



describe('client API', function() {
  var clients, app, sandbox;
  var i = 0;
  beforeEach(function(done) {
    var storage = new Storage({
      db: helpers.newDb(),
    });
    var expressApp = new ExpressApp();
    expressApp.start({
        storage: storage,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
      },
      function() {
        app = expressApp.app;

        // Generates 5 clients
        clients = _.map(_.range(5), function(i) {
          return helpers.newClient(app);
        });
        blockchainExplorerMock.reset();
        sandbox = sinon.sandbox.create();
        sandbox.stub(log, 'warn');
        sandbox.stub(log, 'info');
        sandbox.stub(log, 'error');
        done();
      });
  });
  afterEach(function(done) {
    sandbox.restore();
    done();
  });

  describe('Client Internals', function() {
    it('should expose bitcore', function() {
      should.exist(Client.Bitcore);
      should.exist(Client.Bitcore.HDPublicKey);
    });
  });

  describe('Server internals', function() {
    it('should allow cors', function(done) {
      clients[0].credentials = {};
      clients[0]._doRequest('options', '/', {}, function(err, x, headers) {
        headers['access-control-allow-origin'].should.equal('*');
        should.exist(headers['access-control-allow-methods']);
        should.exist(headers['access-control-allow-headers']);
        done();
      });
    });

    it('should handle critical errors', function(done) {
      var s = sinon.stub();
      s.storeWallet = sinon.stub().yields('bigerror');
      s.fetchWallet = sinon.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start({
        storage: s,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
      }, function() {
        var s2 = sinon.stub();
        s2.load = sinon.stub().yields(null);
        var client = helpers.newClient(app);
        client.storage = s2;
        client.createWallet('1', '2', 1, 1, {
            network: 'testnet'
          },
          function(err) {
            err.code.should.equal('ERROR');
            done();
          });
      });
    });

    it('should handle critical errors (Case2)', function(done) {
      var s = sinon.stub();
      s.storeWallet = sinon.stub().yields({
        code: 501,
        message: 'wow'
      });
      s.fetchWallet = sinon.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start({
        storage: s,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
      }, function() {
        var s2 = sinon.stub();
        s2.load = sinon.stub().yields(null);
        var client = helpers.newClient(app);
        client.storage = s2;
        client.createWallet('1', '2', 1, 1, {
            network: 'testnet'
          },
          function(err) {
            err.code.should.equal('ERROR');
            done();
          });
      });
    });

    it('should handle critical errors (Case3)', function(done) {
      var s = sinon.stub();
      s.storeWallet = sinon.stub().yields({
        code: 404,
        message: 'wow'
      });
      s.fetchWallet = sinon.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start({
        storage: s,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
      }, function() {
        var s2 = sinon.stub();
        s2.load = sinon.stub().yields(null);
        var client = helpers.newClient(app);
        client.storage = s2;
        client.createWallet('1', '2', 1, 1, {
            network: 'testnet'
          },
          function(err) {
            console.log('err ', err);
            err.code.should.equal('NOTFOUND');
            done();
          });
      });
    });

    it('should handle critical errors (Case4)', function(done) {
      var body = {
        code: 999,
        message: 'unexpected body'
      };
      var ret = Client._parseError(body);
      ret.toString().indexOf('ClientError').should.not.equal(-1);
      done();
    });

    it('should handle critical errors (Case5)', function(done) {
      var err = 'some error';
      var res, body; // leave them undefined to simulate no-response
      var requestStub = function(args, cb) {
        cb(err, res, body);
      };
      var request = sinon.stub(clients[0], 'request', requestStub);
      clients[0].createWallet('wallet name', 'creator', 1, 2, {
        network: 'testnet'
      }, function(err, secret) {
        should.exist(err);
        err.code.should.equal('CONNERROR');
        request.restore();
        done();
      });
    });
  });

  describe('Wallet Creation', function() {
    it('should check balance in a 1-1 ', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].getBalance(function(err, x) {
          should.not.exist(err);
          done();
        })
      });
    });
    it('should be able to complete wallet in copayer that joined later', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function() {
        clients[0].getBalance(function(err, x) {
          should.not.exist(err);
          clients[1].getBalance(function(err, x) {
            should.not.exist(err);
            clients[2].getBalance(function(err, x) {
              should.not.exist(err);
              done();
            })
          })
        })
      });
    });
    it('should fire event when wallet is complete', function(done) {
      var checks = 0;
      clients[0].on('walletCompleted', function(wallet) {
        wallet.name.should.equal('wallet name');
        wallet.status.should.equal('complete');
        clients[0].isComplete().should.equal(true);
        clients[0].credentials.isComplete().should.equal(true);
        if (++checks == 2) done();
      });
      clients[0].createWallet('wallet name', 'creator', 2, 2, {
        network: 'testnet'
      }, function(err, secret) {
        should.not.exist(err);
        clients[0].isComplete().should.equal(false);
        clients[0].credentials.isComplete().should.equal(false);
        clients[1].joinWallet(secret, 'guest', function(err) {
          should.not.exist(err);
          clients[0].openWallet(function(err, walletStatus) {
            should.not.exist(err);
            should.exist(walletStatus);
            _.difference(_.pluck(walletStatus.copayers, 'name'), ['creator', 'guest']).length.should.equal(0);
            if (++checks == 2) done();
          });
        });
      });
    });

    it('should not allow to join a full wallet ', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        should.exist(w.secret);
        clients[4].joinWallet(w.secret, 'copayer', function(err, result) {
          err.code.should.contain('WFULL');
          done();
        });
      });
    });
    it('should fail with an invalid secret', function(done) {
      // Invalid
      clients[0].joinWallet('dummy', 'copayer', function(err, result) {
        err.message.should.contain('Invalid secret');
        // Right length, invalid char for base 58
        clients[0].joinWallet('DsZbqNQQ9LrTKU8EknR7gFKyCQMPg2UUHNPZ1BzM5EbJwjRZaUNBfNtdWLluuFc0f7f7sTCkh7T', 'copayer', function(err, result) {
          err.message.should.contain('Invalid secret');
          done();
        });
      });
    });
    it('should fail with an unknown secret', function(done) {
      // Unknown walletId
      var oldSecret = '3bJKRn1HkQTpwhVaJMaJ22KwsjN24ML9uKfkSrP7iDuq91vSsTEygfGMMpo6kWLp1pXG9wZSKcT';
      clients[0].joinWallet(oldSecret, 'copayer', function(err, result) {
        err.code.should.contain('BADREQUEST');
        done();
      });
    });

    it('should detect wallets with bad signatures', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sinon.stub(clients[1], 'openWallet').yields();

      helpers.createAndJoinWallet(clients, 2, 3, function() {
        helpers.tamperResponse([clients[0], clients[1]], 'get', '/v1/wallets/', {}, function(status) {
          status.wallet.copayers[0].xPubKey = status.wallet.copayers[1].xPubKey;
        }, function() {
          openWalletStub.restore();
          clients[1].openWallet(function(err, x) {
            err.code.should.contain('SERVERCOMPROMISED');
            done();
          });
        });
      });
    });

    it('should detect wallets with missing signatures', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sinon.stub(clients[1], 'openWallet').yields();

      helpers.createAndJoinWallet(clients, 2, 3, function() {
        helpers.tamperResponse([clients[0], clients[1]], 'get', '/v1/wallets/', {}, function(status) {
          delete status.wallet.copayers[1].xPubKey;
        }, function() {
          openWalletStub.restore();
          clients[1].openWallet(function(err, x) {
            err.code.should.contain('SERVERCOMPROMISED');
            done();
          });
        });
      });
    });

    it('should detect wallets missing callers pubkey', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sinon.stub(clients[1], 'openWallet').yields();

      helpers.createAndJoinWallet(clients, 2, 3, function() {
        helpers.tamperResponse([clients[0], clients[1]], 'get', '/v1/wallets/', {}, function(status) {
          // Replace caller's pubkey
          status.wallet.copayers[1].xPubKey = (new Bitcore.HDPrivateKey()).publicKey;
          // Add a correct signature
          status.wallet.copayers[1].xPubKeySignature = WalletUtils.signMessage(status.wallet.copayers[1].xPubKey, clients[0].credentials.walletPrivKey);
        }, function() {
          openWalletStub.restore();
          clients[1].openWallet(function(err, x) {
            err.code.should.contain('SERVERCOMPROMISED');
            done();
          });
        });
      });
    });
    it('should return wallet status even if wallet is not yet complete', function(done) {
      clients[0].createWallet('wallet name', 'creator', 1, 2, {
        network: 'testnet'
      }, function(err, secret) {
        should.not.exist(err);
        should.exist(secret);

        clients[0].getStatus(function(err, status) {
          should.not.exist(err);
          should.exist(status);
          status.wallet.status.should.equal('pending');
          should.exist(status.wallet.secret);
          status.wallet.secret.should.equal(secret);
          done();
        });
      });
    });
    it('should prepare wallet with external xpubkey', function(done) {
      var client = helpers.newClient(app);
      client.seedFromExternalWalletPublicKey('xpub6D52jcEfKA4cGeGcVC9pwG37Ju8pUMQrhptw82QVHRSAGBELE5uCee7Qq8RJUqQVyxfJfwbJKYyqyFhc2Xg8cJyN11kRvnAaWcACXP6K0zv', 'ledger', 2);
      client.isPrivKeyExternal().should.equal(true);
      client.getPrivKeyExternalSourceName().should.equal('ledger');
      client.getExternalIndex().should.equal(2);
      done();
    });
  });

  describe('Network fees', function() {
    it('should get current fee levels', function(done) {
      blockchainExplorerMock.setFeeLevels({
        1: 40000,
        3: 20000,
        10: 18000,
      });
      clients[0].credentials = {};
      clients[0].getFeeLevels('livenet', function(err, levels) {
        should.not.exist(err);
        should.exist(levels);
        _.difference(['emergency', 'priority', 'normal', 'economy'], _.pluck(levels, 'level')).should.be.empty;
        done();
      });
    });
  });

  describe('Preferences', function() {
    it('should save and retrieve preferences', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].getPreferences(function(err, preferences) {
          should.not.exist(err);
          preferences.should.be.empty;
          clients[0].savePreferences({
            email: 'dummy@dummy.com'
          }, function(err) {
            should.not.exist(err);
            clients[0].getPreferences(function(err, preferences) {
              should.not.exist(err);
              should.exist(preferences);
              preferences.email.should.equal('dummy@dummy.com');
              done();
            });
          });
        });
      });
    });
  });

  describe('Address Creation', function() {
    it('should be able to create address in all copayers in a 2-3 wallet', function(done) {
      this.timeout(5000);
      helpers.createAndJoinWallet(clients, 2, 3, function() {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          clients[1].createAddress(function(err, x1) {
            should.not.exist(err);
            should.exist(x1.address);
            clients[2].createAddress(function(err, x2) {
              should.not.exist(err);
              should.exist(x2.address);
              done();
            });
          });
        });
      });
    });
    it('should see balance on address created by others', function(done) {
      this.timeout(5000);
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);

          blockchainExplorerMock.setUtxo(x0, 10, w.m);
          clients[0].getBalance(function(err, bal0) {
            should.not.exist(err);
            bal0.totalAmount.should.equal(10 * 1e8);
            bal0.lockedAmount.should.equal(0);
            clients[1].getBalance(function(err, bal1) {
              bal1.totalAmount.should.equal(10 * 1e8);
              bal1.lockedAmount.should.equal(0);
              done();
            });
          });
        });
      });
    });
    it('should detect fake addresses', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        helpers.tamperResponse(clients[0], 'post', '/v1/addresses/', {}, function(address) {
          address.address = '2N86pNEpREGpwZyHVC5vrNUCbF9nM1Geh4K';
        }, function() {
          clients[0].createAddress(function(err, x0) {
            err.code.should.contain('SERVERCOMPROMISED');
            done();
          });
        });
      });
    });
    it('should detect fake public keys', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        helpers.tamperResponse(clients[0], 'post', '/v1/addresses/', {}, function(address) {
          address.publicKeys = [
            '0322defe0c3eb9fcd8bc01878e6dbca7a6846880908d214b50a752445040cc5c54',
            '02bf3aadc17131ca8144829fa1883c1ac0a8839067af4bca47a90ccae63d0d8037'
          ];
        }, function() {
          clients[0].createAddress(function(err, x0) {
            err.code.should.contain('SERVERCOMPROMISED');
            done();
          });
        });
      });
    });
  });

  describe('Transaction Proposals Creation and Locked funds', function() {
    it('Should create proposal and get it', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 30000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[0].getTx(x.id, function(err, x2) {
              should.not.exist(err);
              x2.creatorName.should.equal('creator');
              x2.message.should.equal('hello');
              x2.amount.should.equal(30000);
              x2.fee.should.equal(10000);
              x2.toAddress.should.equal('n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5');
              done();
            });
          });
        });
      });
    });

    it('Should fail to create proposal with insufficient funds', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 300000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.exist(err);
            err.code.should.contain('INSUFFICIENTFUNDS');
            done();
          });
        });
      });
    });
    it('Should fail to create proposal with insufficient funds for fee', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 2 * 1e8 - 2000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.exist(err);
            err.code.should.contain('INSUFFICIENTFUNDS');
            err.message.should.contain('for fee');
            opts.feePerKb = 2000;
            clients[0].sendTxProposal(opts, function(err, x) {
              should.not.exist(err);
              clients[0].getTx(x.id, function(err, x2) {
                should.not.exist(err);
                x2.fee.should.equal(2000);
                done();
              });
            });
          });
        });
      });
    });
    it('Should lock and release funds through rejection', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 120000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            clients[0].sendTxProposal(opts, function(err, y) {
              err.code.should.contain('LOCKEDFUNDS');

              clients[0].rejectTxProposal(x, 'no', function(err, z) {
                should.not.exist(err);
                z.status.should.equal('rejected');
                clients[0].sendTxProposal(opts, function(err, x) {
                  should.not.exist(err);
                  done();
                });
              });
            });
          });
        });
      });
    });
    it('Should lock and release funds through removal', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 120000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            clients[0].sendTxProposal(opts, function(err, y) {
              err.code.should.contain('LOCKEDFUNDS');

              clients[0].removeTxProposal(x, function(err) {
                should.not.exist(err);

                clients[0].sendTxProposal(opts, function(err, x) {
                  should.not.exist(err);
                  done();
                });
              });
            });
          });
        });
      });
    });
    it('Should keep message and refusal texts', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'some message',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[1].rejectTxProposal(x, 'rejection comment', function(err, tx1) {
              should.not.exist(err);

              clients[2].getTxProposals({}, function(err, txs) {
                should.not.exist(err);
                txs[0].message.should.equal('some message');
                txs[0].actions[0].comment.should.equal('rejection comment');
                done();
              });
            });
          });
        });
      });
    });
    it('Should encrypt proposal message', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'some message',
          };
          var spy = sinon.spy(clients[0], '_doPostRequest');
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            spy.calledOnce.should.be.true;
            JSON.stringify(spy.getCall(0).args).should.not.contain('some message');
            done();
          });
        });
      });
    });
    it('Should encrypt proposal refusal comment', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            var spy = sinon.spy(clients[1], '_doPostRequest');
            clients[1].rejectTxProposal(x, 'rejection comment', function(err, tx1) {
              should.not.exist(err);
              spy.calledOnce.should.be.true;
              JSON.stringify(spy.getCall(0).args).should.not.contain('rejection comment');
              done();
            });
          });
        });
      });
    });
    it('should detect fake tx proposals (wrong signature)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].proposalSignature = '304402206e4a1db06e00068582d3be41cfc795dcf702451c132581e661e7241ef34ca19202203e17598b4764913309897d56446b51bc1dcd41a25d90fdb5f87a6b58fe3a6920';
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                should.exist(err);
                err.code.should.contain('SERVERCOMPROMISED');
                done();
              });
            });
          });
        });
      });
    });

    it('should detect fake tx proposals (tampered amount)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].amount = 100000;
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                should.exist(err);
                err.code.should.contain('SERVERCOMPROMISED');
                done();
              });
            });
          });
        });
      });
    });
    it('should detect fake tx proposals (change address not it wallet)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].changeAddress.address = 'n2tbmpzpecgufct2ebyitj12tpzkhn2mn5';
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                should.exist(err);
                err.code.should.contain('SERVERCOMPROMISED');
                done();
              });
            });
          });
        });
      });
    });
    it('Should return only main addresses (case 1)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: 10000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[0].getMainAddresses({}, function(err, addr) {
              should.not.exist(err);
              addr.length.should.equal(1);
              done();
            });
          });
        });
      });
    });
    it('Should return only main addresses (case 2)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            clients[0].getMainAddresses({
              doNotVerify: true
            }, function(err, addr) {
              should.not.exist(err);
              addr.length.should.equal(2);
              done();
            });
          });
        });
      });
    });
    it('Should return UTXOs', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].getUtxos(function(err, utxos) {
          should.not.exist(err);
          utxos.length.should.equal(0)
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            should.exist(x0.address);
            blockchainExplorerMock.setUtxo(x0, 1, 1);
            clients[0].getUtxos(function(err, utxos) {
              should.not.exist(err);
              utxos.length.should.equal(1);
              done();
            });
          });
        });
      });
    });
  });

  describe('Payment Protocol', function() {
    var http;

    beforeEach(function(done) {
      http = sinon.stub();
      http.yields(null, TestData.payProBuf);
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            payProUrl: 'dummy',
          };
          clients[0].payProHttp = clients[1].payProHttp = http;

          clients[0].fetchPayPro(opts, function(err, paypro) {
            clients[0].sendTxProposal({
              toAddress: paypro.toAddress,
              amount: paypro.amount,
              message: paypro.memo,
              payProUrl: opts.payProUrl,
            }, function(err, x) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('Should Create and Verify a Tx from PayPro', function(done) {

      clients[1].getTxProposals({}, function(err, txps) {
        should.not.exist(err);
        var tx = txps[0];
        // From the hardcoded paypro request
        tx.amount.should.equal(404500);
        tx.toAddress.should.equal('mjfjcbuYwBUdEyq2m7AezjCAR4etUBqyiE');
        tx.message.should.equal('Payment request for BitPay invoice CibEJJtG1t9H77KmM61E2t for merchant testCopay');
        tx.payProUrl.should.equal('dummy');
        done();
      });
    });

    it('Should Detect tampered PayPro Proposals at getTxProposals', function(done) {
      helpers.tamperResponse(clients[1], 'get', '/v1/txproposals/', {}, function(txps) {
        txps[0].amount++;
        // Generate the right signature (with client 0)
        var sig = clients[0]._computeProposalSignature(txps[0]);
        txps[0].proposalSignature = sig;

        return txps;
      }, function() {
        clients[1].getTxProposals({}, function(err, txps) {
          err.code.should.contain('SERVERCOMPROMISED');
          done();
        });
      });
    });

    it('Should Detect tampered PayPro Proposals at signTx', function(done) {
      helpers.tamperResponse(clients[1], 'get', '/v1/txproposals/', {}, function(txps) {
        txps[0].amount++;
        // Generate the right signature (with client 0)
        var sig = clients[0]._computeProposalSignature(txps[0]);
        txps[0].proposalSignature = sig;
        return txps;
      }, function() {
        clients[1].getTxProposals({
          doNotVerify: true
        }, function(err, txps) {
          should.not.exist(err);
          clients[1].signTxProposal(txps[0], function(err, txps) {
            err.code.should.contain('SERVERCOMPROMISED');
            done();
          });
        });
      });
    });

    it('Should handle broken paypro data', function(done) {
      http = sinon.stub();
      http.yields(null, 'a broken data');
      clients[0].payProHttp = http;
      var opts = {
        payProUrl: 'dummy',
      };
      clients[0].fetchPayPro(opts, function(err, paypro) {
        should.exist(err);
        err.should.contain('parse');
        done();
      });
    });

    it('Should ignore PayPro at getTxProposals if instructed', function(done) {
      http.yields(null, 'kaka');
      clients[1].doNotVerifyPayPro = true;
      clients[1].getTxProposals({}, function(err, txps) {
        should.not.exist(err);
        var tx = txps[0];
        // From the hardcoded paypro request
        tx.amount.should.equal(404500);
        tx.toAddress.should.equal('mjfjcbuYwBUdEyq2m7AezjCAR4etUBqyiE');
        tx.message.should.equal('Payment request for BitPay invoice CibEJJtG1t9H77KmM61E2t for merchant testCopay');
        tx.payProUrl.should.equal('dummy');
        done();
      });
    });

    it('Should ignore PayPro at signTxProposal if instructed', function(done) {
      http.yields(null, 'kaka');
      clients[1].doNotVerifyPayPro = true;
      clients[1].getTxProposals({}, function(err, txps) {
        should.not.exist(err);
        clients[1].signTxProposal(txps[0], function(err, txps) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('Should send the "payment message" when last copayer sign', function(done) {
      clients[0].getTxProposals({}, function(err, txps) {
        should.not.exist(err);
        clients[0].signTxProposal(txps[0], function(err, xx, paypro) {
          should.not.exist(err);
          clients[1].signTxProposal(xx, function(err, yy, paypro) {
            should.not.exist(err);
            yy.status.should.equal('accepted');
            http.onCall(5).yields(null, TestData.payProAckBuf);

            clients[1].broadcastTxProposal(yy, function(err, zz, memo) {
              should.not.exist(err);
              var args = http.lastCall.args[0];
              args.method.should.equal('POST');
              args.body.length.should.equal(302);
              memo.should.equal('Transaction received by BitPay. Invoice will be marked as paid if the transaction is confirmed.');
              done();
            });
          });
        });
      });
    });


    it('Should send correct refund address', function(done) {
      clients[0].getTxProposals({}, function(err, txps) {
        should.not.exist(err);
        clients[0].signTxProposal(txps[0], function(err, xx, paypro) {
          should.not.exist(err);
          clients[1].signTxProposal(xx, function(err, yy, paypro) {
            should.not.exist(err);
            yy.status.should.equal('accepted');
            http.onCall(5).yields(null, TestData.payProAckBuf);

            clients[1].broadcastTxProposal(yy, function(err, zz, memo) {
              should.not.exist(err);
              clients[1].getMainAddresses({}, function(err, walletAddresses) {
                var args = http.lastCall.args[0];
                var data = BitcorePayPro.Payment.decode(args.body);
                var pay = new BitcorePayPro();
                var p = pay.makePayment(data);
                var refund_to = p.get('refund_to');
                refund_to.length.should.equal(1);

                refund_to = refund_to[0];

                var amount = refund_to.get('amount')
                amount.low.should.equal(404500);
                amount.high.should.equal(0);
                var s = refund_to.get('script');
                s = new Bitcore.Script(s.buffer.slice(s.offset, s.limit));
                var addr = new Bitcore.Address.fromScript(s, 'testnet');
                addr.toString().should.equal(
                  walletAddresses[walletAddresses.length - 1].address);
                done();
              });
            });
          });
        });
      });
    });


    it('Should fail if refund address is tampered', function(done) {
      clients[0].getTxProposals({}, function(err, txps) {
        should.not.exist(err);
        clients[0].signTxProposal(txps[0], function(err, xx, paypro) {
          should.not.exist(err);
          clients[1].signTxProposal(xx, function(err, yy, paypro) {
            should.not.exist(err);
            yy.status.should.equal('accepted');
            http.onCall(5).yields(null, TestData.payProAckBuf);

            helpers.tamperResponse(clients[1], 'post', '/v1/addresses/', {}, function(address) {
              address.address = '2N86pNEpREGpwZyHVC5vrNUCbF9nM1Geh4K';
            }, function() {
              clients[1].broadcastTxProposal(yy, function(err, zz, memo) {
                err.code.should.contain('SERVERCOMPROMISED');
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Multiple output proposals', function() {
    it('should create, get, sign, and broadcast proposal', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            type: 'multiple_outputs',
            message: 'hello',
            outputs: [{
              amount: 10000,
              toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
              message: 'world',
            }, {
              amount: 20000,
              toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
              message: null,
            }, {
              amount: 30000,
              toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            }]
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[0].getTx(x.id, function(err, x2) {
              should.not.exist(err);
              x2.creatorName.should.equal('creator');
              x2.message.should.equal('hello');
              x2.fee.should.equal(10000);
              x2.outputs[0].toAddress.should.equal('n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5');
              x2.outputs[0].amount.should.equal(10000);
              x2.outputs[0].message.should.equal('world');
              x2.outputs[1].toAddress.should.equal('n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5');
              x2.outputs[1].amount.should.equal(20000);
              should.not.exist(x2.outputs[1].message);
              x2.outputs[2].toAddress.should.equal('n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5');
              x2.outputs[2].amount.should.equal(30000);
              should.not.exist(x2.outputs[2].message);
              clients[0].signTxProposal(x2, function(err, txp) {
                should.not.exist(err);
                txp.status.should.equal('accepted');
                clients[0].broadcastTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('broadcasted');
                  txp.txid.should.equal((new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted)).id);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Optional Proposal Fields', function() {
    var opts;
    beforeEach(function(done) {
      opts = {
        type: 'simple',
        amount: 10000,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'some message',
        payProUrl: 'dummy'
      };
      done();
    });

    function doTest(opts, done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[1].getTx(x.id, function(err, x2) {
              should.not.exist(err);
              should.exist(x2);
              clients[0].removeTxProposal(x2, function(err) {
                done();
              });
            });
          });
        });
      });
    };

    it('should pass with complete simple header', function(done) {
      doTest(opts, done);
    });
    it('should pass with null message', function(done) {
      opts.message = null;
      doTest(opts, done);
    });
    it('should pass with no message', function(done) {
      delete opts.message;
      doTest(opts, done);
    });
    it('should pass with null payProUrl', function(done) {
      opts.payProUrl = '';
      doTest(opts, done);
    });
    it('should pass with no payProUrl', function(done) {
      delete opts.payProUrl;
      doTest(opts, done);
    });
    it('should pass with complete multi-output header', function(done) {
      opts.type = 'multiple_outputs';
      opts.outputs = [{
        toAddress: opts.toAddress,
        amount: opts.amount,
        message: opts.message
      }];
      delete opts.toAddress;
      delete opts.amount;
      doTest(opts, done);
    });
    it('should pass with multi-output header and no message', function(done) {
      opts.type = 'multiple_outputs';
      opts.outputs = [{
        toAddress: opts.toAddress,
        amount: opts.amount
      }];
      delete opts.toAddress;
      delete opts.amount;
      doTest(opts, done);
    });
  });

  describe('Transactions Signatures and Rejection', function() {
    this.timeout(5000);
    it('Send and broadcast in 1-1 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: 10000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            txp.requiredRejections.should.equal(1);
            txp.requiredSignatures.should.equal(1);
            txp.status.should.equal('pending');
            txp.changeAddress.path.should.equal('m/2147483647/1/0');
            clients[0].signTxProposal(txp, function(err, txp) {
              should.not.exist(err);
              txp.status.should.equal('accepted');
              clients[0].broadcastTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                txp.status.should.equal('broadcasted');
                txp.txid.should.equal((new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted)).id);
                done();
              });
            });
          });
        });
      });
    });
    it('Send and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            clients[0].getStatus(function(err, st) {
              should.not.exist(err);
              var txp = st.pendingTxps[0];
              txp.status.should.equal('pending');
              txp.requiredRejections.should.equal(2);
              txp.requiredSignatures.should.equal(2);
              var w = st.wallet;
              w.copayers.length.should.equal(3);
              w.status.should.equal('complete');
              var b = st.balance;
              b.totalAmount.should.equal(1000000000);
              b.lockedAmount.should.equal(1000000000);


              clients[0].signTxProposal(txp, function(err, txp) {
                should.not.exist(err, err);
                txp.status.should.equal('pending');
                clients[1].signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  clients[1].broadcastTxProposal(txp, function(err, txp) {
                    txp.status.should.equal('broadcasted');
                    txp.txid.should.equal((new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted)).id);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it.skip('Send, reject actions in 2-3 wallet much have correct copayerNames', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            clients[0].rejectTxProposal(txp, 'wont sign', function(err, txp) {
              should.not.exist(err, err);
              clients[1].signTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });
    });



    it('Send, reject, 2 signs and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(2);
            clients[0].rejectTxProposal(txp, 'wont sign', function(err, txp) {
              should.not.exist(err, err);
              txp.status.should.equal('pending');
              clients[1].signTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                clients[2].signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  clients[2].broadcastTxProposal(txp, function(err, txp) {
                    txp.status.should.equal('broadcasted');
                    txp.txid.should.equal((new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted)).id);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('Send, reject in 3-4 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 3, 4, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 3);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(3);

            clients[0].rejectTxProposal(txp, 'wont sign', function(err, txp) {
              should.not.exist(err, err);
              txp.status.should.equal('pending');
              clients[1].signTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                txp.status.should.equal('pending');
                clients[2].rejectTxProposal(txp, 'me neither', function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('rejected');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Should not allow to reject or sign twice', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(2);
            clients[0].signTxProposal(txp, function(err, txp) {
              should.not.exist(err);
              txp.status.should.equal('pending');
              clients[0].signTxProposal(txp, function(err) {
                should.exist(err);
                err.code.should.contain('CVOTED');
                clients[1].rejectTxProposal(txp, 'xx', function(err, txp) {
                  should.not.exist(err);
                  clients[1].rejectTxProposal(txp, 'xx', function(err) {
                    should.exist(err);
                    err.code.should.contain('CVOTED');
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Transaction history', function() {
    it('should get transaction history', function(done) {
      blockchainExplorerMock.setHistory(TestData.history);
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          clients[0].getTxHistory({}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(2);
            done();
          });
        });
      });
    });
    it('should get empty transaction history when there are no addresses', function(done) {
      blockchainExplorerMock.setHistory(TestData.history);
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].getTxHistory({}, function(err, txs) {
          should.not.exist(err);
          should.exist(txs);
          txs.length.should.equal(0);
          done();
        });
      });
    });
    it('should get transaction history decorated with proposal', function(done) {
      async.waterfall([

        function(next) {
          helpers.createAndJoinWallet(clients, 2, 3, function(w) {
            clients[0].createAddress(function(err, address) {
              should.not.exist(err);
              should.exist(address);
              next(null, address);
            });
          });
        },
        function(address, next) {
          blockchainExplorerMock.setUtxo(address, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'some message',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            clients[1].rejectTxProposal(txp, 'some reason', function(err, txp) {
              should.not.exist(err);
              clients[2].signTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                clients[0].signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  clients[0].broadcastTxProposal(txp, function(err, txp) {
                    should.not.exist(err);
                    txp.status.should.equal('broadcasted');
                    next(null, txp);
                  });
                });
              });
            });
          });
        },
        function(txp, next) {
          var history = _.cloneDeep(TestData.history);
          history[0].txid = txp.txid;
          blockchainExplorerMock.setHistory(history);
          clients[0].getTxHistory({}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(2);
            var decorated = _.find(txs, {
              txid: txp.txid
            });
            should.exist(decorated);
            decorated.proposalId.should.equal(txp.id);
            decorated.message.should.equal('some message');
            decorated.actions.length.should.equal(3);
            var rejection = _.find(decorated.actions, {
              type: 'reject'
            });
            should.exist(rejection);
            rejection.comment.should.equal('some reason');
            done();
          });
        }
      ]);
    });
    it('should get paginated transaction history', function(done) {
      var testCases = [{
        opts: {},
        expected: [20, 10]
      }, {
        opts: {
          skip: 1,
        },
        expected: [10]
      }, {
        opts: {
          limit: 1,
        },
        expected: [20]
      }, {
        opts: {
          skip: 3,
        },
        expected: []
      }, {
        opts: {
          skip: 1,
          limit: 10,
        },
        expected: [10]
      }, ];

      blockchainExplorerMock.setHistory(TestData.history);
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          async.each(testCases, function(testCase, next) {
            clients[0].getTxHistory(testCase.opts, function(err, txs) {
              should.not.exist(err);
              should.exist(txs);
              var times = _.pluck(txs, 'time');
              times.should.deep.equal(testCase.expected);
              next();
            });
          }, done);
        });
      });
    });
  });

  describe('Mobility, backup & restore', function() {
    describe('Export & Import', function() {
      describe('Success', function() {
        var address, importedClient;
        beforeEach(function(done) {
          importedClient = null;
          helpers.createAndJoinWallet(clients, 1, 1, function() {
            clients[0].createAddress(function(err, addr) {
              should.not.exist(err);
              should.exist(addr.address);
              address = addr.address;
              done();
            });
          });
        });
        afterEach(function(done) {
          importedClient.getMainAddresses({}, function(err, list) {
            should.not.exist(err);
            should.exist(list);
            list.length.should.equal(1);
            list[0].address.should.equal(address);
            done();
          });
        });

        it('should export & import', function() {
          var exported = clients[0].export();

          importedClient = helpers.newClient(app);
          importedClient.import(exported);
        });
        it('should export & import compressed', function(done) {
          var walletId = clients[0].credentials.walletId;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;

          var exported = clients[0].export({
            compressed: true
          });

          importedClient = helpers.newClient(app);
          importedClient.import(exported, {
            compressed: true
          });
          importedClient.openWallet(function(err) {
            should.not.exist(err);
            importedClient.credentials.walletId.should.equal(walletId);
            importedClient.credentials.walletName.should.equal(walletName);
            importedClient.credentials.copayerName.should.equal(copayerName);
            done();
          });
        });
        it('should export without signing rights', function() {
          clients[0].canSign().should.be.true;
          var exported = clients[0].export({
            noSign: true,
          });

          importedClient = helpers.newClient(app);
          importedClient.import(exported);
          importedClient.canSign().should.be.false;
        });
      });
      describe('Fail', function() {
        it.skip('should fail to export compressed & import uncompressed', function() {});
        it.skip('should fail to export uncompressed & import compressed', function() {});
      });
    });

    describe('Recovery', function() {
      it('should be able to regain access to a 1-1 wallet with just the xPriv', function(done) {
        helpers.createAndJoinWallet(clients, 1, 1, function() {
          var xpriv = clients[0].credentials.xPrivKey;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;

          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);

            var recoveryClient = helpers.newClient(app);
            recoveryClient.seedFromExtendedPrivateKey(xpriv);
            recoveryClient.openWallet(function(err) {
              should.not.exist(err);
              recoveryClient.credentials.walletName.should.equal(walletName);
              recoveryClient.credentials.copayerName.should.equal(copayerName);
              recoveryClient.getMainAddresses({}, function(err, list) {
                should.not.exist(err);
                should.exist(list);
                list[0].address.should.equal(addr.address);
                done();
              });
            });
          });
        });
      });
      it('should be able to recreate wallet', function(done) {
        helpers.createAndJoinWallet(clients, 2, 2, function() {
          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);

            var storage = new Storage({
              db: helpers.newDb(),
            });

            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start({
                storage: storage,
                blockchainExplorer: blockchainExplorerMock,
                disableLogs: true,
              },
              function() {
                newApp = expressApp.app;

                var oldPKR = _.clone(clients[0].credentials.publicKeyRing);
                var recoveryClient = helpers.newClient(newApp);
                recoveryClient.import(clients[0].export());

                recoveryClient.getStatus(function(err, status) {
                  should.exist(err);
                  err.code.should.equal('NOTAUTHORIZED');
                  recoveryClient.recreateWallet(function(err) {
                    should.not.exist(err);
                    recoveryClient.getStatus(function(err, status) {
                      should.not.exist(err);
                      _.difference(_.pluck(status.wallet.copayers, 'name'), ['creator', 'copayer 1']).length.should.equal(0);
                      recoveryClient.createAddress(function(err, addr2) {
                        should.not.exist(err);
                        should.exist(addr2);
                        addr2.address.should.equal(addr.address);
                        addr2.path.should.equal(addr.path);

                        var recoveryClient2 = helpers.newClient(newApp);
                        recoveryClient2.import(clients[1].export());
                        recoveryClient2.getStatus(function(err, status) {
                          should.not.exist(err);
                          done();
                        });
                      });
                    });
                  });
                });
              });
          });
        });
      });
      it('should be able to recover funds from recreated wallet', function(done) {
        this.timeout(10000);
        helpers.createAndJoinWallet(clients, 2, 2, function() {
          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);
            blockchainExplorerMock.setUtxo(addr, 1, 2);

            var storage = new Storage({
              db: helpers.newDb(),
            });
            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start({
                storage: storage,
                blockchainExplorer: blockchainExplorerMock,
                disableLogs: true,
              },
              function() {
                newApp = expressApp.app;

                var recoveryClient = helpers.newClient(newApp);
                recoveryClient.import(clients[0].export());

                recoveryClient.getStatus(function(err, status) {
                  should.exist(err);
                  err.code.should.equal('NOTAUTHORIZED');
                  recoveryClient.recreateWallet(function(err) {
                    should.not.exist(err);
                    recoveryClient.getStatus(function(err, status) {
                      should.not.exist(err);
                      recoveryClient.startScan({}, function(err) {
                        should.not.exist(err);
                        var balance = 0;
                        async.whilst(function() {
                          return balance == 0;
                        }, function(next) {
                          setTimeout(function() {
                            recoveryClient.getBalance(function(err, b) {
                              balance = b.totalAmount;
                              next(err);
                            });
                          }, 200);
                        }, function(err) {
                          should.not.exist(err);
                          balance.should.equal(1e8);
                          done();
                        });
                      });
                    });
                  });
                });
              });
          });
        });
      });

      it('should be able call recreate wallet twice', function(done) {
        helpers.createAndJoinWallet(clients, 2, 2, function() {
          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);

            var storage = new Storage({
              db: helpers.newDb(),
            });
            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start({
                storage: storage,
                blockchainExplorer: blockchainExplorerMock,
                disableLogs: true,
              },
              function() {
                newApp = expressApp.app;

                var oldPKR = _.clone(clients[0].credentials.publicKeyRing);
                var recoveryClient = helpers.newClient(newApp);
                recoveryClient.import(clients[0].export());

                recoveryClient.getStatus(function(err, status) {
                  should.exist(err);
                  err.code.should.equal('NOTAUTHORIZED');
                  recoveryClient.recreateWallet(function(err) {
                    should.not.exist(err);
                    recoveryClient.recreateWallet(function(err) {
                      should.not.exist(err);
                      recoveryClient.getStatus(function(err, status) {
                        should.not.exist(err);
                        _.difference(_.pluck(status.wallet.copayers, 'name'), ['creator', 'copayer 1']).length.should.equal(0);
                        recoveryClient.createAddress(function(err, addr2) {
                          should.not.exist(err);
                          should.exist(addr2);
                          addr2.address.should.equal(addr.address);
                          addr2.path.should.equal(addr.path);

                          var recoveryClient2 = helpers.newClient(newApp);
                          recoveryClient2.import(clients[1].export());
                          recoveryClient2.getStatus(function(err, status) {
                            should.not.exist(err);
                            done();
                          });
                        });
                      });
                    });
                  });
                });
              });
          });
        });
      });

    });
  });

  describe('Air gapped related flows', function() {
    it('should create wallet in proxy from airgapped', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom('testnet');
      var exported = airgapped.export({
        noSign: true
      });

      var proxy = helpers.newClient(app);
      proxy.import(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      var seedSpy = sinon.spy(proxy, 'seedFromRandom');
      proxy.createWallet('wallet name', 'creator', 1, 1, {
        network: 'testnet'
      }, function(err) {
        should.not.exist(err);
        seedSpy.called.should.be.false;
        proxy.getStatus(function(err, status) {
          should.not.exist(err);
          status.wallet.name.should.equal('wallet name');
          done();
        });
      });
    });
    it('should fail to create wallet in proxy from airgapped when networks do not match', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom('testnet');
      var exported = airgapped.export({
        noSign: true
      });

      var proxy = helpers.newClient(app);
      proxy.import(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      var seedSpy = sinon.spy(proxy, 'seedFromRandom');
      should.not.exist(proxy.credentials.xPrivKey);
      proxy.createWallet('wallet name', 'creator', 1, 1, {
        network: 'livenet'
      }, function(err) {
        should.exist(err);
        err.message.should.equal('Existing keys were created for a different network');
        done();
      });
    });
    it('should be able to sign from airgapped client and broadcast from proxy', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom('testnet');
      var exported = airgapped.export({
        noSign: true
      });

      var proxy = helpers.newClient(app);
      proxy.import(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      async.waterfall([

          function(next) {
            proxy.createWallet('wallet name', 'creator', 1, 1, {
              network: 'testnet'
            }, function(err) {
              should.not.exist(err);
              proxy.createAddress(function(err, address) {
                should.not.exist(err);
                should.exist(address.address);
                blockchainExplorerMock.setUtxo(address, 1, 1);
                var opts = {
                  amount: 1200000,
                  toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                  message: 'hello 1-1',
                };
                proxy.sendTxProposal(opts, next);
              });
            });
          },
          function(txp, next) {
            should.exist(txp);
            proxy.signTxProposal(txp, function(err, txp) {
              should.exist(err);
              should.not.exist(txp);
              err.message.should.equal('You do not have the required keys to sign transactions');
              next(null, txp);
            });
          },
          function(txp, next) {
            proxy.getTxProposals({
              forAirGapped: true
            }, next);
          },
          function(bundle, next) {
            var signatures = airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
            next(null, signatures);
          },
          function(signatures, next) {
            proxy.getTxProposals({}, function(err, txps) {
              should.not.exist(err);
              var txp = txps[0];
              txp.signatures = signatures;
              async.each(txps, function(txp, cb) {
                proxy.signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  proxy.broadcastTxProposal(txp, function(err, txp) {
                    should.not.exist(err);
                    txp.status.should.equal('broadcasted');
                    should.exist(txp.txid);
                    cb();
                  });
                });
              }, function(err) {
                next(err);
              });
            });
          },
        ],
        function(err) {
          should.not.exist(err);
          done();
        }
      );
    });
    describe('Failure and tampering', function() {
      var airgapped, proxy, bundle;

      beforeEach(function(done) {
        airgapped = new Client();
        airgapped.seedFromRandom('testnet');
        var exported = airgapped.export({
          noSign: true
        });

        proxy = helpers.newClient(app);
        proxy.import(exported);
        should.not.exist(proxy.credentials.xPrivKey);

        async.waterfall([

            function(next) {
              proxy.createWallet('wallet name', 'creator', 1, 1, {
                network: 'testnet'
              }, function(err) {
                should.not.exist(err);
                proxy.createAddress(function(err, address) {
                  should.not.exist(err);
                  should.exist(address.address);
                  blockchainExplorerMock.setUtxo(address, 1, 1);
                  var opts = {
                    amount: 1200000,
                    toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                    message: 'hello 1-1',
                  };
                  proxy.sendTxProposal(opts, next);
                });
              });
            },
            function(txp, next) {
              proxy.getTxProposals({
                forAirGapped: true
              }, function(err, result) {
                should.not.exist(err);
                bundle = result;
                next();
              });
            },
          ],
          function(err) {
            should.not.exist(err);
            done();
          }
        );
      });
      it('should fail to sign from airgapped client when there is no extended private key', function(done) {
        delete airgapped.credentials.xPrivKey;
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw(Error, 'You do not have the required keys to sign transactions');
        done();
      });
      it('should fail gracefully when PKR cannot be decrypted in airgapped client', function(done) {
        bundle.encryptedPkr = 'dummy';
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw(Error, 'Could not decrypt public key ring');
        done();
      });
      it('should be able to detect invalid or tampered PKR when signing on airgapped client', function(done) {
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, 2);
        }).should.throw(Error, 'Invalid public key ring');
        done();
      });
      it('should be able to detect tampered proposal when signing on airgapped client', function(done) {
        bundle.txps[0].encryptedMessage = 'tampered message';
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw(Error, 'Fake transaction proposal');
        done();
      });
      it('should be able to detect tampered change address when signing on airgapped client', function(done) {
        bundle.txps[0].changeAddress.address = 'mqNkvNuhzZKeXYNRZ1bdj55smmW3acr6K7';
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw(Error, 'Fake transaction proposal');
        done();
      });
    });
  });

  describe('Legacy Copay Import', function() {
    it('Should get wallets from profile', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      var ids = c.getWalletIdsFromOldCopay(t.username, t.password, t.ls['profile::4872dd8b2ceaa54f922e8e6ba6a8eaa77b488721']);
      ids.should.deep.equal([
        '8f197244e661f4d0',
        '4d32f0737a05f072',
        'e2c2d72024979ded',
        '7065a73486c8cb5d'
      ]);
      done();
    });
    it('Should import a 1-1 wallet', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::e2c2d72024979ded'], function(err) {
        should.not.exist(err);
        c.credentials.m.should.equal(1);
        c.credentials.n.should.equal(1);

        c.createAddress(function(err, x0) {
          // This is the first 'shared' address, created automatically
          // by old copay
          x0.address.should.equal('2N3w8sJUyAXCQirqNsTayWr7pWADFNdncmf');
          c.getStatus(function(err, status) {
            should.not.exist(err);
            status.wallet.status.should.equal('complete');
            c.credentials.walletId.should.equal('e2c2d72024979ded');
            c.credentials.walletPrivKey.should.equal('c3463113c6e1d0fc2f2bd520f7d9d62f8e1fdcdd96005254571c64902aeb1648');
            c.credentials.sharedEncryptingKey.should.equal('x3D/7QHa4PkKMbSXEvXwaw==');
            // TODO?
            // bal1.totalAmount.should.equal(18979980);
            done();
          });
        });
      });
    });
    it('Should to import the same wallet twice with different clients', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
        should.not.exist(err);
        c.getStatus(function(err, status) {
          should.not.exist(err);
          status.wallet.status.should.equal('complete');
          c.credentials.walletId.should.equal('4d32f0737a05f072');
          var c2 = helpers.newClient(app);
          c2.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
            should.not.exist(err);
            c2.getStatus(function(err, status) {
              should.not.exist(err);
              status.wallet.status.should.equal('complete');
              c2.credentials.walletId.should.equal('4d32f0737a05f072');
              done();
            });
          });
        });
      });
    });
    it('Should not fail when importing the same wallet twice, same copayer', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
        should.not.exist(err);
        c.getStatus(function(err, status) {
          should.not.exist(err);
          status.wallet.status.should.equal('complete');
          c.credentials.walletId.should.equal('4d32f0737a05f072');
          c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('Should import and complete 2-2 wallet from 2 copayers, and create addresses', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
        should.not.exist(err);
        c.getStatus(function(err, status) {
          should.not.exist(err);
          status.wallet.status.should.equal('complete');
          c.credentials.sharedEncryptingKey.should.equal('Ou2j4kq3z1w4yTr9YybVxg==');

          var counts = _.countBy(status.wallet.publicKeyRing, 'isTemporaryRequestKey');
          counts[false].should.equal(1);
          counts[true].should.equal(1);
          var t2 = ImportData.copayers[1];
          var c2 = helpers.newClient(app);
          c2.createWalletFromOldCopay(t2.username, t2.password, t2.ls['wallet::4d32f0737a05f072'], function(err) {
            should.not.exist(err);
            c2.credentials.sharedEncryptingKey.should.equal('Ou2j4kq3z1w4yTr9YybVxg==');

            // This should pull the non-temporary keys
            c2.getStatus(function(err, status) {
              should.not.exist(err);
              status.wallet.status.should.equal('complete');
              c2.credentials.hasTemporaryRequestKeys().should.equal(false);
              c2.createAddress(function(err, x0) {
                x0.address.should.be.equal('2Mv1DHpozzZ9fup2nZ1kmdRXoNnDJ8b1JF2');
                c.createAddress(function(err, x0) {
                  x0.address.should.be.equal('2N2dZ1HogpxHVKv3CD2R4WrhWRwqZtpDc2M');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Should import and complete 2-3 wallet from 2 copayers, and create addresses', function(done) {
      var w = 'wallet::7065a73486c8cb5d';
      var key = 'fS4HhoRd25KJY4VpNpO1jg==';
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls[w], function(err) {
        should.not.exist(err);
        c.getStatus(function(err, status) {
          should.not.exist(err);
          status.wallet.status.should.equal('complete');
          c.credentials.sharedEncryptingKey.should.equal(key);

          var counts = _.countBy(status.wallet.publicKeyRing, 'isTemporaryRequestKey');
          counts[false].should.equal(1);
          counts[true].should.equal(2);
          status.wallet.publicKeyRing[1].isTemporaryRequestKey.should.equal(true);
          var t2 = ImportData.copayers[1];
          var c2 = helpers.newClient(app);
          c2.createWalletFromOldCopay(t2.username, t2.password, t2.ls[w], function(err) {
            should.not.exist(err);
            c2.credentials.sharedEncryptingKey.should.equal(key);

            c2.getStatus(function(err, status) {
              should.not.exist(err);
              status.wallet.status.should.equal('complete');
              c2.credentials.hasTemporaryRequestKeys().should.equal(true);

              var counts = _.countBy(status.wallet.publicKeyRing, 'isTemporaryRequestKey');
              counts[false].should.equal(2);
              counts[true].should.equal(1);

              var t3 = ImportData.copayers[2];
              var c3 = helpers.newClient(app);
              c3.createWalletFromOldCopay(t3.username, t3.password, t3.ls[w], function(err) {
                should.not.exist(err);
                c3.credentials.sharedEncryptingKey.should.equal(key);

                // This should pull the non-temporary keys
                c3.getStatus(function(err, status) {
                  should.not.exist(err);
                  status.wallet.status.should.equal('complete');
                  c3.credentials.hasTemporaryRequestKeys().should.equal(false);

                  var counts = _.countBy(status.wallet.publicKeyRing, 'isTemporaryRequestKey');
                  counts[false].should.equal(3);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Should import a 2-3 wallet from 2 copayers, and recreate it, and then on the recreated other copayers should be able to access', function(done) {
      var w = 'wallet::7065a73486c8cb5d';
      var key = 'fS4HhoRd25KJY4VpNpO1jg==';
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls[w], function(err) {
        should.not.exist(err);
        var t2 = ImportData.copayers[1];
        var c2 = helpers.newClient(app);
        c2.createWalletFromOldCopay(t2.username, t2.password, t2.ls[w], function(err) {
          should.not.exist(err);

          // New BWS server...
          var storage = new Storage({
            db: helpers.newDb(),
          });
          var newApp;
          var expressApp = new ExpressApp();
          expressApp.start({
              storage: storage,
              blockchainExplorer: blockchainExplorerMock,
              disableLogs: true,
            },
            function() {
              newApp = expressApp.app;
            });
          var recoveryClient = helpers.newClient(newApp);
          recoveryClient.import(c.export());
          recoveryClient.recreateWallet(function(err) {
            should.not.exist(err);
            recoveryClient.getStatus(function(err, status) {
              should.not.exist(err);
              _.pluck(status.wallet.copayers, 'name').should.deep.equal(['123', '234', '345']);
              var t2 = ImportData.copayers[1];
              var c2p = helpers.newClient(newApp);
              c2p.createWalletFromOldCopay(t2.username, t2.password, t2.ls[w], function(err) {
                should.not.exist(err);
                c2p.getStatus(function(err, status) {
                  should.not.exist(err);
                  _.pluck(status.wallet.copayers, 'name').should.deep.equal(['123', '234', '345']);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Private key encryption', function() {
    var password = 'jesuissatoshi';
    var c1, c2;
    var importedClient;

    beforeEach(function(done) {
      c1 = clients[1];
      clients[1].createWallet('wallet name', 'creator', 1, 1, {
        network: 'testnet',
      }, function() {
        clients[1].setPrivateKeyEncryption(password);
        clients[1].lock();
        done();
      });
    });
    it('should not lock if not encrypted', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        (function() {
          clients[0].lock();
        }).should.throw('encrypted');
        done();
      });
    });

    it('should return priv key is not encrypted', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].isPrivKeyEncrypted().should.equal(false);
        clients[0].hasPrivKeyEncrypted().should.equal(false);
        done();
      });
    });
    it('should return priv key is encrypted', function() {
      c1.isPrivKeyEncrypted().should.equal(true);
      c1.hasPrivKeyEncrypted().should.equal(true);
    });
    it('should prevent to reencrypt the priv key', function() {
      (function() {
        c1.setPrivateKeyEncryption('pepe');
      }).should.throw('Already');
    });
    it('should prevent to disable priv key encryption when locked', function() {
      (function() {
        c1.disablePrivateKeyEncryption();
      }).should.throw('locked');
      c1.isPrivKeyEncrypted().should.equal(true);
      c1.hasPrivKeyEncrypted().should.equal(true);
    });
    it('should allow to disable priv key encryption when unlocked', function() {
      c1.unlock(password);
      c1.disablePrivateKeyEncryption();
      c1.isPrivKeyEncrypted().should.equal(false);
      c1.hasPrivKeyEncrypted().should.equal(false);
    });

    it('should prevent to encrypt airgapped\'s proxy credentials', function() {
      var airgapped = new Client();
      airgapped.seedFromRandom('testnet');
      var exported = airgapped.export({
        noSign: true
      });
      var proxy = helpers.newClient(app);
      proxy.import(exported);
      should.not.exist(proxy.credentials.xPrivKey);
      (function() {
        proxy.setPrivateKeyEncryption('pepe');
      }).should.throw('No private key');
    });
    it('should lock and unlock', function() {
      c1.unlock(password);
      var xpriv = c1.credentials.xPrivKey;
      c1.isPrivKeyEncrypted().should.equal(false);
      c1.hasPrivKeyEncrypted().should.equal(true);
      c1.lock();
      c1.isPrivKeyEncrypted().should.equal(true);
      c1.hasPrivKeyEncrypted().should.equal(true);
      var str = JSON.stringify(c1);
      str.indexOf(xpriv).should.equal(-1);
    });
    it('should fail to unlock with wrong password', function() {
      (function() {
        c1.unlock('hola')
      }).should.throw('Could not unlock');
    });


    it('should export & import uncompressed, locked', function(done) {
      var walletId = c1.credentials.walletId;
      var walletName = c1.credentials.walletName;
      var copayerName = c1.credentials.copayerName;
      var exported = c1.export({});
      importedClient = helpers.newClient(app);
      importedClient.import(exported, {});
      importedClient.openWallet(function(err) {
        should.not.exist(err);
        importedClient.credentials.walletId.should.equal(walletId);
        importedClient.credentials.walletName.should.equal(walletName);
        importedClient.credentials.copayerName.should.equal(copayerName);
        importedClient.isPrivKeyEncrypted().should.equal(true);
        importedClient.hasPrivKeyEncrypted().should.equal(true);
        importedClient.unlock(password);
        importedClient.isPrivKeyEncrypted().should.equal(false);
        importedClient.hasPrivKeyEncrypted().should.equal(true);
        done();
      });
    });


    it('should export & import compressed, locked', function(done) {
      var walletId = c1.credentials.walletId;
      var walletName = c1.credentials.walletName;
      var copayerName = c1.credentials.copayerName;
      var exported = c1.export({
        compressed: true
      });
      importedClient = helpers.newClient(app);
      importedClient.import(exported, {
        compressed: true,
        password: password,
      });
      importedClient.openWallet(function(err) {
        should.not.exist(err);
        importedClient.credentials.walletId.should.equal(walletId);
        importedClient.credentials.walletName.should.equal(walletName);
        importedClient.credentials.copayerName.should.equal(copayerName);
        importedClient.isPrivKeyEncrypted().should.equal(true);
        importedClient.hasPrivKeyEncrypted().should.equal(true);
        done();
      });
    });
    it('should not sign when locked', function(done) {
      c1.createAddress(function(err, x0) {
        should.not.exist(err);
        blockchainExplorerMock.setUtxo(x0, 1, 1);
        var opts = {
          amount: 10000000,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello 1-1',
        };
        c1.sendTxProposal(opts, function(err, txp) {
          should.not.exist(err);
          c1.signTxProposal(txp, function(err) {
            err.message.should.contain('encrypted');
            done();
          });
        });
      });
    });
    it('should sign when unlocked', function(done) {
      c1.createAddress(function(err, x0) {
        should.not.exist(err);
        blockchainExplorerMock.setUtxo(x0, 1, 1);
        var opts = {
          amount: 10000000,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello 1-1',
        };
        c1.sendTxProposal(opts, function(err, txp) {
          should.not.exist(err);
          c1.unlock(password);
          c1.signTxProposal(txp, function(err) {
            should.not.exist(err);
            c1.lock();
            c1.isPrivKeyEncrypted().should.equal(true);
            c1.hasPrivKeyEncrypted().should.equal(true);
            done();
          });
        });
      });
    });
  });
});
