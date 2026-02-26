'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var { Wallet } = require('../../ts_build/lib/model/wallet');


describe('Wallet', function() {

  describe('#create', function() {
    it('will throw with an invalid string argument for "m" or "n"', function() {
      (function() {
        Wallet.create({
          m: '2',
          n: 2
        });
      }).should.throw('Variable should be a Number.');
      (function() {
        Wallet.create({
          m: 2,
          n: '2'
        });
      }).should.throw('Variable should be a Number.');
    });
  });

  describe('#fromObj', function() {
    it('will throw with an invalid string argument for "m" or "n"', function() {
      (function() {
        Wallet.fromObj({
          m: '2',
          n: 2
        });
      }).should.throw('Variable should be a Number.');
      (function() {
        Wallet.fromObj({
          m: 2,
          n: '2'
        });
      }).should.throw('Variable should be a Number.');
    });
    it('read a wallet', function() {
      var w = Wallet.fromObj(testWallet);
      w.isComplete().should.be.true;
    });
  });
  describe('#createAddress', function() {
    it('create an address', function() {
      var w = Wallet.fromObj(testWallet);
      var a = w.createAddress(false);
      a.address.should.equal('3HPJYvQZuTVY6pPBz17fFVz2YPoMBVT34i');
      a.path.should.equal('m/2147483647/0/0');
      a.createdOn.should.be.above(1);
    });
  });

  describe('#createBEKeys', function() {
    it('create BE keys based on xPubkeys', function() {
      var w = Wallet.fromObj(testWallet);
      var a = w.updateBEKeys();
      w.beAuthPrivateKey2.should.be.equal('7272c172cf48c6306153aa9d7eaa5397bbf71b076a41deaf43e4a194fc76212c');
    });

    it('key should change depending on the network', function() {
      var t = _.clone(testWallet);
      t.isTestnet = true;
      var w = Wallet.fromObj(t);
      var a = w.updateBEKeys();
      w.beAuthPrivateKey2.should.be.equal('de469a81d1df982765044c65ab3cedae0edebaca6a17e29e9addbe71b0cec6e5');
    });

    it('key should depend on xpubs', function() {
      var t = _.clone(testWallet);

      t.copayers[0].xPubKey = 'xpub661MyMwAqRbcF3Q3BRNic47PusMzQbG3TDmxKJJT2k7vGLg7STrmdfYporfSgmCefUkLDnaQrMrVZf9knKBR9bYkwQxCaEpK611mZV8VNkN';
      var w = Wallet.fromObj(t);
      var a = w.updateBEKeys();
      w.beAuthPrivateKey2.should.be.equal('16c34ae1b6b6176fb7972204d7aed37494a65878d58928ea8a1331b9995aa7a3');
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
