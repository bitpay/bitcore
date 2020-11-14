import { eddsa } from 'elliptic';
import { UNSUPPPORTED_KEY_TYPE } from '../../../errors';
import {
  ASN1,
  ASN1Encoding,
  BaseJWK,
  ECPrivateJWK,
  EdDSAPrivateJWK,
  Iokp,
  Ipkcs8,
  Isec1,
  KeyConverterClass,
  RSAPrivateJWK,
  SupportedCurves
} from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import { ECPrivateKey } from './asn1/ec';
import { OKPPrivateKey } from './asn1/ed25519';
import { PrivateKey } from './asn1/private';
import JsonWebKey from './jwk';
import PKCS1 from './rsa';

// Private only

class PrivateKeyClass implements KeyConverterClass {
  private asn: ASN1<Ipkcs8> = null;
  private key: Ipkcs8 = null;

  constructor() {
    this.asn = PrivateKey;
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): PrivateKeyClass {
    this.key = this.asn.decode(data, enc, { label: 'PRIVATE KEY', ...options });
    return this;
  }

  toJWK(): RSAPrivateJWK | ECPrivateJWK | EdDSAPrivateJWK {
    switch (this.key.attributes.type) {
      case 'rsaEncryption':
        return this._rsa();
      case 'ecEncryption':
        return this._ec();
      case 'Ed25519':
        return this._okp();
      default:
        throw new Error(UNSUPPPORTED_KEY_TYPE);
    }
  }

  private _rsa(): RSAPrivateJWK {
    return new PKCS1.Private().decode(this.key.privateKey as Buffer, 'der').toJWK();
  }

  private _ec(): ECPrivateJWK {
    this.key.privateKey = ECPrivateKey.decode(this.key.privateKey as Buffer, 'der') as Isec1;
    const pubKey = this.key.privateKey.publicKey.data;
    const pubKeyXYLen = (pubKey.length - 1) / 2;
    const jwk: BaseJWK.ECPrivate =  {
      kty: 'EC',
      crv: this.key.attributes.curve,
      use: 'sig',
      version: this.key.version,
      d: toUrlBase64(this.key.privateKey.privateKey),
      x: toUrlBase64(pubKey.slice(1, pubKeyXYLen + 1)),
      y: toUrlBase64(pubKey.slice(pubKeyXYLen + 1))
    };

    return new JsonWebKey(jwk, 'private');
  }

  private _okp(): EdDSAPrivateJWK { // Currently only supports ed25519
    this.key.privateKey = OKPPrivateKey.decode(this.key.privateKey as Buffer, 'der') as Iokp;
    const ecKey = new eddsa('ed25519').keyFromSecret(this.key.privateKey);

    const jwk: BaseJWK.EdDSAPrivate = {
      kty: 'OKP',
      use: 'sig',
      crv: this.key.attributes.type as SupportedCurves,
      version: this.key.version,
      d: toUrlBase64(this.key.privateKey),
      x: toUrlBase64(ecKey.getPublic())
    };

    return new JsonWebKey(jwk, 'private');
  }
}

export default PrivateKeyClass;
