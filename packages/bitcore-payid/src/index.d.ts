import { JWS } from 'jose';

export interface IVerifyPayId {
  address: string;
  currency: string;
  signature: string;
  protected?: string;
  header?: string | object;
}

export interface GeneralJWS extends JWS.GeneralJWS {}