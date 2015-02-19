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
  clients[0].createWallet('wallet name', 'creator copayer', m, n, 'testnet',
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
        if (err) return new Error('Could not generate wallet');
        return cb();
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

describe('client API ', function() {
  var clients;

  beforeEach(function() {
    clients = [];
    var db = levelup(memdown, {
      valueEncoding: 'json'
    });
    var storage = new Storage({
      db: db
    });
    var app = ExpressApp.start({
      CopayServer: {
        storage: storage
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
    content = {};
  });

  describe.only('#getBalance', function() {
    it('should check balance in a 1-1 ', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(err) {
        should.not.exist(err);
        clients[0].getBalance(function(err, x) {
          should.not.exist(err);
          done();
        })
      });
    });
    it('should be able to check balance in a 2-3 wallet ', function(done) {
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
  });

  describe('#_tryToComplete ', function() {
    it('should complete a wallet ', function(done) {
      client.storage.fs.readFile =
        sinon.stub().yields(null, JSON.stringify(TestData.storage.incompleteWallet22));


      client.getBalance(function(err, x) {
        should.not.exist(err);
        done();
      });
    });


    it('should handle incomple wallets', function(done) {
      var request = sinon.stub();

      // Wallet request
      request.onCall(0).yields(null, {
        statusCode: 200,
      }, TestData.serverResponse.incompleteWallet);

      client.request = request;
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.incompleteWallet22));
      client.createAddress(function(err, x) {
        err.should.contain('Incomplete');
        done();
      });
    });

    it('should reject wallets with bad signatures', function(done) {
      var request = sinon.stub();
      // Wallet request
      request.onCall(0).yields(null, {
        statusCode: 200,
      }, TestData.serverResponse.corruptWallet22);

      client.request = request;
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.incompleteWallet22));
      client.createAddress(function(err, x) {
        err.should.contain('verified');
        done();
      });
    });

    it('should reject wallets with missing signatures ', function(done) {
      var request = sinon.stub();
      // Wallet request
      request.onCall(0).yields(null, {
        statusCode: 200,
      }, TestData.serverResponse.corruptWallet222);

      client.request = request;
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.incompleteWallet22));
      client.createAddress(function(err, x) {
        err.should.contain('verified');
        done();
      });
    });

    it('should reject wallets missing caller"s pubkey', function(done) {
      var request = sinon.stub();
      // Wallet request
      request.onCall(0).yields(null, {
        statusCode: 200,
      }, TestData.serverResponse.missingMyPubKey);

      client.request = request;
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.incompleteWallet22));
      client.createAddress(function(err, x) {
        err.should.contain('verified');
        done();
      });
    });
  });

  describe('#createAddress ', function() {
    it('should check address ', function(done) {

      var response = {
        createdOn: 1424105995,
        address: '2N3fA6wDtnebzywPkGuNK9KkFaEzgbPRRTq',
        path: 'm/2147483647/0/7',
        publicKeys: ['03f6a5fe8db51bfbaf26ece22a3e3bc242891a47d3048fc70bc0e8c03a071ad76f']
      };
      var request = sinon.mock().yields(null, {
        statusCode: 200
      }, response);
      client.request = request;


      client.createAddress(function(err, x) {
        should.not.exist(err);
        x.address.should.equal('2N3fA6wDtnebzywPkGuNK9KkFaEzgbPRRTq');
        done();
      });
    });

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


  describe('#export & #import 2-2 wallet', function() {
    it('round trip ', function(done) {
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.complete22));
      client.export(function(err, str) {
        should.not.exist(err);

        client.storage.fs.readFile = sinon.stub().yields(null);
        client.import(str, function(err, wallet) {
          should.not.exist(err);
          var wallet = JSON.parse(client.storage.fs.writeFile.getCall(0).args[1]);
          TestData.storage.complete22.should.deep.equal(wallet);

          done();
        });
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

  describe('#recreate', function() {
    it.skip('Should recreate a wallet acording stored data', function(done) {});
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
});
