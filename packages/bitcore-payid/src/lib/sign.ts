import elliptic from 'elliptic';
import hash from 'hash.js';
import { UNSUPPPORTED_KEY_TYPE } from '../errors';
import { Algorithm, ECPrivateJWK, EdDSAPrivateJWK, GeneralJWS, PrivateJWK, RSAPrivateJWK, SlickJWK } from '../index.d';
import { inBrowser } from '../lib/utils';
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
        sig = this._signEC(toSign, jwk as ECPrivateJWK, alg);
        break;
      case 'OKP':
        sig = this._signEdDSA(toSign, jwk as EdDSAPrivateJWK);
        break;
      case 'RSA':
        sig = await this._signRSA(toSign, jwk as RSAPrivateJWK);
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

  private _signEC(toSign: Buffer, jwk: ECPrivateJWK, alg: Algorithm): Buffer {
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

  private async _signRSA(toSign: Buffer, jwk: RSAPrivateJWK): Promise<Buffer> {
    let sig: Buffer;
    if (inBrowser()) {
      sig = await this._signInBrowserRSA(toSign, jwk);
    } else {
      sig = this._signNodeRSA(toSign, jwk);
    }
    return sig;
  }

  private async _signInBrowserRSA(toSign: Buffer, jwk: RSAPrivateJWK): Promise<Buffer> {
    const key = await window.crypto.subtle.importKey('jwk', jwk.toJSON(), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = await window.crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, toSign);
    return Buffer.from(sig);
  }

  private _signNodeRSA(toSign: Buffer, jwk: RSAPrivateJWK): Buffer {
    const crypto = require('crypto');
    const pem = new PKCS1.Private(jwk).encode('pem');
    const key = crypto.createPrivateKey(pem);
    let sig = crypto.sign('SHA512', toSign, { key, dsaEncoding: 'der' });
    return sig;
  }
}

export default new Signer();