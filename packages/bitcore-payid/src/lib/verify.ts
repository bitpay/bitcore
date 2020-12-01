import elliptic from 'elliptic';
import hash from 'hash.js';
import { UNSUPPPORTED_KEY_TYPE } from '../errors';
import { EcAlgorithm, ECPublicJWK, EdDSAPublicJWK, GeneralJWS, PublicJWK, RsaAlgorithm, RSAPublicJWK } from '../index.d';
import { signatureAlgorithmMap } from './helpers/converters/algorithm';
import { toDER } from './helpers/converters/der';
import PKCS1 from './helpers/keys/rsa';
import { inBrowser } from './utils';

class Verifier {
  constructor() {}

  /**
   * Verifies the signed address.
   * At this time, this method will only verify the first signature in array of "signedAddressPayload.signatures".
   * To verify multiple signatures, you can iterate over the signatures array and call this method for each one.
   * @param expectedPayId
   * @param signedAddressPayload
   * @returns {Promise<Boolean>}
   */
  async verify(expectedPayId: string, signedAddressPayload: GeneralJWS): Promise<boolean> {
    const jws = typeof signedAddressPayload === 'string' ? JSON.parse(signedAddressPayload) : signedAddressPayload;

    const address = JSON.parse(jws.payload);
    if (expectedPayId !== address.payId) {
      // payId does not match what was inside the signed payload
      return false;
    }
    try {
      const parsedProt = JSON.parse(Buffer.from(signedAddressPayload.signatures[0].protected, 'base64').toString());

      const jwk: PublicJWK = parsedProt.jwk;
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
          verified = this._verifyEdDSA(signature, toCompare, jwk as EdDSAPublicJWK); // Doesn't get the alg param because it's implicit when verifying EdDSA sigs
          break;
        case 'RSA':
          verified = await this._verifyRSA(signature, toCompare, jwk as RSAPublicJWK, parsedProt.alg);
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

  /**
   * Verify elliptic curve signatures.
   * @param signature Signature to be verified in base64.
   * @param compareTo Buffer to compare signature to.
   * @param jwk JSON Web Key used to verify signature.
   * @param alg Signing algorithm used. This should have been included in the PayId protected header.
   */
  private _verifyEC(signature: string, compareTo: Buffer, jwk: ECPublicJWK, alg: EcAlgorithm): boolean {
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

  /**
   * Verify EdDSA (Ed25519) signatures.
   * NOTE: The signing algorithm is implicit with EdDSA, thus not passed in.
   * @param signature Signature to be verified in base64.
   * @param compareTo Buffer to compare signature to.
   * @param jwk JSON Web Key used to verify signature. This should have been included in the PayId proteted header.
   */
  private _verifyEdDSA(signature: string, compareTo: Buffer, jwk: EdDSAPublicJWK): boolean {
    if (!jwk.crv && jwk.crv.toLowerCase() !== 'ed25519') {
      throw new Error(UNSUPPPORTED_KEY_TYPE);
    }
    const hexPoint = Buffer.from(jwk.x, 'base64').toString('hex');
    const eddsa = new elliptic.eddsa(jwk.crv.toLowerCase()).keyFromPublic(hexPoint);
    const sigBuf = Buffer.from(signature, 'base64');
    const verified = eddsa.verify(compareTo, Array.from(sigBuf));
    return verified;
  }

  /**
   * Verify RSA signatures.
   * @param signature Signature to be verified in base64.
   * @param compareTo Buffer to compare signature to.
   * @param jwk JSON Web Key used to verify signature. This should have been included in the PayId proteted header.
   * @param alg Signing algorithm used. This should have been included in the PayId protected header.
   */
  private async _verifyRSA(signature: string, compareTo: Buffer, jwk: RSAPublicJWK, alg: RsaAlgorithm): Promise<boolean> {
    if (inBrowser()) {
      return this._verifyInBrowserRSA(signature, compareTo, jwk, alg);
    }
    return this._verifyNodeRSA(signature, compareTo, jwk, alg);
  }

  /**
   * Called from this._verifyRSA. All params mirror that.
   * This method is called if this lib is imported in a browser environment.
   */
  private async _verifyInBrowserRSA(signature: string, compareTo: Buffer, jwk: RSAPublicJWK, alg: RsaAlgorithm): Promise<boolean> {
    const algorithm = signatureAlgorithmMap[alg];
    const key = await window.crypto.subtle.importKey('jwk', jwk, { name: algorithm.name, hash: algorithm.alg }, false, ['verify']);
    const verified = await window.crypto.subtle.verify(algorithm.name, key, Buffer.from(signature, 'base64'), compareTo);
    return verified;
  }

  /**
   * Called from this._verifyRSA. All params mirror that.
   * This method is called if this lib is imported in a Node.js environment.
   */
  private _verifyNodeRSA(signature: string, compareTo: Buffer, jwk: RSAPublicJWK, alg: RsaAlgorithm): boolean {
    const crypto = require('crypto');
    const pem = new PKCS1.Public(jwk).encode('pem');
    const sigBuf = Buffer.from(signature, 'base64');
    const hashAlg = signatureAlgorithmMap[alg].alg.replace(/-/g, ''); // SHA256, SHA384, or SHA512
    const verified = crypto.verify(hashAlg, compareTo, pem, sigBuf);
    return verified;
  }
}

export default new Verifier();