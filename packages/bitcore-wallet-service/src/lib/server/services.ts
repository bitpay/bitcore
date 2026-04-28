import config from '../../config';
import { Common } from '../common';
import { ClientError } from '../errors/clienterror';
import { checkRequired } from './shared';
import type { ExternalServicesConfig } from '../../types/externalservices';
import type { WalletService } from '../server';

const { Services } = Common;

type Callback = (err?: any, data?: any) => void;

export function getFiatRate(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['code'], cb)) return;

  service.fiatRateService.getRate(opts, (err, rate) => {
    if (err) return cb(err);
    return cb(null, rate);
  });
}

export function getFiatRates(service: WalletService, opts, cb: Callback) {
  if (isNaN(opts.ts) || Array.isArray(opts.ts)) return cb(new ClientError('Invalid timestamp'));

  service.fiatRateService.getRates(opts, (err, rates) => {
    if (err) return cb(err);
    return cb(null, rates);
  });
}

export function getFiatRatesByCoin(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['coin'], cb)) return;
  if (isNaN(opts.ts) || Array.isArray(opts.ts)) return cb(new ClientError('Invalid timestamp'));

  service.fiatRateService.getRatesByCoin(opts, (err, rate) => {
    if (err) return cb(err);
    return cb(null, rate);
  });
}

export function getHistoricalRates(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['code'], cb)) return;

  service.fiatRateService.getHistoricalRates(opts, (err, rates) => {
    if (err) return cb(err);
    return cb(null, rates);
  });
}

export function getServicesData(_service: WalletService, opts, cb: Callback) {
  const externalServicesConfig: ExternalServicesConfig = structuredClone(config.services);
  const isLoggedIn = !!opts?.bitpayIdLocationCountry;

  const swapUsaBannedStates = ['HI', 'LA', 'NY'];
  if (
    (['US', 'USA'].includes(opts?.bitpayIdLocationCountry?.toUpperCase()) &&
      swapUsaBannedStates.includes(opts?.bitpayIdLocationState?.toUpperCase())) ||
    (!isLoggedIn &&
      ['US', 'USA'].includes(opts?.currentLocationCountry?.toUpperCase()) &&
      swapUsaBannedStates.includes(opts?.currentLocationState?.toUpperCase()))
  ) {
    externalServicesConfig.swapCrypto = {
      ...externalServicesConfig.swapCrypto,
      ...{ disabled: true, disabledMessage: 'Swaps are currently unavailable in your area.' }
    };
  }

  if (opts?.platform?.os === 'ios' && opts?.currentAppVersion === '14.11.5') {
    externalServicesConfig.swapCrypto = {
      ...externalServicesConfig.swapCrypto,
      ...{
        disabled: true,
        disabledTitle: 'Unavailable',
        disabledMessage: 'Swaps are currently unavailable in your area.'
      }
    };
  }

  const buyCryptoUsaBannedStates = ['NY'];
  if (
    (['US', 'USA'].includes(opts?.bitpayIdLocationCountry?.toUpperCase()) &&
      buyCryptoUsaBannedStates.includes(opts?.bitpayIdLocationState?.toUpperCase())) ||
    (!isLoggedIn &&
      ['US', 'USA'].includes(opts?.currentLocationCountry?.toUpperCase()) &&
      buyCryptoUsaBannedStates.includes(opts?.currentLocationState?.toUpperCase()))
  ) {
    externalServicesConfig.buyCrypto = {
      ...externalServicesConfig.buyCrypto,
      ...{
        disabled: true,
        disabledTitle: 'Unavailable',
        disabledMessage: 'This service is currently unavailable in your area.'
      }
    };
  }

  const sellCryptoUsaBannedStates = ['NY'];
  if (
    (['US', 'USA'].includes(opts?.bitpayIdLocationCountry?.toUpperCase()) &&
      sellCryptoUsaBannedStates.includes(opts?.bitpayIdLocationState?.toUpperCase())) ||
    (!isLoggedIn &&
      ['US', 'USA'].includes(opts?.currentLocationCountry?.toUpperCase()) &&
      sellCryptoUsaBannedStates.includes(opts?.currentLocationState?.toUpperCase()))
  ) {
    externalServicesConfig.sellCrypto = {
      ...externalServicesConfig.sellCrypto,
      ...{
        disabled: true,
        disabledTitle: 'Unavailable',
        disabledMessage: 'This service is currently unavailable in your area.'
      }
    };
  }

  return cb(null, externalServicesConfig);
}

export function checkServiceAvailability(_service: WalletService, req): boolean {
  if (!checkRequired(req.body, ['service', 'opts'])) {
    throw new ClientError('checkServiceAvailability request missing arguments');
  }

  let serviceEnabled: boolean;

  switch (req.body.service) {
    case '1inch':
      if (req.body.opts?.country?.toUpperCase() === 'US') {
        serviceEnabled = false;
      } else {
        serviceEnabled = true;
      }
      break;

    default:
      serviceEnabled = true;
      break;
  }

  return serviceEnabled;
}

export function getSpenderApprovalWhitelist(_service: WalletService, cb: Callback) {
  if (Services.ERC20_SPENDER_APPROVAL_WHITELIST) {
    return cb(null, Services.ERC20_SPENDER_APPROVAL_WHITELIST);
  } else {
    return cb(new Error('Could not get ERC20 spender approval whitelist'));
  }
}

export function clearWalletCache(service: WalletService, opts): Promise<boolean> {
  return new Promise(resolve => {
    const cacheKey = service.walletId + (opts.tokenAddress ? '-' + opts.tokenAddress : '');
    service.storage.clearWalletCache(cacheKey, () => {
      resolve(true);
    });
  });
}
