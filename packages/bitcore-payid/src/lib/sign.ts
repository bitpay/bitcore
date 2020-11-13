import elliptic from 'elliptic';
import hash from 'hash.js';
import { UNSUPPPORTED_KEY_TYPE } from '../errors';
import { Algorithm, EcAlgorithm, ECPrivateJWK, EdDSAPrivateJWK, GeneralJWS, PrivateJWK, RsaAlgorithm, RSAPrivateJWK, SlickJWK } from '../index.d';
import { inBrowser } from '../lib/utils';
import { signatureAlgorithmMap } from './helpers/converters/algorithm';
import { toUrlBase64 } from './helpers/converters/base64';
import { toIEEEP1363 } from './helpers/converters/der';
import PKCS1 from './helpers/keys/rsa';

class Signer {
  constructor() {}

  async sign(payload: string | object, jwk: PrivateJWK, alg?: Algorithm): Promise<GeneralJWS> {
    if (!alg) {
      alg = jwk.getDefaultSigningAlgorithm();
    }
    const pubJwk: SlickJWK = jwk.toPublic().toJSON();
    const protectedHeader = {
      name: 'identityKey',
      alg,
      typ: 'JOSE+JSON',
      b64: false,
      crit: ['b64', 'name'],
      jwk: pubJwk,
    };

    if (typeof payload === 'object') {
      payload = JSON.stringify(payload);
    }
    const encodedProt = toUrlBase64(Buffer.from(JSON.stringify(protectedHeader)));

    const toSign = Buffer.concat([
      Buffer.from(encodedProt),
      Buffer.from('.'),
      Buffer.from(payload)
    ]);

    let sig;
    switch (jwk.kty) {
      case 'EC':
        sig = this._signEC(toSign, jwk as ECPrivateJWK, alg as EcAlgorithm);
        break;
      case 'OKP':
        sig = this._signEdDSA(toSign, jwk as EdDSAPrivateJWK);
        break;
      case 'RSA':
        sig = await this._signRSA(toSign, jwk as RSAPrivateJWK, alg as RsaAlgorithm);
        break;
      default:
        throw new Error(UNSUPPPORTED_KEY_TYPE);
    }

    const retval: GeneralJWS = {
      payload,
      signatures: [{
        protected: encodedProt,
        signature: toUrlBase64(sig)
      }]
    };
    return retval;
  }

  private _signEC(toSign: Buffer, jwk: ECPrivateJWK, alg: EcAlgorithm): Buffer {
    const keyCurve = new elliptic.ec(jwk.crv);
    const d = Buffer.from(jwk.d, 'base64').toString('hex');
    const privKey = keyCurve.keyFromPrivate(d);

    const toSignHash = hash.sha256().update(toSign).digest();
    let sig = privKey.sign(toSignHash);
    sig = Buffer.from(sig.toDER());
    sig = toIEEEP1363(sig, alg);
    return sig;
  }

  private _signEdDSA(toSign: Buffer, jwk: EdDSAPrivateJWK): Buffer {
    const eddsa = new elliptic.eddsa(jwk.crv).keyFromSecret(jwk.d);
    let sig = eddsa.sign(toSign);
    sig = Buffer.from(sig.toBytes()); // Already in IEEE-P1363 format
    return sig;
  }

  private async _signRSA(toSign: Buffer, jwk: RSAPrivateJWK, alg: RsaAlgorithm): Promise<Buffer> {
    let sig: Buffer;
    if (inBrowser()) {
      sig = await this._signInBrowserRSA(toSign, jwk, alg);
    } else {
      sig = this._signNodeRSA(toSign, jwk, alg);
    }
    return sig;
  }

  private async _signInBrowserRSA(toSign: Buffer, jwk: RSAPrivateJWK, alg: RsaAlgorithm): Promise<Buffer> {
    const algorithm = signatureAlgorithmMap[alg];
    const key = await window.crypto.subtle.importKey('jwk', jwk.toJSON(), { name: algorithm.name, hash: algorithm.alg }, false, ['sign']);
    const sig = await window.crypto.subtle.sign(algorithm.name, key, toSign);
    return Buffer.from(sig);
  }

  private _signNodeRSA(toSign: Buffer, jwk: RSAPrivateJWK, alg: RsaAlgorithm): Buffer {
    const crypto = require('crypto');
    const pem = new PKCS1.Private(jwk).encode('pem');
    const hashAlg = signatureAlgorithmMap[alg].alg.replace(/-/g, ''); // SHA256, SHA384, or SHA512
    let sig = crypto.sign(hashAlg, toSign, pem);
    return sig;
  }
}

export default new Signer();