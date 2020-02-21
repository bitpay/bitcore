'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var { Wallet } = require('../../ts_build/lib/model/wallet');
var { Copayer } = require('../../ts_build/lib/model/copayer');


describe('Copayer', function() {

  describe('#fromObj', function() {
    it('read a copayer', function() {
      var c = Copayer.fromObj(testWallet.copayers[0]);
      c.name.should.equal('copayer 1');
    });
  });
  describe('#createAddress', function() {
    it('should create an address', function() {
      var w = Wallet.fromObj(testWallet);
      var c = Copayer.fromObj(testWallet.copayers[2]);
      should.exist(c.requestPubKeys);
      c.requestPubKeys.length.should.equal(1);
      var a1 = c.createAddress(w, true);
      a1.address.should.equal('3AXmDe2FkWY9g5LpRaTs1U7pXKtkNm3NBf');
      a1.path.should.equal('m/2/1/0');
      a1.createdOn.should.be.above(1);
      var a2 = c.createAddress(w, true);
      a2.path.should.equal('m/2/1/1');
    });
  });
});


var testWallet = {
  addressManager: {
    receiveAddressIndex: 0,
    changeAddressIndex: 0,
    copayerIndex: 2147483647,
  },
  createdOn: 1422904188,
  id: '123',
  name: '123 wallet',
  network: 'livenet',
  m: 2,
  n: 3,
  status: 'complete',
  publicKeyRing: [{
    xPubKey: 'xpub661MyMwAqRbcFLRkhYzK8eQdoywNHJVsJCMQNDoMks5bZymuMcyDgYfnVQYq2Q9npnVmdTAthYGc3N3uxm5sEdnTpSqBc4YYTAhNnoSxCm9',
    requestPubKey: '03814ac7decf64321a3c6967bfb746112fdb5b583531cd512cc3787eaf578947dc'
  }, {
    xPubKey: 'xpub661MyMwAqRbcEzHgVwwxoXksq21rRNsJsn7AFy4VD4PzsEmjjWwsyEiTjsdQviXbqZ5yHVWJR8zFUDgUKkq4R97su3UyNo36Z8hSaCPrv6o',
    requestPubKey: '03fc086d2bd8b6507b1909b24c198c946e68775d745492ea4ca70adfce7be92a60'
  }, {
    xPubKey: 'xpub661MyMwAqRbcFXUfkjfSaRwxJbAPpzNUvTiNFjgZwDJ8sZuhyodkP24L4LvsrgThYAAwKkVVSSmL7Ts7o9EHEHPB3EE89roAra7njoSeiMd',
    requestPubKey: '0246c30040eda1e36e02629ae8cd2a845fcfa947239c4c703f7ea7550d39cfb43a'
  }, ],
  copayers: [{
    addressManager: {
      receiveAddressIndex: 0,
      changeAddressIndex: 0,
      copayerIndex: 0,
    },
    createdOn: 1422904189,
    id: '1',
    name: 'copayer 1',
    xPubKey: 'xpub661MyMwAqRbcFLRkhYzK8eQdoywNHJVsJCMQNDoMks5bZymuMcyDgYfnVQYq2Q9npnVmdTAthYGc3N3uxm5sEdnTpSqBc4YYTAhNnoSxCm9',
    requestPubKey: '03814ac7decf64321a3c6967bfb746112fdb5b583531cd512cc3787eaf578947dc',
    signature: '30440220192ae7345d980f45f908bd63ccad60ce04270d07b91f1a9d92424a07a38af85202201591f0f71dd4e79d9206d2306862e6b8375e13a62c193953d768e884b6fb5a46',
    version: '1.0.0',
  }, {
    addressManager: {
      receiveAddressIndex: 0,
      changeAddressIndex: 0,
      copayerIndex: 1,
    },
    createdOn: 1422904189,
    id: '2',
    name: 'copayer 2',
    xPubKey: 'xpub661MyMwAqRbcEzHgVwwxoXksq21rRNsJsn7AFy4VD4PzsEmjjWwsyEiTjsdQviXbqZ5yHVWJR8zFUDgUKkq4R97su3UyNo36Z8hSaCPrv6o',
    requestPubKey: '03fc086d2bd8b6507b1909b24c198c946e68775d745492ea4ca70adfce7be92a60',
    signature: '30440220134d13139323ba16ff26471c415035679ee18b2281bf85550ccdf6a370899153022066ef56ff97091b9be7dede8e40f50a3a8aad8205f2e3d8e194f39c20f3d15c62',
    version: '1.0.0',
  }, {
    addressManager: {
      receiveAddressIndex: 0,
      changeAddressIndex: 0,
      copayerIndex: 2,
    },
    createdOn: 1422904189,
    id: '3',
    name: 'copayer 3',
    xPubKey: 'xpub661MyMwAqRbcFXUfkjfSaRwxJbAPpzNUvTiNFjgZwDJ8sZuhyodkP24L4LvsrgThYAAwKkVVSSmL7Ts7o9EHEHPB3EE89roAra7njoSeiMd',
    requestPubKey: '0246c30040eda1e36e02629ae8cd2a845fcfa947239c4c703f7ea7550d39cfb43a',
    signature: '304402207a4e7067d823a98fa634f9c9d991b8c42cd0f82da24f686992acf96cdeb5e387022021ceba729bf763fc8e4277f6851fc2b856a82a22b35f20d2eeb23d99c5f5a41c',
    version: '1.0.0',
  }],
  version: '1.0.0',
  pubKey: '{"x":"6092daeed8ecb2212869395770e956ffc9bf453f803e700f64ffa70c97a00d80","y":"ba5e7082351115af6f8a9eb218979c7ed1f8aa94214f627ae624ab00048b8650","compressed":true}',
  isTestnet: false
};
