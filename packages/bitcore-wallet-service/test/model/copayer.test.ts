'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import { IWallet, Wallet } from '../../src/lib/model/wallet';
import { Copayer } from '../../src/lib/model/copayer';

const should = chai.should();

describe('Copayer', function() {
  // SECURITY: copayer identity must be derived from exactly one effective credential,
  // in a fixed precedence (xPubKey, then hardwareSourcePublicKey, then
  // clientDerivedPublicKey), so that IDs stay stable for every xpub-bearing caller and
  // never hash `undefined` (which throws for the default coin and collides into one
  // constant hash per chain for every other coin).
  describe('#create identity key selection', function() {
    // SECURITY: `chain` is passed explicitly below because the service layer
    // (joinWallet / _addCopayerToWallet) always supplies a resolved chain (backfilled
    // from coin via Wallet.fromObj); these model tests encode the identity-key contract
    // under that precondition rather than pinning a coin-only input shape.
    const baseOpts = {
      coin: 'btc',
      chain: 'btc',
      name: 'me',
      requestPubKey: '03814ac7decf64321a3c6967bfb746112fdb5b583531cd512cc3787eaf578947dc',
      signature: 'dummy-signature',
    };

    it('should derive the ID from xPubKey alone', function() {
      const xPubKey = 'xpub-abc';
      const c = Copayer.create({ ...baseOpts, xPubKey });
      c.id.should.equal(Copayer.xPubToCopayerId('btc', xPubKey));
    });

    it('should prefer xPubKey when hardwareSourcePublicKey is also present', function() {
      const xPubKey = 'xpub-abc';
      const hardwareSourcePublicKey = 'hw-key';

      const c = Copayer.create({ ...baseOpts, xPubKey, hardwareSourcePublicKey });
      c.id.should.equal(Copayer.xPubToCopayerId('btc', xPubKey));
    });

    it('should prefer xPubKey when both alternate credentials are also present', function() {
      const xPubKey = 'xpub-abc';
      const hardwareSourcePublicKey = 'hw-key';
      const clientDerivedPublicKey = 'cdk-key';

      const c = Copayer.create({
        ...baseOpts,
        xPubKey,
        hardwareSourcePublicKey,
        clientDerivedPublicKey,
      });
      c.id.should.equal(Copayer.xPubToCopayerId('btc', xPubKey));
    });

    it('should fall back to hardwareSourcePublicKey when xPubKey is absent', function() {
      const hardwareSourcePublicKey = 'hw-key';
      const c = Copayer.create({ ...baseOpts, hardwareSourcePublicKey });
      c.id.should.equal(Copayer.xPubToCopayerId('btc', hardwareSourcePublicKey));
    });

    it('should fall back to clientDerivedPublicKey when xPubKey and hardwareSourcePublicKey are absent', function() {
      const clientDerivedPublicKey = 'cdk-key';
      const c = Copayer.create({ ...baseOpts, clientDerivedPublicKey: clientDerivedPublicKey });
      c.id.should.equal(Copayer.xPubToCopayerId('btc', clientDerivedPublicKey));
    });

    it('should deterministically prefer hardwareSourcePublicKey over clientDerivedPublicKey when xPubKey is absent', function() {
      const hardwareSourcePublicKey = 'hw-key';
      const clientDerivedPublicKey = 'cdk-key';
      const c = Copayer.create({ ...baseOpts, hardwareSourcePublicKey, clientDerivedPublicKey });
      c.id.should.equal(Copayer.xPubToCopayerId('btc', hardwareSourcePublicKey));
    });

    it('should assign distinct IDs to copayers with different hardwareSourcePublicKey values on btc', function() {
      const hardwareSourcePublicKey_a = 'hw-key-a';
      const hardwareSourcePublicKey_b = 'hw-key-b';

      const a = Copayer.create({ ...baseOpts, hardwareSourcePublicKey: hardwareSourcePublicKey_a });
      const b = Copayer.create({ ...baseOpts, hardwareSourcePublicKey: hardwareSourcePublicKey_b });
      should.exist(a.id);
      a.id.should.equal(Copayer.xPubToCopayerId('btc', hardwareSourcePublicKey_a));
      b.id.should.equal(Copayer.xPubToCopayerId('btc', hardwareSourcePublicKey_b));
      a.id.should.not.equal(b.id);
    });

    it('should assign distinct IDs to copayers with different hardwareSourcePublicKey values on a non-default chain', function() {
      const hardwareSourcePublicKey_a = 'hw-key-a';
      const hardwareSourcePublicKey_b = 'hw-key-b';

      const opts = { ...baseOpts, coin: 'bch', chain: 'bch' };
      const a = Copayer.create({ ...opts, hardwareSourcePublicKey: hardwareSourcePublicKey_a });
      const b = Copayer.create({ ...opts, hardwareSourcePublicKey: hardwareSourcePublicKey_b });
      a.id.should.equal(Copayer.xPubToCopayerId('bch', hardwareSourcePublicKey_a));
      b.id.should.equal(Copayer.xPubToCopayerId('bch', hardwareSourcePublicKey_b));
      a.id.should.not.equal(b.id);
    });

    it('should persist the supplied credential fields and leave unsupplied ones absent', function() {
      const xPubKey = 'xpub-abc';
      const hardwareSourcePublicKey = 'hw-key';

      const c = Copayer.create({ ...baseOpts, xPubKey, hardwareSourcePublicKey });
      c.xPubKey.should.equal(xPubKey);
      c.hardwareSourcePublicKey.should.equal(hardwareSourcePublicKey);
      should.not.exist(c.clientDerivedPublicKey);
    });
  });

  describe('#fromObj', function() {
    it('read a copayer', function() {
      const c = Copayer.fromObj(testWallet.copayers[0]);
      c.name.should.equal('copayer 1');
    });
  });
  describe('#createAddress', function() {
    it('should create an address', function() {
      const w = Wallet.fromObj(testWallet);
      const c = Copayer.fromObj(testWallet.copayers[2]);
      should.exist(c.requestPubKeys);
      c.requestPubKeys.length.should.equal(1);
      const a1 = c.createAddress(w, true);
      a1.address.should.equal('3AXmDe2FkWY9g5LpRaTs1U7pXKtkNm3NBf');
      a1.path.should.equal('m/2/1/0');
      a1.createdOn.should.be.above(1);
      const a2 = c.createAddress(w, true);
      a2.path.should.equal('m/2/1/1');
    });
  });
});


