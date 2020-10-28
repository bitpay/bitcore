import Bitcore from 'bitcore-lib';
import elliptic from 'elliptic';
import hash from 'hash.js';
import { Algorithm, toIEEEP1363 } from './converters/der';
import { encodeBase64 } from './utils';

class Signer {
  constructor() {}

  sign(payload: string | object, alg: Algorithm, jwk) {
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
    sig = toIEEEP1363(Buffer.from(sig.toDER()), alg).toString('base64');

    const retval = {
      payload,
      signatures: [{
        protected: encodedProt,
        signature: encodeBase64(sig)
      }]
    };
    return retval;
  }
}

export default new Signer();