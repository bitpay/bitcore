import { Algorithm, JWK } from '../../../index.d';

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

const universalMembers = ['kty', 'kid', 'use', 'key_ops', 'crv', 'length'];

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
    for (let i in key) {
      this[i] = key[i];
    }
    this.private = domain === 'private';
  }

  toPublic() {
    if (this.public) {
      return this;
    }

    let pubs = pubMembers[this.kty];
    const key = {};
    const allMembers = [...universalMembers, ...pubs];
    for (let i of allMembers) {
      key[i] = this[i];
    }
    return new JsonWebKey(key as JWK, 'public');
  }

  toJSON() {
    const json = {};
    let allMembers = [...universalMembers, ...pubMembers[this.kty]];
    if (this.private) {
      allMembers = allMembers.concat(privMembers[this.kty]);
    }
    for (let i of allMembers) {
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
        return 'HS256';
    }
  }
}

export default JsonWebKey;
