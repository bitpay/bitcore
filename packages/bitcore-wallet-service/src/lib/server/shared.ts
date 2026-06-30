import { Common } from '../common';
import { ClientError } from '../errors/clienterror';

const { Utils } = Common;

export function checkRequired(obj: any, args: string | string[], cb?: (e: any) => void): boolean {
  const missing = Utils.getMissingFields(obj, args);
  if (!missing.length) {
    return true;
  }

  if (typeof cb === 'function') {
    cb(new ClientError('Required argument: ' + missing[0] + ' missing.'));
  }

  return false;
}

export const UPGRADES = {
  SOL_bwc_$lt_10_10_12: 'SOL:bwc<10.10.12',
  BCH_bwc_$lt_8_3_multisig: 'BCH:bwc<8.3:multisig',
  bwc_$lt_8_4_multisig_purpose48: 'bwc<8.4:multisig:purpose48',
  bwc_$lt_8_17_multisig_p2wsh: 'bwc<8.17:multisig:p2wsh',
  version_$gt_maxTxpVersion: 'version>maxTxpVersion',
  BCH_schnorr: 'BCH:schnorr',
  bwc_$lt_1_2: 'bwc<1.2',
} as const;

export type Upgrade = typeof UPGRADES[keyof typeof UPGRADES];
