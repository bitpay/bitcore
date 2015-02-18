'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Client = require('../../lib/client');
var API = Client.API;
var Bitcore = require('bitcore');
var TestData = require('./clienttestdata');
var WalletUtils = require('../../lib/walletutils');

describe('client API ', function() {
  var client;

  beforeEach(function() {
    var fsmock = {};;
    fsmock.readFile = sinon.mock().yields(null, JSON.stringify(TestData.storage.wallet11));
    fsmock.writeFile = sinon.mock().yields();
    var storage = new Client.FileStorage({
      filename: 'dummy',
      fs: fsmock,
    });
    client = new Client({
      storage: storage
    });
  });

  describe('#_tryToComplete ', function() {
    it('should complete a wallet ', function(done) {
      var request = sinon.stub();

      // Wallet request
      request.onCall(0).yields(null, {
        statusCode: 200,
      }, TestData.serverResponse.completeWallet);
      request.onCall(1).yields(null, {
        statusCode: 200,
      }, "pepe");

      client.request = request;
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.incompleteWallet22));
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
      client.storage.fs.readFile = sinon.stub().yields(null, JSON.stringify(TestData.storage.complete22));
      var request = sinon.mock().yields(null, {
        statusCode: 200
      }, TestData.serverResponse.pendingTxs);
      client.request = request;
 
      client.getTxProposals({}, function(err, x) {
        should.not.exist(err);
        x.length.should.equal(1);
        x[0].id.should.equal(TestData.serverResponse.pendingTxs[0].id);
        x[0].message.should.equal('test');
        done();
      });
    });
  });

  describe('#recreate', function() {
    it.skip('Should recreate a wallet acording stored data', function(done) {});
  });

  describe('#sendTxProposal ', function() {
    it('should send tx proposal with encrypted message', function(done) {
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
        var decryptedMsg = WalletUtils.decryptMessage(callArgs.message, '42798f82c4ed9ace4d66335165071edf180e70bc0fc08dacb3e35185a2141d5b');
        decryptedMsg.should.equal(args.message);
        done();
      });
    });
  });

  describe('#signTxProposal ', function() {
    it.skip('should sign tx proposal', function(done) {});

    it('should detect fake tx proposal signature', function(done) {
      var txp = {
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
