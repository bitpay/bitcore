import hash from 'hash.js';
import { JWK_INVALID_KEY_TYPE } from '../../../../src/errors';
import { Algorithm, JWK } from '../../../index.d';
import { toUrlBase64 } from '../converters/base64';

const pubMembers = {
  EC: ['x', 'y'],
  OKP: ['x'],
  RSA: ['e', 'n']
};

const privMembers = {
  EC: ['d'],
  OKP: ['d'],
  RSA: ['d', 'p', 'q', 'dp', 'dq', 'qi']
};

const baseMembers = {
  EC: ['crv'],
  OKP: ['crv'],
  RSA: []
};

const universalMembers = ['kty', 'kid', 'key_ops', 'length'];

class JsonWebKey {
  kty = undefined;
  kid = undefined;
  use: 'sig' = 'sig';
  key_ops = undefined;
  crv = undefined;
  length = undefined;
  private = undefined;
  get public(): boolean { return !this.private; } // Don't need to worry about symmetric keys

  d = undefined;
  x = undefined;
  y = undefined;

  e = undefined;
  n = undefined;
  p = undefined;
  q = undefined;
  dp = undefined;
  dq = undefined;
  qi = undefined;

  constructor(key: JWK, domain: 'private' | 'public') {
    if (pubMembers[key.kty] === undefined) {
      throw new Error(JWK_INVALID_KEY_TYPE);
    }

    // For safety, assume a public key if domain !== private
    this.private = domain === 'private';

    for (let i of universalMembers) {
      this[i] = key[i];
    }

    const expectedMembers = baseMembers[key.kty].concat(pubMembers[key.kty], this.private ? privMembers[key.kty] : []);
    for (let i of expectedMembers) {
      this[i] = key[i] || null; // Set omitted expected member to null
    }

  }

  toPublic() {
    if (this.public) {
      return this;
    }

    const key = {};
    for (let i of this._getMembers(false)) {
      key[i] = this[i];
    }
    return new JsonWebKey(key as JWK, 'public');
  }

  toJSON() {
    const json = {};
    for (let i of this._getMembers(true)) {
      json[i] = this[i];
    }

    return json;
  }

  getDefaultSigningAlgorithm(): Algorithm {
    switch (this.kty) {
      case 'RSA':
      default:
        return 'RS512';
      case 'EC':
        return 'ES256K';
      case 'OKP':
        return 'EdDSA'; // EdDSA is unique and is the only use case for OKP right now.
    }
  }

  private _getMembers(includePrivate: boolean = false, all: boolean = true) {
    return [
      ...baseMembers[this.kty],
      ...pubMembers[this.kty],
      ...(all ? universalMembers : []),
      ...(this.private && includePrivate ? privMembers[this.kty] : [])
    ];
  }

  /**
   * Get JWK thumbprint
   * @param enc (Optional) Encoding for thumbprint. Default: hex
   */
  getThumbprint(enc: BufferEncoding = 'hex') {
    let members = this._getMembers(false, false);
    members.push('kty');
    members = members.sort((a, b) => a > b ? 1 : a < b ? -1 : 0);

    const thumbprint = {};

    for (let m of members) {
      thumbprint[m] = this[m];
    }
    const tpBuf = Buffer.from(JSON.stringify(thumbprint));
    const tpHash = hash.sha256().update(tpBuf).digest();

    if (enc === 'base64') {
      return toUrlBase64(Buffer.from(tpHash));
    }
    return Buffer.from(tpHash).toString(enc);
  }
}

export default JsonWebKey;
