import elliptic from 'elliptic';
import hash from 'hash.js';
import { UNSUPPPORTED_KEY_TYPE } from '../errors';
import { GeneralJWS, JWK } from '../index.d';
import { Algorithm, toDER } from './helpers/converters/der';

class Verifier {
  constructor() {}

  async verify(expectedPayId: string, signedAddressPayload: GeneralJWS): Promise<boolean> {
    const jws = typeof signedAddressPayload === 'string' ? JSON.parse(signedAddressPayload) : signedAddressPayload;

    const address = JSON.parse(jws.payload);
    if (expectedPayId !== address.payId) {
      // payId does not match what was inside the signed payload
      return false;
    }
    try {
      const parsedProt = JSON.parse(Buffer.from(signedAddressPayload.signatures[0].protected, 'base64').toString());

      const { jwk }: { jwk: JWK } = parsedProt;
      const signature = signedAddressPayload.signatures[0].signature;
      const toCompare = Buffer.concat([
        Buffer.from(signedAddressPayload.signatures[0].protected),
        Buffer.from('.'),
        Buffer.from(signedAddressPayload.payload)
      ]);

      let verified = false;
      switch (jwk.kty) {
        case 'EC':
          verified = this._verifyEC(signature, toCompare, jwk, parsedProt.alg);
          break;
        case 'OKP':
          verified = this._verifyEdDSA(signature, toCompare, jwk);
          break;
        case 'RSA':
          verified = await this._verifyRSA(signature, toCompare, jwk);
          break;
        default:
          throw new Error(UNSUPPPORTED_KEY_TYPE);
      }

      return verified;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  private _verifyEC(signature: string, compareTo: Buffer, jwk: JWK, alg: Algorithm): boolean {
    const keyCurve = new elliptic.ec(jwk.crv);
    const x = Buffer.from(jwk.x, 'base64').toString('hex');
    const y = Buffer.from(jwk.y, 'base64').toString('hex');
    const pubKey = keyCurve.keyFromPublic({ x, y }, 'hex');
    const sigBuf = Buffer.from(signature, 'base64');
    const derSig = toDER(sigBuf, alg || 'ES256K');
    const toCompareHash = Buffer.from(hash.sha256().update(compareTo).digest());
    const verified = pubKey.verify(toCompareHash.toString('hex'), derSig);
    return verified;
  }

  private _verifyEdDSA(signature: string, compareTo: Buffer, jwk: JWK): boolean {
    const eddsa = new elliptic.eddsa(jwk.crv).keyFromPublic(jwk.x);
    const verified = eddsa.verify(compareTo, Array.from(signature));
    return verified;
  }

  private async _verifyRSA(signature: string, compareTo: Buffer, jwk: JWK): Promise<boolean> {
    const key = await window.crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const verified = await window.crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, Buffer.from(signature), compareTo);
    return verified;
  }
}

export default new Verifier();