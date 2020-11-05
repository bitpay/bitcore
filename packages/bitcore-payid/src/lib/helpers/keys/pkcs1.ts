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

  constructor() {
    this.asn = RSAPrivateKey;
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): Private {
    this.key = this.asn.decode(data, enc, { label: 'private key', ...options });
    return this;
  }

  toJWK(): RSAPrivateJWK {
    const jwk: BaseJWK.RSAPrivate = {
      kty: 'RSA',
      use: 'sig',
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

  constructor() {
    this.asn = RSAPublicKey;
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): Public {
    this.key = this.asn.decode(data, enc, { label: 'rsa public key', ...options });
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
