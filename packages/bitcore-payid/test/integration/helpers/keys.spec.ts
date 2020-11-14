import { expect, should } from 'chai';
import sinon from 'sinon';
import {
  ECPrivateJWK,
  ECPublicJWK,
  EdDSAPrivateJWK,
  EdDSAPublicJWK,
  Isec1,
  RSAPrivateJWK,
  RSAPublicJWK
} from '../../../src/index.d';
import EC from '../../../src/lib/helpers/keys/ec';
import JsonWebKey from '../../../src/lib/helpers/keys/jwk';
import PrivateKey from '../../../src/lib/helpers/keys/private';
import PublicKey from '../../../src/lib/helpers/keys/public';
import { Private as RSAPriv, Public as RSAPub } from '../../../src/lib/helpers/keys/rsa';
import * as TestKeys from '../../keys';

should();

describe('keys', () => {

  describe('ec (SEC1)', () => {
    describe('decode', () => {
      it('should decode an secp256k1 private key in PEM format', () => {
        try {
          const key = TestKeys.EC.private.sec1.PEM;
          const decoded = new EC().decode(key, 'pem');
          (decoded instanceof EC).should.be.true;
          expect(decoded['key']).to.exist;
          decoded['key'].curve.should.equal('secp256k1');
        } catch (err) {
          expect(err.message).to.not.exist;
        }
      });
      it('should decode an secp256k1 private key in DER format', () => {
        try {
          const key = TestKeys.EC.private.sec1.DER;
          const decoded = new EC().decode(key, 'der');
          (decoded instanceof EC).should.be.true;
          expect(decoded['key']).to.exist;
          decoded['key'].curve.should.equal('secp256k1');
        } catch (err) {
          expect(err.message).to.not.exist;
        }
      });
      it('should fail to decode an secp256k1 public key', () => {
        try {
          const key = TestKeys.EC.public.spki.DER;
          const decoded = new EC().decode(key, 'der');
          expect(decoded['key']).to.be.null;
        } catch (err) {
          err.message.should.contain('Failed to match tag');
        }
      });
    });
    describe('toJWK', () => {
      let Instance: EC;
      beforeEach(() => {
        const key = TestKeys.EC.private.sec1.DER;
        Instance = new EC().decode(key, 'der');
      });
      it('should convert decoded key to JWK', () => {
        const jwk = Instance.toJWK();
        expect(jwk).to.exist;
        (jwk instanceof JsonWebKey).should.be.true;
        jwk.kty.should.equal('EC');
        jwk.private.should.be.true;
        jwk.public.should.be.false;
        jwk.crv.should.equal('secp256k1');
        expect(jwk.d).to.exist;
        Buffer.from(jwk.d, 'base64').toString().should.equal(Instance['key'].privateKey.toString());
        expect(jwk.x).to.exist;
        expect(jwk.y).to.exist;
      });
    });
  });

  describe('jwk', () => {

  });

  describe('private (PKCS8)', () => {
    describe('decode', () => {
      describe('EC', () => {
        it('should decode an secp256k1 private key in PEM format', () => {
          try {
            const key = TestKeys.EC.private.pkcs8.PEM;
            const decoded = new PrivateKey().decode(key, 'pem');
            (decoded instanceof PrivateKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('ecEncryption');
            decoded['key'].attributes.curve.should.equal('secp256k1');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should decode an secp256k1 private key in DER format', () => {
          try {
            const key = TestKeys.EC.private.pkcs8.DER;
            const decoded = new PrivateKey().decode(key, 'der');
            (decoded instanceof PrivateKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('ecEncryption');
            decoded['key'].attributes.curve.should.equal('secp256k1');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should fail to decode an secp256k1 public key', () => {
          try {
            const key = TestKeys.EC.public.spki.DER;
            const decoded = new PrivateKey().decode(key, 'der');
            expect(decoded['key']).to.be.null;
          } catch (err) {
            err.message.should.contain('Failed to match tag');
          }
        });
      });
      describe('EdDSA', () => {
        it('should decode an ed25519 private key in PEM format', () => {
          try {
            const key = TestKeys.ED25519.private.pkcs8.PEM;
            const decoded = new PrivateKey().decode(key, 'pem');
            (decoded instanceof PrivateKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('Ed25519');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should decode an ed25519 private key in DER format', () => {
          try {
            const key = TestKeys.ED25519.private.pkcs8.DER;
            const decoded = new PrivateKey().decode(key, 'der');
            (decoded instanceof PrivateKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('Ed25519');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should fail to decode an ed25519 public key', () => {
          try {
            const key = TestKeys.ED25519.public.spki.DER;
            const decoded = new PrivateKey().decode(key, 'der');
            expect(decoded['key']).to.be.null;
          } catch (err) {
            err.message.should.contain('Failed to match tag');
          }
        });
      });
      describe('RSA', () => {
        it('should decode an RSA private key in PEM format', () => {
          try {
            const key = TestKeys.RSA.private.pkcs8.PEM;
            const decoded = new PrivateKey().decode(key, 'pem');
            (decoded instanceof PrivateKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('rsaEncryption');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should decode an RSA private key in DER format', () => {
          try {
            const key = TestKeys.RSA.private.pkcs8.DER;
            const decoded = new PrivateKey().decode(key, 'der');
            (decoded instanceof PrivateKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('rsaEncryption');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should fail to decode an RSA public key', () => {
          try {
            const key = TestKeys.RSA.public.spki.DER;
            const decoded = new PrivateKey().decode(key, 'der');
            expect(decoded['key']).to.be.null;
          } catch (err) {
            err.message.should.contain('Failed to match tag');
          }
        });
      });
    });
    describe('toJWK', () => {
      let Instance: PrivateKey;
      describe('EC', () => {
        beforeEach(() => {
          const key = TestKeys.EC.private.pkcs8.DER;
          Instance = new PrivateKey().decode(key, 'der');
        });
        it('should convert decoded key to JWK', () => {
          const jwk = Instance.toJWK() as ECPrivateJWK;
          expect(jwk).to.exist;
          (jwk instanceof JsonWebKey).should.be.true;
          jwk.kty.should.equal('EC');
          jwk.private.should.be.true;
          jwk.public.should.be.false;
          jwk.crv.should.equal('secp256k1');
          expect(jwk.d).to.exist;
          Buffer.from(jwk.d, 'base64').toString().should.equal((Instance['key'].privateKey as Isec1).privateKey.toString());
          expect(jwk.x).to.exist;
          expect(jwk.y).to.exist;
        });
      });
      describe('EdDSA', () => {
        beforeEach(() => {
          const key = TestKeys.ED25519.private.pkcs8.DER;
          Instance = new PrivateKey().decode(key, 'der');
        });
        it('should convert decoded key to JWK', () => {
          const jwk = Instance.toJWK() as EdDSAPrivateJWK;
          expect(jwk).to.exist;
          (jwk instanceof JsonWebKey).should.be.true;
          jwk.kty.should.equal('OKP');
          jwk.private.should.be.true;
          jwk.public.should.be.false;
          jwk.crv.should.equal('Ed25519');
          expect(jwk.d).to.exist;
          Buffer.from(jwk.d, 'base64').toString().should.equal(Instance['key'].privateKey.toString());
          expect(jwk.x).to.exist;
        });
      });
      describe('RSA', () => {
        beforeEach(() => {
          const key = TestKeys.RSA.private.pkcs8.DER;
          Instance = new PrivateKey().decode(key, 'der');
        });
        it('should convert decoded key to JWK', () => {
          const jwk = Instance.toJWK() as RSAPrivateJWK;
          expect(jwk).to.exist;
          (jwk instanceof JsonWebKey).should.be.true;
          jwk.kty.should.equal('RSA');
          jwk.private.should.be.true;
          jwk.public.should.be.false;
          expect(jwk.crv).to.not.exist;
          expect(jwk.n).to.exist;
          expect(jwk.e).to.exist;
          expect(jwk.d).to.exist;
          expect(jwk.p).to.exist;
          expect(jwk.q).to.exist;
          expect(jwk.dp).to.exist;
          expect(jwk.dq).to.exist;
          expect(jwk.qi).to.exist;
          expect(jwk.length).to.exist;
          jwk.length.should.equal(2048);
        });
      });
    });
  });

  describe('public (SPKI)', () => {
    describe('decode', () => {
      describe('EC', () => {
        it('should decode an secp256k1 public key in PEM format', () => {
          try {
            const key = TestKeys.EC.public.spki.PEM;
            const decoded = new PublicKey().decode(key, 'pem');
            (decoded instanceof PublicKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('ecEncryption');
            decoded['key'].attributes.curve.value.should.equal('secp256k1');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should decode an secp256k1 public key in DER format', () => {
          try {
            const key = TestKeys.EC.public.spki.DER;
            const decoded = new PublicKey().decode(key, 'der');
            (decoded instanceof PublicKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('ecEncryption');
            decoded['key'].attributes.curve.value.should.equal('secp256k1');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should fail to decode an secp256k1 private key', () => {
          try {
            const key = TestKeys.EC.private.pkcs8.DER;
            const decoded = new PublicKey().decode(key, 'der');
            expect(decoded['key']).to.be.null;
          } catch (err) {
            err.message.should.contain('Failed to match tag');
          }
        });
      });
      describe('EdDSA', () => {
        it('should decode an ed25519 public key in PEM format', () => {
          try {
            const key = TestKeys.ED25519.public.spki.PEM;
            const decoded = new PublicKey().decode(key, 'pem');
            (decoded instanceof PublicKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('Ed25519');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should decode an ed25519 public key in DER format', () => {
          try {
            const key = TestKeys.ED25519.public.spki.DER;
            const decoded = new PublicKey().decode(key, 'der');
            (decoded instanceof PublicKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('Ed25519');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should fail to decode an ed25519 private key', () => {
          try {
            const key = TestKeys.ED25519.private.pkcs8.DER;
            const decoded = new PublicKey().decode(key, 'der');
            expect(decoded['key']).to.be.null;
          } catch (err) {
            err.message.should.contain('Failed to match tag');
          }
        });
      });
      describe('RSA', () => {
        it('should decode an RSA public key in PEM format', () => {
          try {
            const key = TestKeys.RSA.public.spki.PEM;
            const decoded = new PublicKey().decode(key, 'pem');
            (decoded instanceof PublicKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('rsaEncryption');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should decode an RSA public key in DER format', () => {
          try {
            const key = TestKeys.RSA.public.spki.DER;
            const decoded = new PublicKey().decode(key, 'der');
            (decoded instanceof PublicKey).should.be.true;
            expect(decoded['key']).to.exist;
            decoded['key'].attributes.type.should.equal('rsaEncryption');
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should fail to decode an RSA private key', () => {
          try {
            const key = TestKeys.RSA.private.pkcs8.DER;
            const decoded = new PublicKey().decode(key, 'der');
            expect(decoded['key']).to.be.null;
          } catch (err) {
            err.message.should.contain('Failed to match tag');
          }
        });
      });
    });
    describe('toJWK', () => {
      let Instance: PublicKey;
      describe('EC', () => {
        beforeEach(() => {
          const key = TestKeys.EC.public.spki.DER;
          Instance = new PublicKey().decode(key, 'der');
        });
        it('should convert decoded key to JWK', () => {
          const jwk = Instance.toJWK() as ECPublicJWK;
          expect(jwk).to.exist;
          (jwk instanceof JsonWebKey).should.be.true;
          jwk.kty.should.equal('EC');
          jwk.private.should.be.false;
          jwk.public.should.be.true;
          jwk.crv.should.equal('secp256k1');
          expect(jwk.x).to.exist;
          expect(jwk.y).to.exist;
        });
      });
      describe('EdDSA', () => {
        beforeEach(() => {
          const key = TestKeys.ED25519.public.spki.DER;
          Instance = new PublicKey().decode(key, 'der');
        });
        it('should convert decoded key to JWK', () => {
          const jwk = Instance.toJWK() as EdDSAPublicJWK;
          expect(jwk).to.exist;
          (jwk instanceof JsonWebKey).should.be.true;
          jwk.kty.should.equal('OKP');
          jwk.private.should.be.false;
          jwk.public.should.be.true;
          jwk.crv.should.equal('Ed25519');
          expect(jwk.x).to.exist;
        });
      });
      describe('RSA', () => {
        beforeEach(() => {
          const key = TestKeys.RSA.public.spki.DER;
          Instance = new PublicKey().decode(key, 'der');
        });
        it('should convert decoded key to JWK', () => {
          const jwk = Instance.toJWK() as RSAPublicJWK;
          expect(jwk).to.exist;
          (jwk instanceof JsonWebKey).should.be.true;
          jwk.kty.should.equal('RSA');
          jwk.private.should.be.false;
          jwk.public.should.be.true;
          expect(jwk.crv).to.not.exist;
          expect(jwk.n).to.exist;
          expect(jwk.e).to.exist;
          expect(jwk['d']).to.not.exist;
          expect(jwk['p']).to.not.exist;
          expect(jwk['q']).to.not.exist;
          expect(jwk['dp']).to.not.exist;
          expect(jwk['dq']).to.not.exist;
          expect(jwk['qi']).to.not.exist;
          expect(jwk.length).to.exist;
          jwk.length.should.equal(2048);
        });
      });
    });
    describe('encode', () => {
      describe('EC', () => {
        let jwkPEM: ECPublicJWK;
        let jwkDER: ECPublicJWK;
        before(() => {
          const pemKey = TestKeys.EC.public.spki.PEM;
          jwkPEM = new PublicKey().decode(pemKey, 'pem').toJWK();

          const derKey = TestKeys.EC.public.spki.DER;
          jwkDER = new PublicKey().decode(derKey, 'der').toJWK();
        });
        it('should encode an original PEM JWK to PEM format', () => {
          const pem = new PublicKey(jwkPEM).encode('pem');
          pem.should.equal(TestKeys.EC.public.spki.PEM);
        });
        it('should encode an original DER JWK to DER format', () => {
          const der = new PublicKey(jwkDER).encode('der');
          der.toString().should.equal(TestKeys.EC.public.spki.DER.toString());
        });
        it('should encode an original PEM JWK to DER format', () => {
          const der = new PublicKey(jwkPEM).encode('der');
          (der instanceof Buffer).should.be.true;
          // TODO this is a pretty weak check. Should more thoroughly vet this.
        });
        it('should encode an original DER JWK to PEM format', () => {
          const pem = new PublicKey(jwkDER).encode('pem') as string;
          /^-----BEGIN PUBLIC KEY-----/.test(pem).should.be.true;
        });
      });
      describe('EdDSA', () => {
        let jwkPEM: EdDSAPublicJWK;
        let jwkDER: EdDSAPublicJWK;
        before(() => {
          const pemKey = TestKeys.ED25519.public.spki.PEM;
          jwkPEM = new PublicKey().decode(pemKey, 'pem').toJWK();

          const derKey = TestKeys.ED25519.public.spki.DER;
          jwkDER = new PublicKey().decode(derKey, 'der').toJWK();
        });
        it('should encode an original PEM JWK to PEM format', () => {
          const pem = new PublicKey(jwkPEM).encode('pem') as string;
          pem.should.equal(TestKeys.ED25519.public.spki.PEM);
        });
        it('should encode an original DER JWK to DER format', () => {
          const der = new PublicKey(jwkDER).encode('der');
          der.toString().should.equal(TestKeys.ED25519.public.spki.DER.toString());
        });
        it('should encode an original PEM JWK to DER format', () => {
          const der = new PublicKey(jwkPEM).encode('der');
          (der instanceof Buffer).should.be.true;
          // TODO this is a pretty weak check. Should more thoroughly vet this.
        });
        it('should encode an original DER JWK to PEM format', () => {
          const pem = new PublicKey(jwkDER).encode('pem') as string;
          /^-----BEGIN PUBLIC KEY-----/.test(pem).should.be.true;
        });
      });
      describe('RSA', () => {
        let jwkPEM: RSAPublicJWK;
        let jwkDER: RSAPublicJWK;
        before(() => {
          const pemKey = TestKeys.RSA.public.spki.PEM;
          jwkPEM = new PublicKey().decode(pemKey, 'pem').toJWK();

          const derKey = TestKeys.RSA.public.spki.DER;
          jwkDER = new PublicKey().decode(derKey, 'der').toJWK();
        });
        it('should encode an original PEM JWK to PEM format', () => {
          const pem = new PublicKey(jwkPEM).encode('pem') as string;
          pem.should.equal(TestKeys.RSA.public.spki.PEM);
        });
        it('should encode an original DER JWK to DER format', () => {
          const der = new PublicKey(jwkDER).encode('der');
          der.toString().should.equal(TestKeys.RSA.public.spki.DER.toString());
        });
        it('should encode an original PEM JWK to DER format', () => {
          const der = new PublicKey(jwkPEM).encode('der');
          (der instanceof Buffer).should.be.true;
          // TODO this is a pretty weak check. Should more thoroughly vet this.
        });
        it('should encode an original DER JWK to PEM format', () => {
          const pem = new PublicKey(jwkDER).encode('pem') as string;
          /^-----BEGIN PUBLIC KEY-----/.test(pem).should.be.true;
        });
      });
    });
  });

  describe('rsa (PKCS1)', () => {
    describe('private', () => {
      describe('decode', () => {
        it('should decode an RSA private key in PEM format', () => {
          try {
            const key = TestKeys.RSA.private.pkcs1.PEM;
            const decoded = new RSAPriv().decode(key, 'pem');
            (decoded instanceof RSAPriv).should.be.true;
            expect(decoded['key']).to.exist;
            expect(decoded['key'].n).to.exist;
            expect(decoded['key'].e).to.exist;
            expect(decoded['key'].d).to.exist;
            expect(decoded['key'].p).to.exist;
            expect(decoded['key'].q).to.exist;
            expect(decoded['key'].dp).to.exist;
            expect(decoded['key'].dq).to.exist;
            expect(decoded['key'].qi).to.exist;
          } catch (err) {
            console.log(err.message);
            expect(err.message).to.not.exist;
          }
        });
        it('should decode an RSA private key in DER format', () => {
          try {
            const key = TestKeys.RSA.private.pkcs1.DER;
            const decoded = new RSAPriv().decode(key, 'der');
            (decoded instanceof RSAPriv).should.be.true;
            expect(decoded['key']).to.exist;
            expect(decoded['key'].n).to.exist;
            expect(decoded['key'].e).to.exist;
            expect(decoded['key'].d).to.exist;
            expect(decoded['key'].p).to.exist;
            expect(decoded['key'].q).to.exist;
            expect(decoded['key'].dp).to.exist;
            expect(decoded['key'].dq).to.exist;
            expect(decoded['key'].qi).to.exist;
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should fail to decode a PKCS8 private key', () => {
          try {
            const key = TestKeys.RSA.private.pkcs8.DER;
            const decoded = new RSAPriv().decode(key, 'der');
            expect(decoded['key']).to.be.null;
          } catch (err) {
            err.message.should.contain('Failed to match tag');
          }
        });
      });
      describe('toJWK', () => {
        let Instance: RSAPriv;
        beforeEach(() => {
          const key = TestKeys.RSA.private.pkcs1.DER;
          Instance = new RSAPriv().decode(key, 'der');
        });
        it('should convert decoded key to JWK', () => {
          const jwk = Instance.toJWK();
          expect(jwk).to.exist;
          (jwk instanceof JsonWebKey).should.be.true;
          jwk.kty.should.equal('RSA');
          jwk.private.should.be.true;
          jwk.public.should.be.false;
          expect(jwk.crv).to.not.exist;
          expect(jwk.n).to.exist;
          expect(jwk.e).to.exist;
          expect(jwk.d).to.exist;
          expect(jwk.p).to.exist;
          expect(jwk.q).to.exist;
          expect(jwk.dp).to.exist;
          expect(jwk.dq).to.exist;
          expect(jwk.qi).to.exist;
          Buffer.from(jwk.n, 'base64').toString().should.equal(Instance['key'].n.toBuffer().toString());
          Buffer.from(jwk.e, 'base64').toString().should.equal(Instance['key'].e.toBuffer().toString());
          Buffer.from(jwk.d, 'base64').toString().should.equal(Instance['key'].d.toBuffer().toString());
          Buffer.from(jwk.p, 'base64').toString().should.equal(Instance['key'].p.toBuffer().toString());
          Buffer.from(jwk.q, 'base64').toString().should.equal(Instance['key'].q.toBuffer().toString());
          Buffer.from(jwk.dp, 'base64').toString().should.equal(Instance['key'].dp.toBuffer().toString());
          Buffer.from(jwk.dq, 'base64').toString().should.equal(Instance['key'].dq.toBuffer().toString());
          Buffer.from(jwk.qi, 'base64').toString().should.equal(Instance['key'].qi.toBuffer().toString());
        });
      });
      describe('encode', () => {
        let jwkPEM: RSAPrivateJWK;
        let jwkDER: RSAPrivateJWK;
        before(() => {
          const pemKey = TestKeys.RSA.private.pkcs1.PEM;
          jwkPEM = new RSAPriv().decode(pemKey, 'pem').toJWK();

          const derKey = TestKeys.RSA.private.pkcs1.DER;
          jwkDER = new RSAPriv().decode(derKey, 'der').toJWK();
        });
        it('should encode an original PEM JWK to PEM format', () => {
          const pem = new RSAPriv(jwkPEM).encode('pem');
          pem.toString().should.equal(TestKeys.RSA.private.pkcs1.PEM);
        });
        it('should encode an original DER JWK to DER format', () => {
          const der = new RSAPriv(jwkDER).encode('der');
          der.toString().should.equal(TestKeys.RSA.private.pkcs1.DER.toString());
        });
        it('should encode an original PEM JWK to DER format', () => {
          const der = new RSAPriv(jwkPEM).encode('der');
          (der instanceof Buffer).should.be.true;
          // TODO this is a pretty weak check. Should more thoroughly vet this.
        });
        it('should encode an original DER JWK to PEM format', () => {
          const pem = new RSAPriv(jwkDER).encode('pem') as string;
          /^-----BEGIN RSA PRIVATE KEY-----/.test(pem).should.be.true;
        });
        it('should encode an original PKCS8 key to PKCS1', () => {
          const jwk = new PrivateKey().decode(TestKeys.RSA.private.pkcs8.DER, 'der').toJWK() as RSAPrivateJWK;
          const pem = new RSAPriv(jwk).encode('pem') as string;
          /^-----BEGIN RSA PRIVATE KEY-----/.test(pem).should.be.true;
        });
      });
    });
    describe('public', () => {
      describe('decode', () => {
        it('should decode an RSA public key in PEM format', () => {
          try {
            const key = TestKeys.RSA.public.pkcs1.PEM;
            const decoded = new RSAPub().decode(key, 'pem');
            (decoded instanceof RSAPub).should.be.true;
            expect(decoded['key']).to.exist;
            expect(decoded['key'].n).to.exist;
            expect(decoded['key'].e).to.exist;
            expect(decoded['key']['d']).to.not.exist;
            expect(decoded['key']['p']).to.not.exist;
            expect(decoded['key']['q']).to.not.exist;
            expect(decoded['key']['dp']).to.not.exist;
            expect(decoded['key']['dq']).to.not.exist;
            expect(decoded['key']['qi']).to.not.exist;
          } catch (err) {
            console.log(err.message);
            expect(err.message).to.not.exist;
          }
        });
        it('should decode an RSA public key in DER format', () => {
          try {
            const key = TestKeys.RSA.public.pkcs1.DER;
            const decoded = new RSAPub().decode(key, 'der');
            (decoded instanceof RSAPub).should.be.true;
            expect(decoded['key']).to.exist;
            expect(decoded['key'].n).to.exist;
            expect(decoded['key'].e).to.exist;
            expect(decoded['key']['d']).to.not.exist;
            expect(decoded['key']['p']).to.not.exist;
            expect(decoded['key']['q']).to.not.exist;
            expect(decoded['key']['dp']).to.not.exist;
            expect(decoded['key']['dq']).to.not.exist;
            expect(decoded['key']['qi']).to.not.exist;
          } catch (err) {
            expect(err.message).to.not.exist;
          }
        });
        it('should fail to decode an SPKI public key', () => {
          try {
            const key = TestKeys.RSA.public.spki.DER;
            const decoded = new RSAPub().decode(key, 'der');
            expect(decoded['key']).to.be.null;
          } catch (err) {
            err.message.should.contain('Failed to match tag');
          }
        });
      });
      describe('toJWK', () => {
        let Instance: RSAPub;
        beforeEach(() => {
          const key = TestKeys.RSA.public.pkcs1.DER;
          Instance = new RSAPub().decode(key, 'der');
        });
        it('should convert decoded key to JWK', () => {
          const jwk = Instance.toJWK();
          expect(jwk).to.exist;
          (jwk instanceof JsonWebKey).should.be.true;
          jwk.kty.should.equal('RSA');
          jwk.private.should.be.false;
          jwk.public.should.be.true;
          expect(jwk.crv).to.not.exist;
          expect(jwk.n).to.exist;
          expect(jwk.e).to.exist;
          expect(jwk['d']).to.not.exist;
          expect(jwk['p']).to.not.exist;
          expect(jwk['q']).to.not.exist;
          expect(jwk['dp']).to.not.exist;
          expect(jwk['dq']).to.not.exist;
          expect(jwk['qi']).to.not.exist;
          Buffer.from(jwk.n, 'base64').toString().should.equal(Instance['key'].n.toBuffer().toString());
          Buffer.from(jwk.e, 'base64').toString().should.equal(Instance['key'].e.toBuffer().toString());
        });
      });
      describe('encode', () => {
        let jwkPEM: RSAPublicJWK;
        let jwkDER: RSAPublicJWK;
        before(() => {
          const pemKey = TestKeys.RSA.public.pkcs1.PEM;
          jwkPEM = new RSAPub().decode(pemKey, 'pem').toJWK();

          const derKey = TestKeys.RSA.public.pkcs1.DER;
          jwkDER = new RSAPub().decode(derKey, 'der').toJWK();
        });
        it('should encode an original PEM JWK to PEM format', () => {
          const pem = new RSAPub(jwkPEM).encode('pem');
          pem.toString().should.equal(TestKeys.RSA.public.pkcs1.PEM);
        });
        it('should encode an original DER JWK to DER format', () => {
          const der = new RSAPub(jwkDER).encode('der');
          der.toString().should.equal(TestKeys.RSA.public.pkcs1.DER.toString());
        });
        it('should encode an original PEM JWK to DER format', () => {
          const der = new RSAPub(jwkPEM).encode('der');
          (der instanceof Buffer).should.be.true;
          // TODO this is a pretty weak check. Should more thoroughly vet this.
        });
        it('should encode an original DER JWK to PEM format', () => {
          const pem = new RSAPub(jwkDER).encode('pem') as string;
          /^-----BEGIN RSA PUBLIC KEY-----/.test(pem).should.be.true;
        });
        it('should encode an original SPKI key to PKCS1', () => {
          const jwk = new PublicKey().decode(TestKeys.RSA.public.spki.DER, 'der').toJWK() as RSAPublicJWK;
          const pem = new RSAPub(jwk).encode('pem') as string;
          /^-----BEGIN RSA PUBLIC KEY-----/.test(pem).should.be.true;
        });
      });
    });
  });
});