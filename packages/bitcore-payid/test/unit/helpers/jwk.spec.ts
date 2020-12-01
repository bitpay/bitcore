import Bitcore from 'bitcore-lib';
import { expect, should } from 'chai';
import { JWK_INVALID_KEY_TYPE } from '../../../src/errors';
import { BaseJWK } from '../../../src/index.d';
import JsonWebKey from '../../../src/lib/helpers/keys/jwk';
import * as utils from '../../../src/lib/utils';
import * as TestKeys from '../../keys';
import * as TestSignatures from '../../signatures';

should();

describe('JsonWebKey', () => {
  describe('constructor', () => {
    it('should create JWK from private input', () => {
      const jwk = new JsonWebKey({ kty: 'EC' }, 'private');
      jwk.kty.should.equal('EC');
      jwk.private.should.be.true;
      jwk.public.should.be.false;
    });
    it('should create JWK from public input', () => {
      const jwk = new JsonWebKey({ kty: 'RSA' }, 'public');
      jwk.kty.should.equal('RSA');
      jwk.private.should.be.false;
      jwk.public.should.be.true;
    });
    it('should fail to create JWK with invalid key type', () => {
      try {
        new JsonWebKey({ o: 'test' } as any, 'private');
      } catch (err) {
        err.message.should.equal(JWK_INVALID_KEY_TYPE);
      }
    });
    it('should create private JWK with public and private members', () => {
      const ec = {
        kty: 'EC',
        d: 'd_val',
        x: 'x_val',
        y: 'y_val',
        a: 'a_val',
        crv: 'myCurve'
      };
      const jwk = new JsonWebKey(ec as any, 'private');
      jwk.kty.should.equal('EC');
      jwk.use.should.equal('sig');
      jwk.crv.should.equal('myCurve');
      jwk['d'].should.equal('d_val');
      jwk['x'].should.equal('x_val');
      jwk['y'].should.equal('y_val');
      expect(jwk['a']).to.be.undefined; // Non-expected member is excluded
    });
    it('should create JWK with null expected fields', () => {
      const ec = {
        kty: 'EC',
        d: 'd_val',
        x: 'x_val'
      };
      const jwk = new JsonWebKey(ec as any, 'private');
      jwk.kty.should.equal('EC');
      jwk.use.should.equal('sig');
      expect(jwk.crv).to.be.null;
      jwk['d'].should.equal('d_val');
      jwk['x'].should.equal('x_val');
      expect(jwk['y']).to.be.null;
    });
    it('should create public JWK with only public members', () => {
      const okp: BaseJWK.EdDSAPrivate = {
        kty: 'OKP',
        d: 'private_val',
        x: 'public_val'
      };
      const jwk = new JsonWebKey(okp, 'public');
      jwk.kty.should.equal('OKP');
      expect(jwk['d']).to.be.undefined; // Exclude private member
      jwk['x'].should.equal('public_val');
    });
  });

  describe('toPublic', () => {
    let jwkRSA: JsonWebKey;
    let jwkEC: JsonWebKey;
    let jwkOKP: JsonWebKey;
    before(() => {
      const rsa: BaseJWK.RSAPrivate = {
        kty: 'RSA',
        n: 'n_val',
        e: 'e_val',
        d: 'd_val',
        p: 'p_val',
        q: 'q_val',
        dp: 'dp_val',
        dq: 'dq_val',
        qi: 'qi_val'
      };
      jwkRSA = new JsonWebKey(rsa, 'private');
      jwkRSA.private.should.be.true;
      jwkRSA.public.should.be.false;
      jwkRSA['n'].should.equal('n_val');
      jwkRSA['e'].should.equal('e_val');
      jwkRSA['d'].should.equal('d_val');
      jwkRSA['p'].should.equal('p_val');
      jwkRSA['q'].should.equal('q_val');
      jwkRSA['dp'].should.equal('dp_val');
      jwkRSA['dq'].should.equal('dq_val');
      jwkRSA['qi'].should.equal('qi_val');

      const ec: BaseJWK.ECPrivate = {
        kty: 'EC',
        d: 'd_val',
        x: 'x_val',
        y: 'y_val'
      };
      jwkEC = new JsonWebKey(ec, 'private');
      jwkEC.private.should.be.true;
      jwkEC.public.should.be.false;
      jwkEC['d'].should.equal('d_val');
      jwkEC['x'].should.equal('x_val');
      jwkEC['y'].should.equal('y_val');

      const okp: BaseJWK.EdDSAPrivate = {
        kty: 'OKP',
        d: 'd_val',
        x: 'x_val'
      };
      jwkOKP = new JsonWebKey(okp, 'private');
      jwkOKP.private.should.be.true;
      jwkOKP.public.should.be.false;
      jwkOKP['d'].should.equal('d_val');
      jwkOKP['x'].should.equal('x_val');
    });
    it('should return public JWK from private RSA', () => {
      const pubJWK = jwkRSA.toPublic();
      pubJWK.kty.should.equal('RSA');
      pubJWK.private.should.be.false;
      pubJWK.public.should.be.true;
      pubJWK['n'].should.equal('n_val');
      pubJWK['e'].should.equal('e_val');
      expect(pubJWK['d']).to.be.undefined;
      expect(pubJWK['p']).to.be.undefined;
      expect(pubJWK['q']).to.be.undefined;
      expect(pubJWK['dp']).to.be.undefined;
      expect(pubJWK['dq']).to.be.undefined;
      expect(pubJWK['qi']).to.be.undefined;
    });
    it('should return public JWK from private EC', () => {
      const pubJWK = jwkEC.toPublic();
      pubJWK.kty.should.equal('EC');
      pubJWK.private.should.be.false;
      pubJWK.public.should.be.true;
      pubJWK['x'].should.equal('x_val');
      pubJWK['y'].should.equal('y_val');
      expect(pubJWK['d']).to.be.undefined;
    });
    it('should return public JWK ', () => {
      const pubJWK = jwkOKP.toPublic();
      pubJWK.kty.should.equal('OKP');
      pubJWK.private.should.be.false;
      pubJWK.public.should.be.true;
      pubJWK['x'].should.equal('x_val');
      expect(pubJWK['d']).to.be.undefined;
    });
    it('public JWK should return itself', () => {
      const ec: BaseJWK.ECPublic = { kty: 'EC', x: 'x_val', y: 'y_val' };
      const jwk = new JsonWebKey(ec, 'public');
      const pubJWK = jwk.toPublic();
      pubJWK.should.equal(jwk);
    });
  });

  describe('toJSON', () => {
    let privJWK: JsonWebKey;
    let pubJWK: JsonWebKey;
    before(() => {
      const ec: BaseJWK.ECPrivate = {
        kty: 'EC',
        crv: 'secp256k1',
        d: 'd_val',
        x: 'x_val',
        y: 'y_val'
      };
      privJWK = new JsonWebKey(ec, 'private');
      privJWK.private.should.be.true;
      privJWK.public.should.be.false;
      privJWK['d'].should.equal('d_val');
      privJWK['x'].should.equal('x_val');
      privJWK['y'].should.equal('y_val');

      pubJWK = privJWK.toPublic();
    });
    it('should return a slick JSON object of private JWK', () => {
      const json = privJWK.toJSON();
      (privJWK instanceof JsonWebKey).should.be.true;
      (json instanceof JsonWebKey).should.be.false;
      json['kty'].should.equal('EC');
      json['crv'].should.equal('secp256k1');
      json['d'].should.equal('d_val');
      json['x'].should.equal('x_val');
      json['y'].should.equal('y_val');
    });
    it('should return a slick JSON object of public JWK', () => {
      const json = pubJWK.toJSON();
      (pubJWK instanceof JsonWebKey).should.be.true;
      (json instanceof JsonWebKey).should.be.false;
      json['kty'].should.equal('EC');
      json['crv'].should.equal('secp256k1');
      expect(json['d']).to.be.undefined;
      json['x'].should.equal('x_val');
      json['y'].should.equal('y_val');
    });
  });

  describe('getDefaultSigningAlgorithm', () => {
    let jwkRSA: JsonWebKey;
    let jwkEC: JsonWebKey;
    let jwkOKP: JsonWebKey;
    before(() => {
      jwkRSA = new JsonWebKey({ kty: 'RSA' }, 'public');
      jwkEC = new JsonWebKey({ kty: 'EC' }, 'private'); // Private for variance. Doesn't matter.
      jwkOKP = new JsonWebKey({ kty: 'OKP' }, 'public');
    });
    it('should return RS512 for RSA keys', () => {
      const res = jwkRSA.getDefaultSigningAlgorithm();
      res.should.equal('RS512');
    });
    it('should return ES256K for EC keys', () => {
      const res = jwkEC.getDefaultSigningAlgorithm();
      res.should.equal('ES256K');
    });
    it('should return EdDSA for OKP keys', () => {
      // At this time, the only OKP handled in this lib is EdDSA Ed25519 curve keys.
      const res = jwkOKP.getDefaultSigningAlgorithm();
      res.should.equal('EdDSA');
    });
  });

  describe('getThumbprint', () => {
    let rsaBase: BaseJWK.RSAPublic;
    let ecBase: BaseJWK.ECPrivate;
    let okpBase: BaseJWK.EdDSAPublic;
    before(() => {
      rsaBase = {
        kty: 'RSA',
        e: 'e_val',
        n: 'n_val'
      };
      ecBase = {
        kty: 'EC',
        crv: 'secp256k1',
        x: 'x_val',
        y: 'y_val',
        d: 'd_val'
      };
      okpBase = {
        kty: 'OKP',
        crv: 'Ed25519',
        x: 'x_val'
      };
    });
    const hash = require('hash.js');
    it('should return RSA thumbprint', () => {
      const jwk = new JsonWebKey(rsaBase, 'public');
      const hex = jwk.getThumbprint();
      hex.should.equal('bb23ccfe4222e1ef08984cae4a936eda3ca7b912e25821783aae50a6a7765270');
    });
    it('should return EC thumbprint', () => {
      const jwk = new JsonWebKey(ecBase, 'public');
      const hex = jwk.getThumbprint();
      hex.should.equal('57b776247e0fd8395423db10852e7db26aac5153459a8601f07e38d21a8e6d1f');
    });
    it('should return EdDSA thumbprint', () => {
      const jwk = new JsonWebKey(okpBase, 'public');
      const hex = jwk.getThumbprint();
      hex.should.equal('ec1ea5a6293e1501c3391a75d002f20ae16620dec21900686a26712873a8c9a0');
    });
    it('should return URL base64 thumbprint', () => {
      const jwk = new JsonWebKey(rsaBase, 'public');
      const hex = jwk.getThumbprint('base64');
      hex.should.equal('uyPM_kIi4e8ImEyuSpNu2jynuRLiWCF4Oq5Qpqd2UnA');
    });
    if (!utils.inBrowser()) { // Compare to other JWK lib thumbprints
      const { toKey } = require('@payid-org/utils');
      let bitcoreHdJWK;
      let bitcoreJWK;
      let ecJWK;
      let eddsaJWK;
      let rsaJWK;
      before(() => {
        const bitcoreHD = Bitcore.HDPrivateKey.fromString(TestKeys.BitcoreHD);
        const bitcore = Bitcore.PrivateKey.fromString(TestKeys.Bitcore);
        bitcoreHdJWK = toKey({
          kty: 'EC',
          crv: 'secp256k1',
          x: bitcoreHD.publicKey.point.x.toBuffer().toString('base64'),
          y: bitcoreHD.publicKey.point.y.toBuffer().toString('base64')
        });
        bitcoreJWK = toKey({
          kty: 'EC',
          crv: 'secp256k1',
          x: bitcore.publicKey.point.x.toBuffer().toString('base64'),
          y: bitcore.publicKey.point.y.toBuffer().toString('base64')
        });
        ecJWK = toKey(TestKeys.EC.privateKey);
        eddsaJWK = toKey(TestKeys.ED25519.privateKey);
        rsaJWK = toKey(TestKeys.RSA.privateKey);
      });
      it('should be equal for BitcoreHD key', () => {
        const jwk = new JsonWebKey(bitcoreHdJWK, bitcoreHdJWK.type);
        const hex = jwk.getThumbprint('base64');
        hex.should.equal(bitcoreHdJWK.thumbprint);
      });
      it('should be equal for Bitcore key', () => {
        const jwk = new JsonWebKey(bitcoreJWK, bitcoreJWK.type);
        const hex = jwk.getThumbprint('base64');
        hex.should.equal(bitcoreJWK.thumbprint);
      });
      it('should be equal for EC key', () => {
        const jwk = new JsonWebKey(ecJWK, ecJWK.type);
        const hex = jwk.getThumbprint('base64');
        hex.should.equal(ecJWK.thumbprint);
      });
      it('should be equal for EdDSA key', () => {
        const jwk = new JsonWebKey(eddsaJWK, eddsaJWK.type);
        const hex = jwk.getThumbprint('base64');
        hex.should.equal(eddsaJWK.thumbprint);
      });
      it('should be equal for RSA key', () => {
        const jwk = new JsonWebKey(rsaJWK, rsaJWK.type);
        const hex = jwk.getThumbprint('base64');
        hex.should.equal(rsaJWK.thumbprint);
      });
    }

  });
});
