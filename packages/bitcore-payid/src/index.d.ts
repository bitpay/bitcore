export interface IVerifyPayId {
  address: string;
  currency: string;
  signature: string;
  protected?: string;
  header?: string | object;
}

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

export type ASN1Encoding = 'der' | 'pem';

export type PublicKeyFromat = 'PKCS1' | 'SPKI';
export type PrivateKeyFormat = 'PKCS1' | 'PKCS8' | 'SEC1';
export type KeyFormat = PublicKeyFromat | PrivateKeyFormat;
