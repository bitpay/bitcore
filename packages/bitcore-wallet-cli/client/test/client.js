'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var levelup = require('levelup');
var memdown = require('memdown');
var async = require('async');
var request = require('supertest');
var Client = require('../../lib/client');
var AirGapped = Client.AirGapped;
var Bitcore = require('bitcore');
var WalletUtils = require('../../lib/walletutils');
var ExpressApp = require('../../lib/expressapp');
var Storage = require('../../lib/storage');
var TestData = require('../testdata');


var helpers = {};

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

helpers.createAndJoinWallet = function(clients, m, n, cb) {
  clients[0].createWallet('wallet name', 'creator', m, n, 'testnet',
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


var blockExplorerMock = {};

blockExplorerMock.getUnspentUtxos = function(dummy, cb) {
  var ret = _.map(blockExplorerMock.utxos || [], function(x) {
    var y = _.clone(x);
    y.toObject = function() {
      return this;
    };
    return y;
  });
  return cb(null, ret);
};

blockExplorerMock.setUtxo = function(address, amount, m) {
  blockExplorerMock.utxos.push({
    txid: Bitcore.crypto.Hash.sha256(new Buffer(Math.random() * 100000)).toString('hex'),
    vout: Math.floor((Math.random() * 10) + 1),
    amount: amount,
    address: address.address,
    scriptPubKey: Bitcore.Script.buildMultisigOut(address.publicKeys, m).toScriptHashOut().toString(),
  });
};

blockExplorerMock.broadcast = function(raw, cb) {
  blockExplorerMock.lastBroadcasted = raw;
  return cb(null, (new Bitcore.Transaction(raw)).id);
};

blockExplorerMock.setHistory = function(txs) {
  blockExplorerMock.txHistory = txs;
};

blockExplorerMock.getTransactions = function(addresses, cb) {
  return cb(null, blockExplorerMock.txHistory || []);
};

blockExplorerMock.reset = function() {
  blockExplorerMock.utxos = [];
  blockExplorerMock.txHistory = [];
};



describe('client API ', function() {
  var clients, app;

  beforeEach(function() {
    var db = levelup(memdown, {
      valueEncoding: 'json'
    });
    var storage = new Storage({
      db: db
    });
    app = ExpressApp.start({
      WalletService: {
        storage: storage,
        blockExplorer: blockExplorerMock,
      },
      disableLogs: true,
    });
    // Generates 5 clients
    clients = _.map(_.range(5), function(i) {
      return helpers.newClient(app);
    });
    blockExplorerMock.reset();
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
      app = ExpressApp.start({
        WalletService: {
          storage: s,
          blockExplorer: blockExplorerMock,
        },
        disableLogs: true,
      });
      var s2 = sinon.stub();
      s2.load = sinon.stub().yields(null);
      var client = helpers.newClient(app);
      client.storage = s2;
      client.createWallet('1', '2', 1, 1, 'testnet',
        function(err) {
          err.code.should.equal('ERROR');
          done();
        });
    });

    it('should handle critical errors (Case2)', function(done) {
      var s = sinon.stub();
      s.storeWallet = sinon.stub().yields({
        code: 501,
        message: 'wow'
      });
      s.fetchWallet = sinon.stub().yields(null);
      app = ExpressApp.start({
        WalletService: {
          storage: s,
          blockExplorer: blockExplorerMock,
        },
        disableLogs: true,
      });
      var s2 = sinon.stub();
      s2.load = sinon.stub().yields(null);
      var client = helpers.newClient(app);
      client.storage = s2;
      client.createWallet('1', '2', 1, 1, 'testnet',
        function(err) {
          err.code.should.equal('ERROR');
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
    it('should be able to complete wallets in copayer that joined later', function(done) {
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

    it('should reject wallets with bad signatures', function(done) {
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

    it('should reject wallets with missing signatures', function(done) {
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

    it('should reject wallets missing callers pubkey', function(done) {
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
    it.skip('should return wallet status even if wallet is not yet complete', function(done) {});
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

          blockExplorerMock.setUtxo(x0, 10, w.m);
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
    it('Should lock and release funds through rejection', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 1, 2);
          blockExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 120000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            clients[0].sendTxProposal(opts, function(err, y) {
              err.code.should.contain('INSUFFICIENTFUNDS');

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
          blockExplorerMock.setUtxo(x0, 1, 2);
          blockExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 120000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            clients[0].sendTxProposal(opts, function(err, y) {
              err.code.should.contain('INSUFFICIENTFUNDS');

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
          blockExplorerMock.setUtxo(x0, 10, 2);
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
          blockExplorerMock.setUtxo(x0, 10, 2);
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
          blockExplorerMock.setUtxo(x0, 10, 2);
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
          blockExplorerMock.setUtxo(x0, 10, 2);
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
          blockExplorerMock.setUtxo(x0, 10, 2);
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
          blockExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].changeAddress.address = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
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
          blockExplorerMock.setUtxo(x0, 1, 1);
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
  });

  describe('Transactions Signatures and Rejection', function() {
    this.timeout(5000);
    it('Send and broadcast in 1-1 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 1, 1);
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
                txp.status.should.equal('broadcasted');
                txp.txid.should.equal((new Bitcore.Transaction(blockExplorerMock.lastBroadcasted)).id);
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
          blockExplorerMock.setUtxo(x0, 10, 1);
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
                    txp.txid.should.equal((new Bitcore.Transaction(blockExplorerMock.lastBroadcasted)).id);
                    done();
                  });
                });
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
          blockExplorerMock.setUtxo(x0, 10, 1);
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
                    txp.txid.should.equal((new Bitcore.Transaction(blockExplorerMock.lastBroadcasted)).id);
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
          blockExplorerMock.setUtxo(x0, 10, 1);
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
          blockExplorerMock.setUtxo(x0, 10, 1);
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
      blockExplorerMock.setHistory(TestData.history);
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
      blockExplorerMock.setHistory(TestData.history);
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].getTxHistory({}, function(err, txs) {
          should.not.exist(err);
          should.exist(txs);
          txs.length.should.equal(0);
          done();
        });
      });
    });
    it.skip('should get transaction history decorated with proposal', function(done) {});
    it.skip('should get paginated transaction history', function(done) {});
  });

  describe('Mobility, backup & recovery', function() {
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
        it.skip('should export & import compressed', function() {
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
          importedClient.credentials.walletId.should.equal(walletId);
          importedClient.credentials.walletName.should.equal(walletName);
          importedClient.credentials.copayerName.should.equal(copayerName);
        });
        it('should export & import encrypted', function() {
          var xPrivKey = clients[0].credentials.xPrivKey;
          should.exist(xPrivKey);

          var exported = clients[0].export({
            password: '123'
          });
          exported.should.not.contain(xPrivKey);

          importedClient = helpers.newClient(app);
          importedClient.import(exported, {
            password: '123'
          });
          should.exist(importedClient.credentials.xPrivKey);
          importedClient.credentials.xPrivKey.should.equal(xPrivKey);
        });
        it('should export & import compressed & encrypted', function() {
          var exported = clients[0].export({
            compressed: true,
            password: '123'
          });

          importedClient = helpers.newClient(app);
          importedClient.import(exported, {
            compressed: true,
            password: '123'
          });
        });
      });
      describe('Fail', function() {
        it.skip('should fail to export compressed & import uncompressed', function() {});
        it.skip('should fail to export uncompressed & import compressed', function() {});
        it.skip('should fail to export unencrypted & import with password', function() {});
        it.skip('should fail to export encrypted & import with incorrect password', function() {});
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
              console.log(err);
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
    });
  });

  describe('Air gapped related flows', function() {
    it('should create wallet in proxy from airgapped', function(done) {
      var airgapped = new AirGapped({
        network: 'testnet'
      });
      var seed = airgapped.getSeed();

      var proxy = helpers.newClient(app);
      proxy.seedFromAirGapped(seed);
      should.not.exist(proxy.credentials.xPrivKey);
      proxy.createWallet('wallet name', 'creator', 1, 1, 'testnet', function(err) {
        should.not.exist(err);
        proxy.getStatus(function(err, status) {
          should.not.exist(err);
          status.wallet.name.should.equal('wallet name');
          done();
        });
      });
    });

    it('should be able to sign from airgapped client and broadcast from proxy', function(done) {
      var airgapped = new AirGapped({
        network: 'testnet'
      });
      var seed = airgapped.getSeed();

      var proxy = helpers.newClient(app);
      proxy.seedFromAirGapped(seed);

      async.waterfall([

          function(next) {
            proxy.createWallet('wallet name', 'creator', 1, 1, 'testnet', function(err) {
              should.not.exist(err);
              proxy.createAddress(function(err, address) {
                should.not.exist(err);
                should.exist(address.address);
                blockExplorerMock.setUtxo(address, 1, 1);
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
            var signatures = airgapped.signTxProposal(bundle.txps[0], bundle.publicKeyRing, bundle.m, bundle.n);
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
    it.skip('should be able to detect tampered PKR when signing on airgapped client', function(done) {});
    it.skip('should be able to detect tampered proposal when signing on airgapped client', function(done) {});
    it.skip('should be able to detect tampered change address when signing on airgapped client', function(done) {});
  });
});
