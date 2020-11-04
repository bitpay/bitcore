export interface IVerifyPayId {
  address: string;
  currency: string;
  signature: string;
  protected?: string;
  header?: string | object;
}

// These are hacks to get around PayId's unnecessary JWK type finickiness.
// I may do a PR to PayId's repo to fix this to ensure proper type compatibility with future versions of the dependency.
//   For example, the toKey function is an incomplete type/interface proxy for jose's JWK.asKey. toKey doesn't allow strings or buffers, but asKey does.
//   GeneralJWS is an interface that ideally should be exported from PayId so we don't need to add jose just for the interface
export interface GeneralJWS {
  payload: string;
  signatures: [{
    header?: string;
    protected: string;
    signature: string;
  }]
}

export type SupportedCurves = 'secp256k1' | 'ed25519';
export interface JWK {
  kty: 'EC' | 'RSA' | 'OKP';
  kid?: string;
  use?: 'sig';
  key_ops?: [string];
  crv?: SupportedCurves;
  // ec
  d?: string;
  x?: string;
  y?: string;

  // rsa (also uses d above)
  n?: string;
  e?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
  length?: number;

  private: boolean;
  public: boolean;
}

export type ASN1Encoding = any;