import asn from 'asn1.js';
import BN from 'bn.js';
import { eddsa } from 'elliptic';
import { UNSUPPPORTED_KEY_TYPE } from '../../../errors';
import { ASN1Encoding, JWK, SupportedCurves } from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import { ECPrivateKey } from './ec';
import { OKPPrivateKey } from './ed25519';
import objIds from './objectIdentifiers';
import PKCS1 from './pkcs1';

// Private only

interface PrivateKey {
  version: BN;
  attributes: {
    type: string;
    curve?: string;
  };
  privateKey: any;
}

class PrivateKeyClass {
  asn = null;
  key: PrivateKey = null;

  constructor() {
    this.asn = asn.define('pkcs8', function() {
      this.seq().obj(
        this.key('version').int(),
        this.key('attributes').seq().obj(
          this.key('type').objid(objIds),
          this.key('curve').objid(objIds).optional()
        ),
        this.key('privateKey').octstr()
      );
    });
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): PrivateKeyClass {
    this.key = this.asn.decode(data, enc, options);
    return this;
  }

  toJWK(): JWK {
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

  private _rsa(): JWK {
    return PKCS1.private.decode(this.key.privateKey, 'der').toJWK();
  }

  private _ec(): JWK {
    this.key.privateKey = ECPrivateKey.decode(this.key.privateKey, 'der');
    const pubKey = this.key.privateKey.publicKey.data;
    const pubKeyXYLen = (pubKey.length - 1) / 2;
    return {
      kty: 'EC',
      crv: this.key.attributes.curve as SupportedCurves,
      use: 'sig',
      d: toUrlBase64(this.key.privateKey.privateKey),
      x: toUrlBase64(pubKey.slice(1, pubKeyXYLen + 1)),
      y: toUrlBase64(pubKey.slice(pubKeyXYLen + 1)),
      private: true,
      public: false
    };
  }

  private _okp(): JWK { // Currently only supports ed25519
    this.key.privateKey = OKPPrivateKey.decode(this.key.privateKey, 'der');
    const ecKey = new eddsa('ed25519').keyFromSecret(this.key.privateKey);

    return {
      kty: 'OKP',
      use: 'sig',
      crv: this.key.attributes.type.toLowerCase() as SupportedCurves,
      d: toUrlBase64(this.key.privateKey),
      x: toUrlBase64(ecKey.getPublic()),
      private: true,
      public: false
    };
  }
}

export default new PrivateKeyClass();
