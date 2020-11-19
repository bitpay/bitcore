import BN from 'bn.js';
import { UNSUPPPORTED_KEY_TYPE } from '../../../errors';
import {
  ASN1,
  ASN1Attributes,
  ASN1AttributesChoice,
  ASN1Encoding,
  ASN1Options,
  BaseJWK,
  ECPublicJWK,
  EdDSAPublicJWK,
  Ispki,
  KeyConverterClass,
  RSAPublicJWK
} from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import { PublicKey as PublicKeyASN } from './asn1/public';
import { RSAPublicKey } from './asn1/rsa';
import JsonWebKey from './jwk';

// Public only

const typeMap = {
  RSA: 'rsaEncryption',
  EC: 'ecEncryption',
  OKP: 'Ed25519'
};

const componentsToBuffer = {
  RSA: (jwk: RSAPublicJWK) => RSAPublicKey.encode({ n: new BN(Buffer.from(jwk.n, 'base64').toString('hex'), 'hex'), e: new BN(Buffer.from(jwk.e, 'base64').toString('hex'), 'hex') }, 'der'),
  EC: (jwk: ECPublicJWK) => Buffer.concat([Uint8Array.from([0x04]), Buffer.from(jwk.x, 'base64'), Buffer.from(jwk.y, 'base64')]),
  OKP: (jwk: EdDSAPublicJWK) => Buffer.from(jwk.x, 'base64')
};

class PublicKey implements KeyConverterClass {
  private asn: ASN1<Ispki> = null;
  private key: Ispki = null;

  constructor(jwk?: RSAPublicJWK | ECPublicJWK | EdDSAPublicJWK) {
    this.asn = PublicKeyASN;

    if (jwk) {
      const attributes: ASN1Attributes<ASN1AttributesChoice> = { type: typeMap[jwk.kty] };
      if (jwk.kty === 'RSA') {
        attributes.curve = { type: 'null', value: null };
      } else if (jwk.kty === 'EC') {
        attributes.curve = { type: 'curve', value: jwk.crv };
      }
      this.key = {
        attributes,
        publicKey: { data: componentsToBuffer[jwk.kty](jwk as any), unused: 0 }
      };
    }
  }

  encode(enc: ASN1Encoding, options: ASN1Options = {}): Buffer | string {
    return this.asn.encode(this.key, enc, enc === 'der' ? null : { label: 'PUBLIC KEY', ...options });
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): PublicKey {
    this.key = this.asn.decode(data, enc, { label: 'PUBLIC KEY', ...options });
    return this;
  }

  toJWK(): JsonWebKey {
    let jwk;
    switch (this.key.attributes.type) {
      case 'rsaEncryption':
        jwk = this._rsaJwk();
        break;
      case 'ecEncryption':
        jwk = this._ecJwk();
        break;
      case 'Ed25519':
        jwk = this._eddsaJwk();
        break;
      default:
        throw new Error(UNSUPPPORTED_KEY_TYPE);
    }

    return new JsonWebKey(jwk, 'public');
  }

  private _ecJwk(): BaseJWK.ECPublic {
    const pubKey = this.key.publicKey.data;
    const pubKeyXYLen = (pubKey.length - 1) / 2;
    const jwk: BaseJWK.ECPublic = {
      kty: 'EC',
      use: 'sig',
      crv: this.key.attributes.curve.value,
      version: 0,
      x: toUrlBase64(pubKey.slice(1, pubKeyXYLen + 1)),
      y: toUrlBase64(pubKey.slice(pubKeyXYLen + 1))
    };
    return jwk;
  }

  private _eddsaJwk(): BaseJWK.EdDSAPublic {
    const jwk: BaseJWK.EdDSAPublic = {
      kty: 'OKP',
      use: 'sig',
      crv: this.key.attributes.type as any,
      x: toUrlBase64(this.key.publicKey.data)
    };
    return jwk;
  }

  private _rsaJwk(): BaseJWK.RSAPublic {
    const pubKey = RSAPublicKey.decode(this.key.publicKey.data, 'der');
    const jwk: BaseJWK.RSAPublic = {
      kty: 'RSA',
      use: 'sig',
      version: 0,
      n: toUrlBase64(pubKey.n.toBuffer()),
      e: toUrlBase64(pubKey.e.toBuffer()),
      length: pubKey.n.toBuffer().length * 8
    };
    return jwk;
  }
}

export default PublicKey;