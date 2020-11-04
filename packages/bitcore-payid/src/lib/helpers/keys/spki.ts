import asn from 'asn1.js';
import { ASN1Encoding, JWK } from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import objIds from './objectIdentifiers';

class PublicKey {
  asn = null;
  key = null;

  constructor() {
    this.asn = asn.define('spki', function() {
      this.seq().obj(
        this.key('attributes').seq().obj(
          this.key('type').objid(objIds),
          this.key('curve').objid(objIds).optional()
        ),
        this.key('publicKey').bitstr()
      );
    });
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): PublicKey {
    this.key = this.asn.decode(data, enc, { label: 'public key', ...options });
    return this;
  }

  toJWK(): JWK {
    const pubKey = this.key.publicKey.data;
    const pubKeyXYLen = (pubKey.length - 1) / 2;
    return {
      kty: 'EC',
      use: 'sig',
      crv: this.key.attributes.curve,
      x: toUrlBase64(pubKey.slice(1, pubKeyXYLen + 1)),
      y: toUrlBase64(pubKey.slice(pubKeyXYLen + 1)),
      private: false,
      public: true
    };
  }
}

export default new PublicKey();