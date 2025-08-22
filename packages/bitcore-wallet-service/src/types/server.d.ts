export interface UpgradeCheckOpts {
  chain?: string;
  network?: string;
  n?: number;
  usePurpose48?: boolean;
  addressType?: string;
  maxTxpVersion?: number | string;
  version?: number | string;
  signingMethod?: string;
  supportBchSchnorr?: boolean;
}