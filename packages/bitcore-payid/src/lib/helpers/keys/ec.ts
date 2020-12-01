import { ASN1, ASN1Encoding, BaseJWK, ECPrivateJWK, Isec1, KeyConverterClass } from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';
import { ECPrivateKey } from './asn1/ec';
import JsonWebKey from './jwk';

// Private EC only

class PrivateKey implements KeyConverterClass {
  private asn: ASN1<Isec1> = null;
  private key: Isec1 = null;

  constructor() {
    this.asn = ECPrivateKey;
  }

  decode(data: string | Buffer, enc: ASN1Encoding, options = {}): PrivateKey {
    this.key = this.asn.decode(data, enc, { label: 'EC PRIVATE KEY', ...options });
    return this;
  }

  toJWK(): ECPrivateJWK {
    const pubKey = this.key.publicKey.data;
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
