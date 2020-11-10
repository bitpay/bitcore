import asn from 'asn1.js';
import { ASN1Encoding, BaseJWK, ECPrivateJWK } from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import JsonWebKey from './jwk';
import objIds from './objectIdentifiers';

// Private EC only

class PrivateKey {
  private asn = null;
  private key = null;

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

  toJWK(): ECPrivateJWK {
    const pubKey = this.key.publicKey;
    const pubKeyXYLen = (pubKey.length - 1) / 2;
    const jwk: BaseJWK.ECPrivate = {
      kty: 'EC',
      use: 'sig',
      crv: this.key.curve,
      version: this.key.version,
      d: toUrlBase64(this.key.privateKey),
      x: toUrlBase64(pubKey.slice(1, pubKeyXYLen + 1)),
      y: toUrlBase64(pubKey.slice(pubKeyXYLen + 1))
    };
    return new JsonWebKey(jwk, 'private');
  }
}

export default PrivateKey;
