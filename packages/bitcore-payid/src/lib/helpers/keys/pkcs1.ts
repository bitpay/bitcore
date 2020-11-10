import BN from 'bn.js';
import { ASN1Encoding, BaseJWK, RSAPrivateJWK, RSAPublicJWK } from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import JsonWebKey from './jwk';
import { RSAPrivateKey, RSAPublicKey } from './rsa';

// RSA only

// Private

interface PrivateKey {
  version: BN;
  n: BN;
  e: BN;
  d: BN;
  p: BN;
  q: BN;
  dp: BN;
  dq: BN;
  qi: BN;
  other?: any;
}

class Private {
  private asn = null;
  private key: PrivateKey = null;

  constructor(jwk?: RSAPrivateJWK) {
    this.asn = RSAPrivateKey;
    if (jwk) {
      this.key = {
        version: jwk.version,
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

  encode(enc: ASN1Encoding, options = {}): Buffer {
    const encodedKey = this.asn.encode(this.key, enc, { label: 'RSA PRIVATE KEY', ...options });
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
      version: this.key.version,
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

interface PublicKey {
  n: BN;
  e: BN;
}

class Public {
  private asn = null;
  private key: PublicKey = null;

  constructor(jwk?: RSAPublicJWK) {
    this.asn = RSAPublicKey;
    if (jwk) {
      this.key = {
        n: new BN(Buffer.from(jwk.n, 'base64')),
        e: new BN(Buffer.from(jwk.e, 'base64'))
      };
    }
  }

  encode(enc: ASN1Encoding, options = {}) {
    const encodedKey = this.asn.encode(this.key, enc, { label: 'RSA PUBLIC KEY', ...options });
    return encodedKey;
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): Public {
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
