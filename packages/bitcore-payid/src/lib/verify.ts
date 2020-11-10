import elliptic from 'elliptic';
import hash from 'hash.js';
import { UNSUPPPORTED_KEY_TYPE } from '../errors';
import { ECPublicJWK, EdDSAPublicJWK, GeneralJWS, PublicJWK, RSAPublicJWK } from '../index.d';
import { Algorithm, toDER } from './helpers/converters/der';
import PKCS1 from './helpers/keys/pkcs1';
import { inBrowser } from './utils';

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

      const { jwk }: { jwk: PublicJWK } = parsedProt;
      const signature = signedAddressPayload.signatures[0].signature;
      const toCompare = Buffer.concat([
        Buffer.from(signedAddressPayload.signatures[0].protected),
        Buffer.from('.'),
        Buffer.from(signedAddressPayload.payload)
      ]);

      let verified = false;
      switch (jwk.kty) {
        case 'EC':
          verified = this._verifyEC(signature, toCompare, jwk as ECPublicJWK, parsedProt.alg);
          break;
        case 'OKP':
          verified = this._verifyEdDSA(signature, toCompare, jwk as EdDSAPublicJWK);
          break;
        case 'RSA':
          verified = await this._verifyRSA(signature, toCompare, jwk as RSAPublicJWK);
          break;
        default:
          throw new Error(UNSUPPPORTED_KEY_TYPE);
      }

      return verified;
    } catch (err) {
      console.error(err.message);
      return false;
    }
  }

  private _verifyEC(signature: string, compareTo: Buffer, jwk: ECPublicJWK, alg: Algorithm): boolean {
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

  private _verifyEdDSA(signature: string, compareTo: Buffer, jwk: EdDSAPublicJWK): boolean {
    const eddsa = new elliptic.eddsa(jwk.crv).keyFromPublic(jwk.x);
    const verified = eddsa.verify(compareTo, Array.from(signature));
    return verified;
  }

  private async _verifyRSA(signature: string, compareTo: Buffer, jwk: RSAPublicJWK): Promise<boolean> {
    if (inBrowser()) {
      return this._verifyInBrowserRSA(signature, compareTo, jwk);
    }
    return this._verifyNodeRSA(signature, compareTo, jwk);
  }

  private async _verifyInBrowserRSA(signature: string, compareTo: Buffer, jwk: RSAPublicJWK): Promise<boolean> {
    const key = await window.crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const verified = await window.crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, Buffer.from(signature, 'base64'), compareTo);
    return verified;
  }

  private _verifyNodeRSA(signature: string, compareTo: Buffer, jwk: RSAPublicJWK): boolean {
    const crypto = require('crypto');
    const pem = new PKCS1.Public(jwk).encode('pem');
    const key = crypto.createPublicKey(pem);
    const sigBuf = Buffer.from(signature, 'base64');
    const verified = crypto.verify('SHA256', compareTo, key, sigBuf);
    return verified;
  }
}

export default new Verifier();