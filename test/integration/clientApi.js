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
var TestData = require('./clienttestdata');
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
      CopayServer: {
        storage: storage,
        blockExplorer: blockExplorerMock,
      }
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
    it('should fail with a unknown secret', function(done) {
      var oldSecret = '3f8e5acb-ceeb-4aae-134f-692d934e3b1c:L2gohj8s2fLKqVU5cQutAVGciutUxczFxLxxXHFsjzLh71ZjkFQQ:T';
      clients[0].joinWallet(oldSecret, 'copayer', function(err, result) {
        err.code.should.contain('BADREQUEST');
        done();
      });
    });
    it('should reject wallets with bad signatures', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err) {
        should.not.exist(err);

        // Get right response
        var data = clients[0]._load(function(err, data) {
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
  });


  describe('Wallet Backups and Mobility', function() {

    it('round trip #import #export', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(err, w) {
        should.not.exist(err);
        clients[0].export(function(err, str) {
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


  describe('Transactions Signatures and Rejection', function() {
    it('Send and broadcast in 1-1 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(err, w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: '0.1btc',
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hola 1-1',
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
            message: 'hola 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            x.status.should.equal('pending');
            x.requiredRejections.should.equal(2);
            x.requiredSignatures.should.equal(2);
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

    it('Send, reject, 2 signs and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(err, w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hola 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            x.status.should.equal('pending');
            x.requiredRejections.should.equal(2);
            x.requiredSignatures.should.equal(2);
            clients[0].rejectTxProposal(x, 'no me gusto', function(err, tx) {
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
            message: 'hola 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            x.status.should.equal('pending');
            x.requiredRejections.should.equal(2);
            x.requiredSignatures.should.equal(3);

            clients[0].rejectTxProposal(x, 'no me gusto', function(err, tx) {
              should.not.exist(err, err);
              tx.status.should.equal('pending');
              clients[1].signTxProposal(x, function(err, tx) {
                should.not.exist(err);
                tx.status.should.equal('pending');
                clients[2].rejectTxProposal(x, 'tampoco me gusto', function(err, tx) {
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
            message: 'hola 1-1',
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

  describe('Transaction Troposals and Locked funds', function() {
    it('Should lock and release funds', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(err, w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockExplorerMock.setUtxo(x0, 1, 2);
          blockExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: '1.2btc',
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hola 1-1',
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
  });



  /*
  describe('TODO', function(x) {
    it('should detect fake addresses ', function(done) {
      var response = {
        createdOn: 1424105995,
        address: '2N3fA6wDtnebzywPkGuNK9KkFaEzgbPRRTq',
        path: 'm/2147483647/0/8',
        publicKeys: ['03f6a5fe8db51bfbaf26ece22a3e3bc242891a47d3048fc70bc0e8c03a071ad76f']
      };
      var request = sinon.mock().yields(null, {
        statusCode: 200
      }, response);
      client.request = request;
      client.createAddress(function(err, x) {
        err.code.should.equal('SERVERCOMPROMISED');
        err.message.should.contain('fake address');
        done();
      });
    });
  });


  describe('#getTxProposals', function() {
    it('should return tx proposals and decrypt message', function(done) {
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.complete11));
      var request = sinon.mock().yields(null, {
        statusCode: 200
      }, TestData.serverResponse.pendingTxs);
      client.request = request;

      client.getTxProposals({}, function(err, x) {
        should.not.exist(err);
        x.length.should.equal(1);
        x[0].id.should.equal(TestData.serverResponse.pendingTxs[0].id);
        x[0].decryptedMessage.should.equal('hola');
        done();
      });
    });
  });

  describe('#sendTxProposal ', function() {
    it('should send tx proposal with encrypted message', function(done) {
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.complete11));
      var response = {};
      var request = sinon.mock().yields(null, {
        statusCode: 200
      }, response);
      client.request = request;

      var args = {
        toAddress: '2N3fA6wDtnebzywPkGuNK9KkFaEzgbPRRTq',
        amount: '200bit',
        message: 'some message',
      };
      client.sendTxProposal(args, function(err) {
        var callArgs = request.getCall(0).args[0].body;
        callArgs.toAddress.should.equal(args.toAddress);
        callArgs.amount.should.equal(20000);
        callArgs.message.should.not.equal(args.message);
        var decryptedMsg = WalletUtils.decryptMessage(callArgs.message, TestData.storage.complete11.sharedEncryptingKey);
        decryptedMsg.should.equal(args.message);
        done();
      });
    });
  });

  describe('#signTxProposal ', function() {
    it.skip('should sign tx proposal', function(done) {});

    it('should detect fake tx proposal signature', function(done) {
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.complete11));
      var txp = {
        creatorId: '56cb00afd85f4f37fa900ac4e367676f2eb6189a773633eb9f119eb21a22ba44',
        toAddress: '2N3fA6wDtnebzywPkGuNK9KkFaEzgbPRRTq',
        amount: 100000,
        message: 'some message',
        proposalSignature: 'dummy',
        changeAddress: {
          address: '2N3fA6wDtnebzywPkGuNK9KkFaEzgbPRRTq',
          path: 'm/2147483647/0/7',
          publicKeys: ['03f6a5fe8db51bfbaf26ece22a3e3bc242891a47d3048fc70bc0e8c03a071ad76f']
        },
      };
      client.signTxProposal(txp, function(err) {
        err.code.should.equal('SERVERCOMPROMISED');
        err.message.should.contain('fake transaction proposal');
        done();
      });
    });

    it('should detect fake tx proposal change address', function(done) {
      var txp = {
        toAddress: '2N3fA6wDtnebzywPkGuNK9KkFaEzgbPRRTq',
        amount: 100000,
        message: 'some message',
        proposalSignature: '3045022100e2d9ef7ed592217ab2256fdcf9627075f35ecdf431dde8c9a9c9422b7b1fb00f02202bc8ce066db4401bdbafb2492c3138debbc69c4c01db50d8c22a227e744c8906',
        changeAddress: {
          address: '2N3fA6wDtnebzywPkGuNK9KkFaEzgbPRRTq',
          path: 'm/2147483647/0/8',
          publicKeys: ['03f6a5fe8db51bfbaf26ece22a3e3bc242891a47d3048fc70bc0e8c03a071ad76f']
        },
      };
      client.signTxProposal(txp, function(err) {
        err.code.should.equal('SERVERCOMPROMISED');
        err.message.should.contain('fake transaction proposal');
        done();
      });
    });
  });
 */
});
