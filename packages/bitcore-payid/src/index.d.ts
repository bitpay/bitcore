import BN from 'bn.js';
import SEC1 from './lib/helpers/keys/ec';
import SPKI from './lib/helpers/keys/public';
import * as PKCS1 from './lib/helpers/keys/rsa';
import PKCS8 from './lib/helpers/keys/private';

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

export interface IAddress {
  paymentNetwork: string,
  environment: string,
  addressDetailsType: 'CryptoAddressDetails',
  addressDetails: {
    address: string;
  }
}

export interface ISigningPayload {
  payId: string;
  payIdAddress: IAddress;
}

export type SupportedCurves = 'secp256k1' | 'Ed25519';

/** ASN1 Formats */

export interface ASN1<T> {
  decode(data: string | Buffer, enc: ASN1Encoding, options?: Object): T;
  encode(data: T, enc: ASN1Encoding, options?: Object): Buffer;
}

export interface ASN1Attributes<T> {
  type: string;
  curve?: T;
}

export interface ASN1AttributesChoice {
  type: 'curve' | 'null',
  value: SupportedCurves | null;
}

export interface Ipkcs8 {
  version: BN;
  attributes: ASN1Attributes<SupportedCurves>;
  privateKey: Buffer | Isec1 | Iokp;
}


export interface Ipksc1Priv {
  version: BN;
  n: BN;
  e: BN;
  d: BN;
  p: BN;
  q: BN;
  dp: BN;
  dq: BN;
  qi: BN;
  other?: any;
}

export interface Ipksc1Pub {
  n: BN;
  e: BN;
}

export interface Ispki {
  attributes: ASN1Attributes<ASN1AttributesChoice>;
  publicKey: {
    data: Buffer;
    unused: number;
  };
}

export interface Isec1 {
  version: BN;
  privateKey: Buffer;
  curve?: SupportedCurves;
  publicKey?: {
    data: Buffer;
    unused: number;
  };
}

export type Iokp = Buffer;

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
  toJSON();
  getDefaultSigningAlgorithm(): Algorithm;
  getThumbprint(enc?: BufferEncoding): string;
}
export interface PublicJWK extends JWK {
  private: boolean;
  public: boolean;
  toJSON();
  getDefaultSigningAlgorithm(): Algorithm;
  getThumbprint(enc?: BufferEncoding): string;
}

/** Full JWK key types */
export interface RSAPublicJWK extends PublicJWK, BaseKey.RSAPublic {}
export interface RSAPrivateJWK extends PrivateJWK, BaseKey.RSAPrivate {}

export interface ECPublicJWK extends PublicJWK, BaseKey.ECPublic {}
export interface ECPrivateJWK extends PrivateJWK, BaseKey.ECPrivate {}

export interface EdDSAPublicJWK extends PublicJWK, BaseKey.EdDSAPublic {}
export interface EdDSAPrivateJWK extends PrivateJWK, BaseKey.EdDSAPrivate {}

export interface KeyConverter {
  new (jwk?: RSAPublicJWK): KeyConverterClass;
}
export interface KeyConverterClass {
  encode?(enc: ASN1Encoding, options?: ASN1Options): Buffer | string;
  decode(data: string | Buffer, enc: ASN1Encoding, options?: Object): PKCS8 | SPKI | SEC1 | PKCS1.Private | PKCS1.Public;
  toJWK(): RSAPublicJWK | RSAPrivateJWK | ECPublicJWK | ECPrivateJWK | EdDSAPublicJWK | EdDSAPrivateJWK;
}

/** Misc key stuff */
export interface ASN1Options { label?: string; }
export type ASN1Encoding = 'der' | 'pem';
export type PublicKeyFromat = 'PKCS1' | 'SPKI';
export type PrivateKeyFormat = 'PKCS1' | 'PKCS8' | 'SEC1';
export type KeyFormat = PublicKeyFromat | PrivateKeyFormat;
export type HmacAlgorithm = 'HS256' | 'HS384' | 'HS512';
export type RsaAlgorithm = 'RS256' | 'RS384' | 'RS512' | 'PS256' | 'PS384' | 'PS512';
export type EcdsaAlgorithm = 'ES256' | 'ES384' | 'ES512'
export type EcAlgorithm = 'ES256K';
export type EddsaAlgorithm = 'EdDSA';
export type Algorithm = HmacAlgorithm | RsaAlgorithm | EcdsaAlgorithm | EcAlgorithm | EddsaAlgorithm;
