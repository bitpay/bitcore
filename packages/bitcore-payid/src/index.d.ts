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
export type GeneralJWS = any
export type JWK = any 