import asn from 'asn1.js';
import { ASN1Encoding, JWK } from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import objIds from './objectIdentifiers';

// Private EC only

class PrivateKey {
  asn = null;
  key = null;

  constructor() {
    this.asn = asn.define('sec1', function() {
      this.seq().obj(
        this.key('version').int(),
        this.key('privateKey').octstr().optional(),
        this.key('curve').explicit(0).objid(objIds),
        this.key('publicKey').explicit(1).bitstr()
      );
    });
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): PrivateKey {
    this.key = this.asn.decode(data, enc, options);
    return this;
  }

  toJWK(): JWK {
    const pubKey = this.key.publicKey;
    const pubKeyXYLen = (pubKey.length - 1) / 2;
    return {
      kty: 'EC',
      use: 'sig',
      crv: this.key.curve,
      d: toUrlBase64(this.key.privateKey),
      x: toUrlBase64(pubKey.slice(1, pubKeyXYLen + 1)),
      y: toUrlBase64(pubKey.slice(pubKeyXYLen + 1)),
      private: true,
      public: false
    };
  }
}

export default new PrivateKey();
