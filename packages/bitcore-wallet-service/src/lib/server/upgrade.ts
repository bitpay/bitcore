import { Common } from '../common';
import logger from '../logger';
import { UPGRADES } from './shared';
import type { UpgradeCheckOpts } from '../../types/server';
import type { WalletService } from '../server';

const { Utils } = Common;

type UpgradePath = typeof UPGRADES[keyof typeof UPGRADES];

export function upgradeNeeded(
  paths: UpgradePath | UpgradePath[],
  opts: UpgradeCheckOpts & { clientVersion: string; userAgent: string }
) {
  paths = Array.isArray(paths) ? paths : [paths];
  const chain = opts.chain?.toLowerCase();
  const v = Utils.parseVersion(opts.clientVersion);

  let result: boolean | string = false;
  for (const path of paths) {
    switch (path) {
      case UPGRADES.SOL_bwc_$lt_10_10_12:
        result = (
          chain === 'sol' &&
          v?.agent === 'bwc' &&
          (
            v?.major < 10 ||
            (v?.major == 10 && v?.minor < 10) ||
            (v?.major == 10 && v?.minor == 10 && v?.patch < 12)
          )
        );
        break;
      case UPGRADES.BCH_bwc_$lt_8_3_multisig:
        result = (
          opts.n > 1 &&
          chain === 'bch' &&
          v?.agent === 'bwc' &&
          (
            v?.major < 8 ||
            (v.major == 8 && v?.minor < 3)
          )
        )
          ? 'BWC clients < 8.3 are no longer supported for multisig BCH wallets.'
          : false;
        break;
      case UPGRADES.bwc_$lt_8_4_multisig_purpose48:
        result = (
          opts.n > 1 &&
          opts.usePurpose48 &&
          v?.agent === 'bwc' &&
          (v?.major < 8 || (v.major == 8 && v?.minor < 4))
        );
        break;
      case UPGRADES.bwc_$lt_8_17_multisig_p2wsh:
        result = (
          opts.n > 1 &&
          opts.addressType?.toLowerCase() === 'p2wsh' &&
          v?.agent === 'bwc' &&
          (v?.major < 8 || (v.major == 8 && v?.minor < 17))
        );
        break;
      case UPGRADES.version_$gt_maxTxpVersion:
        result = parseInt(opts.version as string) > parseInt(opts.maxTxpVersion as string);
        break;
      case UPGRADES.BCH_schnorr:
        result = (opts.signingMethod === 'schnorr' && !opts.supportBchSchnorr);
        break;
      case UPGRADES.bwc_$lt_1_2:
        result = (
          v?.agent === 'bwc' &&
          (v?.major == 0 || (v?.major == 1 && v?.minor < 2))
        )
          ? 'BWC clients < 1.2 are no longer supported.'
          : false;
        break;
      default:
        throw new Error('Unknown upgrade path');
    }
    if (result) {
      logger.warn(`Upgrade needed: ${path} | ${opts.clientVersion} | ${opts.userAgent}`);
      break;
    }
  }

  return result;
}

export function getUpgradeNeeded(
  service: WalletService,
  paths: UpgradePath | UpgradePath[],
  opts?: UpgradeCheckOpts
) {
  opts = opts || {};
  const serviceOpts = {
    ...opts,
    clientVersion: service.clientVersion,
    userAgent: service.userAgent
  };
  return upgradeNeeded(paths, serviceOpts);
}
