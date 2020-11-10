import BN from 'bn.js';

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

/** Base Keys */
export namespace BaseKey {
  export interface RSAPublic {
    n: string;
    e: string;
  }

  export interface RSAPrivate extends RSAPublic {
    d: string;
    p: string;
    q: string;
    dp: string;
    dq: string;
    qi: string;
  }

  export interface ECPublic {
    x: string;
    y: string;
  }

  export interface ECPrivate extends ECPublic {
    d: string;  
  }

  export interface EdDSAPublic {
    x: string;
  }
  export interface EdDSAPrivate extends EdDSAPublic {
    d: string;
  }
}


/** JWK */
export interface JWK {
  kty: 'EC' | 'RSA' | 'OKP';
  kid?: string;
  use?: 'sig';
  key_ops?: [string];
  crv?: SupportedCurves;
  length?: number;
  version?: BN;
}

/** Base JWKs (without added methods) */
export namespace BaseJWK {
  export interface RSAPublic extends JWK, BaseKey.RSAPublic {}
  export interface RSAPrivate extends JWK, BaseKey.RSAPrivate {}

  export interface ECPublic extends JWK, BaseKey.ECPublic {}
  export interface ECPrivate extends JWK, BaseKey.ECPrivate {}

  export interface EdDSAPublic extends JWK, BaseKey.EdDSAPublic {}
  export interface EdDSAPrivate extends JWK, BaseKey.EdDSAPrivate {}
}

export type SlickJWK = BaseJWK.ECPrivate | BaseJWK.ECPublic | BaseJWK.EdDSAPrivate | BaseJWK.EdDSAPublic | BaseJWK.RSAPrivate | BaseJWK.RSAPublic;
export interface AllBaseJWK extends BaseJWK.ECPrivate, BaseJWK.ECPublic, BaseJWK.EdDSAPrivate, BaseJWK.EdDSAPublic, BaseJWK.RSAPrivate, BaseJWK.RSAPublic {}

export interface PrivateJWK extends JWK {
  private: boolean;
  public: boolean;
  toPublic(): PublicJWK;
  toJSON()
}
export interface PublicJWK extends JWK {
  toJSON()
}

/** Full JWK key types */
export interface RSAPublicJWK extends PublicJWK, BaseKey.RSAPublic {}
export interface RSAPrivateJWK extends PrivateJWK, BaseKey.RSAPrivate {}

export interface ECPublicJWK extends PublicJWK, BaseKey.ECPublic {}
export interface ECPrivateJWK extends PrivateJWK, BaseKey.ECPrivate {}

export interface EdDSAPublicJWK extends PublicJWK, BaseKey.EdDSAPublic {}
export interface EdDSAPrivateJWK extends PrivateJWK, BaseKey.EdDSAPrivate {}


/** Misc key stuff */
export type ASN1Encoding = 'der' | 'pem';
export type PublicKeyFromat = 'PKCS1' | 'SPKI';
export type PrivateKeyFormat = 'PKCS1' | 'PKCS8' | 'SEC1';
export type KeyFormat = PublicKeyFromat | PrivateKeyFormat;
