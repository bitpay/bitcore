import BN from 'bn.js';
import { ASN1, ASN1Encoding, ASN1Options, BaseJWK, Ipksc1Priv, Ipksc1Pub, KeyConverterClass, RSAPrivateJWK, RSAPublicJWK } from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import { RSAPrivateKey, RSAPublicKey } from './asn1/rsa';
import JsonWebKey from './jwk';

// RSA only

// Private

export class Private implements KeyConverterClass {
  private asn: ASN1<Ipksc1Priv> = null;
  private key: Ipksc1Priv = null;

  constructor(jwk?: RSAPrivateJWK) {
    this.asn = RSAPrivateKey;
    if (jwk) {
      this.key = {
        version: new BN(jwk.version),
        n: new BN(Buffer.from(jwk.n, 'base64')),
        e: new BN(Buffer.from(jwk.e, 'base64')),
        d: new BN(Buffer.from(jwk.d, 'base64')),
        p: new BN(Buffer.from(jwk.p, 'base64')),
        q: new BN(Buffer.from(jwk.q, 'base64')),
        dp: new BN(Buffer.from(jwk.dp, 'base64')),
        dq: new BN(Buffer.from(jwk.dq, 'base64')),
        qi: new BN(Buffer.from(jwk.qi, 'base64'))
      };
    }
  }

  encode(enc: ASN1Encoding, options: ASN1Options = {}): Buffer | string {
    const encodedKey = this.asn.encode(this.key, enc, enc === 'der' ? null : { label: 'RSA PRIVATE KEY', ...options });
    return encodedKey;
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): Private {
    this.key = this.asn.decode(data, enc, { label: 'RSA PRIVATE KEY', ...options });
    return this;
  }

  toJWK(): RSAPrivateJWK {
    const jwk: BaseJWK.RSAPrivate = {
      kty: 'RSA',
      use: 'sig',
      version: this.key.version.toString(),
      n: toUrlBase64(this.key.n.toBuffer()),
      e: toUrlBase64(this.key.e.toBuffer()),
      d: toUrlBase64(this.key.d.toBuffer()),
      p: toUrlBase64(this.key.p.toBuffer()),
      q: toUrlBase64(this.key.q.toBuffer()),
      dp: toUrlBase64(this.key.dp.toBuffer()),
      dq: toUrlBase64(this.key.dq.toBuffer()),
      qi: toUrlBase64(this.key.qi.toBuffer()),
      length: this.key.n.toBuffer().length * 8
    };
    return new JsonWebKey(jwk, 'private');
  }
}

// Public

export class Public implements KeyConverterClass {
  private asn: ASN1<Ipksc1Pub> = null;
  private key: Ipksc1Pub = null;

  constructor(jwk?: RSAPublicJWK) {
    this.asn = RSAPublicKey;
    if (jwk) {
      this.key = {
        n: new BN(Buffer.from(jwk.n, 'base64')),
        e: new BN(Buffer.from(jwk.e, 'base64'))
      };
    }
  }

  encode(enc: ASN1Encoding, options: ASN1Options = {}): Buffer | string {
    const encodedKey = this.asn.encode(this.key, enc, enc === 'der' ? null : { label: 'RSA PUBLIC KEY', ...options });
    return encodedKey;
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options: ASN1Options = {}): Public {
    this.key = this.asn.decode(data, enc, { label: 'RSA PUBLIC KEY', ...options });
    return this;
  }

  toJWK(): RSAPublicJWK {
    const jwk: BaseJWK.RSAPublic = {
      kty: 'RSA',
      use: 'sig',
      n: toUrlBase64(this.key.n.toBuffer()),
      e: toUrlBase64(this.key.e.toBuffer()),
      length: this.key.n.toBuffer().length * 8
    };
    return new JsonWebKey(jwk, 'public');
  }
}

export default {
  Private,
  Public
};
