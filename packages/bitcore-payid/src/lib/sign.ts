import Bitcore from 'bitcore-lib';
import elliptic from 'elliptic';
import hash from 'hash.js';
import { UNSUPPPORTED_KEY_TYPE } from '../errors';
import { GeneralJWS, JWK } from '../index.d';
import { toUrlBase64 } from './helpers/converters/base64';
import { Algorithm, toIEEEP1363 } from './helpers/converters/der';

class Signer {
  constructor() {}

  async sign(payload: string | object, alg: Algorithm, jwk): Promise<GeneralJWS> {
    const protectedHeader = {
      name: 'identityKey',
      alg,
      typ: 'JOSE+JSON',
      b64: false,
      crit: ['b64', 'name'],
      jwk,
    };

    if (typeof payload === 'object') {
      payload = JSON.stringify(payload);
    }
    const encodedProt = Buffer.from(JSON.stringify(protectedHeader)).toString('base64');

    const toSign = Buffer.concat([
      Buffer.from(encodedProt),
      Buffer.from('.'),
      Buffer.from(payload)
    ]);

    let sig;
    switch (jwk.kty) {
      case 'EC':
        sig = this._signEC(toSign, jwk, alg);
        break;
      case 'OKP':
        sig = this._signEDDSA(toSign, jwk);
        break;
      case 'RSA':
        sig = await this._signRSA(toSign, jwk);
        break;
      default:
        throw new Error(UNSUPPPORTED_KEY_TYPE);
    }

    const retval: GeneralJWS = {
      payload,
      signatures: [{
        protected: toUrlBase64(encodedProt),
        signature: toUrlBase64(sig)
      }]
    };
    return retval;
  }

  private _signEC(toSign: Buffer, jwk: JWK, alg: Algorithm): Buffer {
    const keyCurve = new elliptic.ec(jwk.crv);
    const d = Buffer.from(jwk.d, 'base64').toString('hex');
    const privKey = keyCurve.keyFromPrivate(d);

    const toSignHash = hash.sha256().update(toSign).digest();
    let sig = privKey.sign(toSignHash);
    sig = toIEEEP1363(Buffer.from(sig.toDER()), alg);
    return sig;
  }

  private _signEDDSA(toSign: Buffer, jwk: JWK): Buffer {
    const eddsa = new elliptic.eddsa(jwk.crv).keyFromSecret(jwk.d);
    let sig = eddsa.sign(toSign);
    sig = Buffer.from(sig.toBytes());
    return sig;
  }

  private async _signRSA(toSign: Buffer, jwk: JWK): Promise<Buffer> {
    const key = await window.crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    let sig = await window.crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, toSign);
    return Buffer.from(sig);
  }
}

export default new Signer();