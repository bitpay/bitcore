import { expect, should } from 'chai';
import { JWK_INVALID_KEY_TYPE } from '../../../src/errors';
import { BaseJWK } from '../../../src/index.d';
import JsonWebKey from '../../../src/lib/helpers/keys/jwk';

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
    it('should return HS256 for OKP keys', () => {
      const res = jwkOKP.getDefaultSigningAlgorithm();
      res.should.equal('HS256');
    });
  });
});
