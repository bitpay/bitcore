import elliptic from 'elliptic';
import hash from 'hash.js';
import { GeneralJWS } from '../index.d';
import { toDER } from './helpers/converters/der';

class Verifier {
  constructor() {}

  verify(expectedPayId: string, signedAddressPayload: GeneralJWS): boolean {
    const jws = typeof signedAddressPayload === 'string' ? JSON.parse(signedAddressPayload) : signedAddressPayload;

    const address = JSON.parse(jws.payload);
    if (expectedPayId !== address.payId) {
      // payId does not match what was inside the signed payload
      return false;
    }
    try {
      const parsedProt = JSON.parse(Buffer.from(signedAddressPayload.signatures[0].protected, 'base64').toString());

      const { jwk } = parsedProt;
      const keyCurve = new elliptic.ec(jwk.crv);
      const x = Buffer.from(jwk.x, 'base64').toString('hex');
      const y = Buffer.from(jwk.y, 'base64').toString('hex');
      const pubKey = keyCurve.keyFromPublic({ x, y }, 'hex');
      let _sig = signedAddressPayload.signatures[0].signature;
      const sigBuf = Buffer.from(_sig, 'base64');
      const derSig = toDER(sigBuf, parsedProt.alg);

      const toCompare = Buffer.concat([
        Buffer.from(signedAddressPayload.signatures[0].protected),
        Buffer.from('.'),
        Buffer.from(signedAddressPayload.payload)
      ]);
      const toCompareHash = Buffer.from(hash.sha256().update(toCompare).digest());

      const verified = pubKey.verify(toCompareHash.toString('hex'), derSig);
      return verified;
    } catch (err) {
      console.log(err);
      return false;
    }
  }
}

export default new Verifier();