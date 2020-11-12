// Ref: https://tools.ietf.org/html/rfc7518#section-3.1
export const signatureAlgorithmMap = {
  HS256: {
    name: 'HMAC',
    alg: 'SHA-256'
  },
  HS384: {
    name: 'HMAC',
    alg: 'SHA-384'
  },
  HS512: {
    name: 'HMAC',
    alg: 'SHA-512'
  },
  RS256: {
    name: 'RSASSA-PKCS1-v1_5',
    alg: 'SHA-256'
  },
  RS384: {
    name: 'RSASSA-PKCS1-v1_5',
    alg: 'SHA-384'
  },
  RS512: {
    name: 'RSASSA-PKCS1-v1_5',
    alg: 'SHA-512'
  },
  ES256: {
    name: 'ECDSA',
    curve: 'P-256',
    alg: 'SHA-256'
  },
  ES256K: {
    name: 'ECDSA',
    curve: 'SECP256K1',
    alg: 'SHA-256'
  },
  ES384: {
    name: 'ECDSA',
    curve: 'P-384',
    alg: 'SHA-384'
  },
  ES512: {
    name: 'ECDSA',
    curve: 'P-521',
    alg: 'SHA-512'
  },
  PS256: {
    name: 'RSASSA-PSS',
    alg: 'SHA-256'
  },
  PS384: {
    name: 'RSASSA-PSS',
    alg: 'SHA-384'
  },
  PS512: {
    name: 'RSASSA-PSS',
    alg: 'SHA-512'
  }
};