const testWallet: IWallet = {
  addressManager: {
    version: 1,
    receiveAddressIndex: 0,
    changeAddressIndex: 0,
    copayerIndex: 2147483647,
    derivationStrategy: 'BIP45',
    skippedPaths: []
  },
  createdOn: 1422904188,
  id: '123',
  name: '123 wallet',
  coin: 'btc',
  chain: 'btc',
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
    createdOn: 1422904189,
    id: '1',
    name: 'copayer 1',
    xPubKey: 'xpub661MyMwAqRbcFLRkhYzK8eQdoywNHJVsJCMQNDoMks5bZymuMcyDgYfnVQYq2Q9npnVmdTAthYGc3N3uxm5sEdnTpSqBc4YYTAhNnoSxCm9',
    requestPubKey: '03814ac7decf64321a3c6967bfb746112fdb5b583531cd512cc3787eaf578947dc',
    signature: '30440220192ae7345d980f45f908bd63ccad60ce04270d07b91f1a9d92424a07a38af85202201591f0f71dd4e79d9206d2306862e6b8375e13a62c193953d768e884b6fb5a46',
    version: 1,
    requestPubKeys: [],
    coin: 'btc',
    walletId: '123',
    customData: null,
    addressManager: {
      version: 1,
      receiveAddressIndex: 0,
      changeAddressIndex: 0,
      copayerIndex: 0,
      derivationStrategy: 'BIP45',
      skippedPaths: []
    }
  }, {
    createdOn: 1422904189,
    id: '2',
    name: 'copayer 2',
    xPubKey: 'xpub661MyMwAqRbcEzHgVwwxoXksq21rRNsJsn7AFy4VD4PzsEmjjWwsyEiTjsdQviXbqZ5yHVWJR8zFUDgUKkq4R97su3UyNo36Z8hSaCPrv6o',
    requestPubKey: '03fc086d2bd8b6507b1909b24c198c946e68775d745492ea4ca70adfce7be92a60',
    signature: '30440220134d13139323ba16ff26471c415035679ee18b2281bf85550ccdf6a370899153022066ef56ff97091b9be7dede8e40f50a3a8aad8205f2e3d8e194f39c20f3d15c62',
    version: 1,
    requestPubKeys: [],
    coin: 'btc',
    walletId: '123',
    customData: null,
    addressManager: {
      version: 1,
      receiveAddressIndex: 0,
      changeAddressIndex: 0,
      copayerIndex: 1,
      derivationStrategy: 'BIP45',
      skippedPaths: []
    }
  }, {
    createdOn: 1422904189,
    id: '3',
    name: 'copayer 3',
    xPubKey: 'xpub661MyMwAqRbcFXUfkjfSaRwxJbAPpzNUvTiNFjgZwDJ8sZuhyodkP24L4LvsrgThYAAwKkVVSSmL7Ts7o9EHEHPB3EE89roAra7njoSeiMd',
    requestPubKey: '0246c30040eda1e36e02629ae8cd2a845fcfa947239c4c703f7ea7550d39cfb43a',
    signature: '304402207a4e7067d823a98fa634f9c9d991b8c42cd0f82da24f686992acf96cdeb5e387022021ceba729bf763fc8e4277f6851fc2b856a82a22b35f20d2eeb23d99c5f5a41c',
    version: 1,
    requestPubKeys: [],
    coin: 'btc',
    walletId: '123',
    customData: null,
    addressManager: {
      version: 1,
      receiveAddressIndex: 0,
      changeAddressIndex: 0,
      copayerIndex: 2,
      derivationStrategy: 'BIP45',
      skippedPaths: []
    }
  }],
  addressType: 'P2SH',
  singleAddress: false,
  addressIndex: 0,
  derivationStrategy: 'BIP45',
  beRegistered: false,
  version: '1.0.0',
  pubKey: '{"x":"6092daeed8ecb2212869395770e956ffc9bf453f803e700f64ffa70c97a00d80","y":"ba5e7082351115af6f8a9eb218979c7ed1f8aa94214f627ae624ab00048b8650","compressed":true}',
  isTestnet: false
};
