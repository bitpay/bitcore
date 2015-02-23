'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var levelup = require('levelup');
var memdown = require('memdown');
var async = require('async');
var request = require('supertest');
var Client = require('../../lib/client');
var API = Client.API;
var Bitcore = require('bitcore');
var WalletUtils = require('../../lib/walletutils');
var ExpressApp = require('../../lib/expressapp');
var Storage = require('../../lib/storage');


var helpers = {};

helpers.getRequest = function(app) {
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

helpers.createAndJoinWallet = function(clients, m, n, cb) {
  clients[0].createWallet('wallet name', 'creator', m, n, 'testnet',
    function(err, secret) {
      if (err) return cb(err);
      if (n == 1) return cb();

      should.exist(secret);
      async.each(_.range(n - 1), function(i, cb) {
        clients[i + 1].joinWallet(secret, 'copayer ' + (i + 1), function(err, result) {
          should.not.exist(err);
          return cb(err);
        });
      }, function(err) {
        if (err) return cb(err);
        return cb(null, {
          m: m,
          n: n,
          secret: secret,
        });
      });
    });
};


var fsmock = {};
var content = {};
fsmock.readFile = function(name, enc, cb) {
  if (!content || _.isEmpty(content[name]))
    return cb('empty');

  return cb(null, content[name]);
};
fsmock.writeFile = function(name, data, cb) {
  content[name] = data;
  return cb();
};
fsmock.reset = function() {
  content = {};
};

fsmock._get = function(name) {
  return content[name];
};
fsmock._set = function(name, data) {
  return content[name] = data;
};


var blockExplorerMock = {};
blockExplorerMock.utxos = [];




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

blockExplorerMock.reset = function() {
  blockExplorerMock.utxos = [];
};

describe('client API ', function() {
  var clients, app;

  beforeEach(function() {
    clients = [];
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
    _.each(_.range(5), function(i) {
      var storage = new Client.FileStorage({
        filename: 'client' + i,
        fs: fsmock,
      });
      var client = new Client({
        storage: storage,
      });

      client.request = helpers.getRequest(app);
      clients.push(client);
    });
    fsmock.reset();
    blockExplorerMock.reset();
  });

  describe('Server internals', function() {
    it('should allow cors', function(done) {
      clients[0]._doRequest('options', '/', null, {}, function(err, x, headers) {
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
      var client = new Client({
        storage: s2,
      });
      client.request = helpers.getRequest(app);
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
      var client = new Client({
        storage: s2,
      });
      client.request = helpers.getRequest(app);
      client.createWallet('1', '2', 1, 1, 'testnet',
        function(err) {
          err.code.should.equal('ERROR');
          done();
        });
    });

  });


  describe('Wallet Creation', function() {
    it('should check balance in a 1-1 ', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(err) {
        should.not.exist(err);
        clients[0].getBalance(function(err, x) {
          should.not.exist(err);
          done();
        })
      });
    });
    it('should be able to complete wallets in copayer that joined later', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err) {
        should.not.exist(err);
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
      helpers.createAndJoinWallet(clients, 2, 2, function(err, w) {
        should.not.exist(err);
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
      helpers.createAndJoinWallet(clients, 2, 3, function(err) {
        should.not.exist(err);

        // Get right response
        clients[0]._load(function(err, data) {
          var url = '/v1/wallets/';
          clients[0]._doGetRequest(url, data, function(err, x) {

            // Tamper data
            x.wallet.copayers[0].xPubKey = x.wallet.copayers[1].xPubKey;

            // Tamper response
            clients[1]._doGetRequest = sinon.stub().yields(null, x);

            clients[1].getBalance(function(err, x) {
              err.code.should.contain('SERVERCOMPROMISED');
              done();
            });
          });
        });
      });
    });

    it('should reject wallets with missing signatures', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err) {
        should.not.exist(err);

        // Get right response
        var data = clients[0]._load(function(err, data) {
          var url = '/v1/wallets/';
          clients[0]._doGetRequest(url, data, function(err, x) {

            // Tamper data
            delete x.wallet.copayers[1].xPubKey;

            // Tamper response
            clients[1]._doGetRequest = sinon.stub().yields(null, x);

            clients[1].getBalance(function(err, x) {
              err.code.should.contain('SERVERCOMPROMISED');
              done();
            });
          });
        });
      });
    });


    it('should reject wallets missing caller"s pubkey', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err) {
        should.not.exist(err);

        // Get right response
        var data = clients[0]._load(function(err, data) {
          var url = '/v1/wallets/';
          clients[0]._doGetRequest(url, data, function(err, x) {

            // Tamper data. Replace caller's pubkey
            x.wallet.copayers[1].xPubKey = (new Bitcore.HDPrivateKey()).publicKey;
            // Add a correct signature
            x.wallet.copayers[1].xPubKeySignature = WalletUtils.signMessage(
              x.wallet.copayers[1].xPubKey, data.walletPrivKey),

            // Tamper response
            clients[1]._doGetRequest = sinon.stub().yields(null, x);

            clients[1].getBalance(function(err, x) {
              err.code.should.contain('SERVERCOMPROMISED');
              done();
            });
          });
        });
      });
    });
  });

  describe('Access control', function() {
    it('should not be able to create address if not rwPubKey', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(err) {
        should.not.exist(err);

        var data = JSON.parse(fsmock._get('client0'));
        delete data.rwPrivKey;
        fsmock._set('client0', JSON.stringify(data));
        data.rwPrivKey = null;
        clients[0].createAddress(function(err, x0) {
          err.code.should.equal('NOTAUTHORIZED');
          done();
        });
      });
    });
    it('should not be able to create address from a ro export', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(err) {
        should.not.exist(err);
        clients[0].export({
          access: 'readonly'
        }, function(err, str) {
          should.not.exist(err);
          clients[1].import(str, function(err, wallet) {
            should.not.exist(err);
            clients[1].createAddress(function(err, x0) {
              err.code.should.equal('NOTAUTHORIZED');
              clients[0].createAddress(function(err, x0) {
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });
    });
    it('should be able to create address from a rw export', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(err) {
        should.not.exist(err);
        clients[0].export({
          access: 'readwrite'
        }, function(err, str) {
          should.not.exist(err);
          clients[1].import(str, function(err, wallet) {
            should.not.exist(err);
            clients[1].createAddress(function(err, x0) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should not be able to create tx proposals from a rw export', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(err, w) {
        should.not.exist(err);
        clients[0].export({
          access: 'readwrite'
        }, function(err, str) {
          clients[1].import(str, function(err, wallet) {
            should.not.exist(err);
            clients[1].createAddress(function(err, x0) {
              should.not.exist(err);
              blockExplorerMock.setUtxo(x0, 1, 1);
              var opts = {
                amount: 10000000,
                toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                message: 'hello 1-1',
              };
              clients[1].sendTxProposal(opts, function(err, x) {
                should.not.exist(err);
                clients[1].signTxProposal(x, function(err, tx) {
                  err.code.should.be.equal('BADSIGNATURES');
                  clients[1].getTxProposals({}, function(err, txs) {
                    should.not.exist(err);
                    txs[0].status.should.equal('pending');
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
  describe('Air gapped flows', function() {
    it('should be able get Tx proposals from a file', function(done) {
      helpers.createAndJoinWallet(clients, 1, 2, function(err, w) {
        should.not.exist(err);
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: 10000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[1].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[1].getTxProposals({
              getRawTxps: true
            }, function(err, txs, rawTxps) {
              should.not.exist(err);

              clients[0].parseTxProposals({
                txps: rawTxps
              }, function(err, txs2) {
                should.not.exist(err);
                txs[0].should.deep.equal(txs2[0]);
                done();
              });

            });
          });
        });
      });
    });
    it('should detect fakes from Tx proposals file', function(done) {
      helpers.createAndJoinWallet(clients, 1, 2, function(err, w) {
        should.not.exist(err);
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: 10000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[1].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[1].getTxProposals({
              getRawTxps: true
            }, function(err, txs, rawTxps) {
              should.not.exist(err);

              //Tamper 
              rawTxps[0].amount++;

              clients[0].parseTxProposals({
                txps: rawTxps
              }, function(err, txs2) {
                err.code.should.equal('SERVERCOMPROMISED');
                done();
              });

            });
          });
        });
      });
    });

    it('should complete public key ring from file', function(done) {
      helpers.createAndJoinWallet(clients, 1, 2, function(err, w) {
        should.not.exist(err);

        clients[1].createAddress(function(err, x0) {
          should.not.exist(err);
          blockExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: 10000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[1].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            // Create the proxy, ro, connected, device (2)
            clients[0].export({
              access: 'readonly'
            }, function(err, str) {
              should.not.exist(err);
              clients[2].import(str, function(err, wallet) {
                should.not.exist(err);

                clients[2].getTxProposals({
                  getRawTxps: true
                }, function(err, txs, rawTxps) {
                  should.not.exist(err);

                  clients[2].getEncryptedPublicKeyRing(function(err, pkr) {
                    should.not.exist(err);

                    // Back to the air gapped
                    //
                    // Will trigger _tryToComplete and use pkr
                    // then, needs pkr to verify the txps
                    clients[0].parseTxProposals({
                      txps: rawTxps,
                      pkr: pkr,
                    }, function(err, txs2) {
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
    it('should be able export signatures and sign later from a ro client',
      function(done) {
        helpers.createAndJoinWallet(clients, 1, 1, function(err, w) {
          should.not.exist(err);
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            blockExplorerMock.setUtxo(x0, 1, 1);
            blockExplorerMock.setUtxo(x0, 1, 2);
            var opts = {
              amount: 150000000,
              toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
              message: 'hello 1-1',
            };
            clients[0].sendTxProposal(opts, function(err, txp) {
              should.not.exist(err);
              clients[0].getSignatures(txp, function(err, signatures) {
                should.not.exist(err);
                signatures.length.should.equal(txp.inputs.length);
                signatures[0].length.should.above(62 * 2);

                txp.signatures = signatures;

                // Make client RO
                var data = JSON.parse(fsmock._get('client0'));
                delete data.xPrivKey;
                fsmock._set('client0', JSON.stringify(data));

                clients[0].signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('broadcasted');
                  done();
                });
              });
            });
          });
        });
      });
  });

  describe('Address Creation', function() {
    it('should be able to create address in all copayers in a 2-3 wallet', function(done) {
      this.timeout(5000);
      helpers.createAndJoinWallet(clients, 2, 3, function(err) {
        should.not.exist(err);
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
      helpers.createAndJoinWallet(clients, 2, 2, function(err, w) {
        should.not.exist(err);
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
      helpers.createAndJoinWallet(clients, 2, 2, function(err) {
        should.not.exist(err);

        // Get right response
        clients[0]._load(function(err, data) {
          var url = '/v1/addresses/';
          clients[0]._doPostRequest(url, {}, data, function(err, address) {

            // Tamper data
            address.address = '2N86pNEpREGpwZyHVC5vrNUCbF9nM1Geh4K';

            // Tamper response
            clients[1]._doPostRequest = sinon.stub().yields(null, address);

            // Grab real response
            clients[1].createAddress(function(err, x0) {
              err.code.should.contain('SERVERCOMPROMISED');
              done();
            });
          });
        });
      });
    });
    it('should detect fake public keys', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(err) {
        should.not.exist(err);

        // Get right response
        clients[0]._load(function(err, data) {
          var url = '/v1/addresses/';
          clients[0]._doPostRequest(url, {}, data, function(err, address) {

            // Tamper data
            address.publicKeys = ['0322defe0c3eb9fcd8bc01878e6dbca7a6846880908d214b50a752445040cc5c54',
              '02bf3aadc17131ca8144829fa1883c1ac0a8839067af4bca47a90ccae63d0d8037'
            ];

            // Tamper response
            clients[1]._doPostRequest = sinon.stub().yields(null, address);

            // Grab real response
            clients[1].createAddress(function(err, x0) {
              err.code.should.contain('SERVERCOMPROMISED');
              done();
            });
          });
        });
      });
    });

  });


  describe('Wallet Backups and Mobility', function() {

    it('round trip #import #export', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(err, w) {
        should.not.exist(err);
        clients[0].export({}, function(err, str) {
          should.not.exist(err);
          var original = JSON.parse(fsmock._get('client0'));
          clients[2].import(str, function(err, wallet) {
            should.not.exist(err);
            var clone = JSON.parse(fsmock._get('client2'));
            delete original.walletPrivKey; // no need to persist it.
            clone.should.deep.equal(original);
            done();
          });

        });
      });
    });
    it('should recreate a wallet, create addresses and receive money', function(done) {
      var backup = '["tprv8ZgxMBicQKsPehCdj4HM1MZbKVXBFt5Dj9nQ44M99EdmdiUfGtQBDTSZsKmzdUrB1vEuP6ipuoa39UXwPS2CvnjE1erk5aUjc5vQZkWvH4B",2,["tpubD6NzVbkrYhZ4XCNDPDtyRWPxvJzvTkvUE2cMPB8jcUr9Dkicv6cYQmA18DBAid6eRK1BGCU9nzgxxVdQUGLYJ34XsPXPW4bxnH4PH6oQBF3"],"sd0kzXmlXBgTGHrKaBW4aA=="]';
      clients[0].import(backup, function(err, wallet) {
        should.not.exist(err);
        clients[0].reCreateWallet('pepe', function(err, wallet) {
          should.not.exist(err);

          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            should.exist(x0.address);
            blockExplorerMock.setUtxo(x0, 10, 2);
            clients[0].getBalance(function(err, bal0) {
              should.not.exist(err);
              bal0.totalAmount.should.equal(10 * 1e8);
              bal0.lockedAmount.should.equal(0);
              done();
            });
          });
        });
      });
    });
  });


  describe('Transaction Proposals Creation and Locked funds', function() {
    it('Should lock and release funds', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(err, w) {
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
    it('Should keep message and refusal texts', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err, w) {
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
      helpers.createAndJoinWallet(clients, 2, 3, function(err, w) {
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
      helpers.createAndJoinWallet(clients, 2, 3, function(err, w) {
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
      helpers.createAndJoinWallet(clients, 2, 2, function(err) {
        should.not.exist(err);

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


            // Get right response
            clients[0]._load(function(err, data) {
              var url = '/v1/txproposals/';
              clients[0]._doGetRequest(url, data, function(err, txps) {

                // Tamper data
                txps[0].proposalSignature = '304402206e4a1db06e00068582d3be41cfc795dcf702451c132581e661e7241ef34ca19202203e17598b4764913309897d56446b51bc1dcd41a25d90fdb5f87a6b58fe3a6920';

                // Tamper response
                clients[0]._doGetRequest = sinon.stub().yields(null, txps);

                // Grab real response
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
    });
    it('should detect fake tx proposals (tampered amount)', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(err) {
        should.not.exist(err);

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


            // Get right response
            clients[0]._load(function(err, data) {
              var url = '/v1/txproposals/';
              clients[0]._doGetRequest(url, data, function(err, txps) {

                // Tamper data
                txps[0].amount = 100000;

                // Tamper response
                clients[0]._doGetRequest = sinon.stub().yields(null, txps);

                // Grab real response
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
    });
    it('should detect fake tx proposals (change address not it wallet)', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(err) {
        should.not.exist(err);

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


            // Get right response
            clients[0]._load(function(err, data) {
              var url = '/v1/txproposals/';
              clients[0]._doGetRequest(url, data, function(err, txps) {
                // Tamper data
                txps[0].changeAddress.address = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';

                // Tamper response
                clients[0]._doGetRequest = sinon.stub().yields(null, txps);

                // Grab real response
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
    });
    it('Should return only main addresses (case 1)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(err, w) {
        should.not.exist(err);
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
      helpers.createAndJoinWallet(clients, 1, 1, function(err, w) {
        should.not.exist(err);
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
      helpers.createAndJoinWallet(clients, 1, 1, function(err, w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: 10000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            x.requiredRejections.should.equal(1);
            x.requiredSignatures.should.equal(1);
            x.status.should.equal('pending');
            x.changeAddress.path.should.equal('m/2147483647/1/0');
            clients[0].signTxProposal(x, function(err, tx) {
              should.not.exist(err);
              tx.status.should.equal('broadcasted');
              tx.txid.should.equal((new Bitcore.Transaction(blockExplorerMock.lastBroadcasted)).id);
              done();
            });
          });
        });
      });
    });
    it('Send and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err, w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[0].getStatus(function(err, st) {
              should.not.exist(err);
              var x = st.pendingTxps[0];
              x.status.should.equal('pending');
              x.requiredRejections.should.equal(2);
              x.requiredSignatures.should.equal(2);
              var w = st.wallet;
              w.copayers.length.should.equal(3);
              w.status.should.equal('complete');
              var b = st.balance;
              b.totalAmount.should.equal(1000000000);
              b.lockedAmount.should.equal(1000000000);


              clients[0].signTxProposal(x, function(err, tx) {
                should.not.exist(err, err);
                tx.status.should.equal('pending');
                clients[1].signTxProposal(x, function(err, tx) {
                  should.not.exist(err);
                  tx.status.should.equal('broadcasted');
                  tx.txid.should.equal((new Bitcore.Transaction(blockExplorerMock.lastBroadcasted)).id);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Send, reject, 2 signs and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err, w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            x.status.should.equal('pending');
            x.requiredRejections.should.equal(2);
            x.requiredSignatures.should.equal(2);
            clients[0].rejectTxProposal(x, 'wont sign', function(err, tx) {
              should.not.exist(err, err);
              tx.status.should.equal('pending');
              clients[1].signTxProposal(x, function(err, tx) {
                should.not.exist(err);
                clients[2].signTxProposal(x, function(err, tx) {
                  should.not.exist(err);
                  tx.status.should.equal('broadcasted');
                  tx.txid.should.equal((new Bitcore.Transaction(blockExplorerMock.lastBroadcasted)).id);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Send, reject in 3-4 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 3, 4, function(err, w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            x.status.should.equal('pending');
            x.requiredRejections.should.equal(2);
            x.requiredSignatures.should.equal(3);

            clients[0].rejectTxProposal(x, 'wont sign', function(err, tx) {
              should.not.exist(err, err);
              tx.status.should.equal('pending');
              clients[1].signTxProposal(x, function(err, tx) {
                should.not.exist(err);
                tx.status.should.equal('pending');
                clients[2].rejectTxProposal(x, 'me neither', function(err, tx) {
                  should.not.exist(err);
                  tx.status.should.equal('rejected');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Should not allow to reject or sign twice', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err, w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            x.status.should.equal('pending');
            x.requiredRejections.should.equal(2);
            x.requiredSignatures.should.equal(2);
            clients[0].signTxProposal(x, function(err, tx) {
              should.not.exist(err, err);
              tx.status.should.equal('pending');
              clients[0].signTxProposal(x, function(err, tx) {
                err.code.should.contain('CVOTED');
                clients[1].rejectTxProposal(x, 'xx', function(err, tx) {
                  should.not.exist(err);
                  clients[1].rejectTxProposal(x, 'xx', function(err, tx) {
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
});
