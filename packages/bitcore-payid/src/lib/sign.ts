import Bitcore from 'bitcore-lib';
import elliptic from 'elliptic';
import hash from 'hash.js';
import { GeneralJWS } from '../index.d';
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

    const keyCurve = new elliptic.ec(jwk.crv);
    const d = Buffer.from(jwk.d, 'base64').toString('hex');
    const privKey = keyCurve.keyFromPrivate(d);

    if (typeof payload === 'object') {
      payload = JSON.stringify(payload);
    }
    const encodedProt = Buffer.from(JSON.stringify(protectedHeader)).toString('base64');

    const toSign = Buffer.concat([
      Buffer.from(encodedProt),
      Buffer.from('.'),
      Buffer.from(payload)
    ]);

    // const toSign = encodedProt + '.' + Buffer.from(payload).toString('base64');
    const toSignHash = hash.sha256().update(toSign).digest();
    let sig = privKey.sign(toSignHash);
    sig = toIEEEP1363(Buffer.from(sig.toDER()), alg);

    const retval: GeneralJWS = {
      payload,
      signatures: [{
        protected: toUrlBase64(encodedProt),
        signature: toUrlBase64(sig)
      }]
    };
    return retval;
  }
}

export default new Signer();