'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Client = require('../../lib/client');
var API = Client.API;
var Bitcore = require('bitcore');

var wallet11 = {
  "m": 1,
  "n": 1,
  "walletPrivKey": "{\"bn\":\"6b862ffbfc90a37a2fedbbcfea91c6a4e49f49b6aaa322b6e16c46bfdbe71a38\",\"compressed\":true,\"network\":\"livenet\"}",
  "network": "testnet",
  "xPrivKey": "tprv8ZgxMBicQKsPeisyNJteQXZnb7CnhYc4TVAyxxicXuxMjK1rmaqVq1xnXtbSTPxUKKL9h5xJhUvw1AKfDD3i98A82eJWSYRWYjmPksewFKR",
  "copayerId": "a84daa08-17b5-45ad-84cd-e275f3b07123",
  "signingPrivKey": "42798f82c4ed9ace4d66335165071edf180e70bc0fc08dacb3e35185a2141d5b",
  "publicKeyRing": ["tpubD6NzVbkrYhZ4YBumFxZEowDuA8iirsny2nmmFUkuxBkkZoGdPyf61Waei3tDYvVa1yqW82Xhmmd6oiibeDyM1MS3zTiky7Yg75UEV9oQhFJ"]
};



describe('client API', function() {

  var client;

  beforeEach(function() {

    var fsmock = {};;
    fsmock.readFileSync = sinon.mock().returns(JSON.stringify(wallet11));
    fsmock.writeFileSync = sinon.mock();
    var storage = new Client.FileStorage({
      filename: 'dummy',
      fs: fsmock,
    });
    client = new Client({
      storage: storage,
    });
  });

  describe('createAddress', function() {
    it('should check address', function(done) {

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
    })
    it('should detect fake addresses', function(done) {
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
    })
  });
});
