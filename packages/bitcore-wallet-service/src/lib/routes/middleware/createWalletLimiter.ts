import RateLimit from 'express-rate-limit';
import { Defaults } from '../../common/defaults';
import logger from '../../logger';

let _createWalletLimiter: RateLimit | undefined;

export function createWalletLimiter(opts: { ignoreRateLimiter?: boolean }) {
  opts = opts || {};
  if (opts.ignoreRateLimiter) {
    return function(req, res, next) {
      next();
    };
  } else {
    if (!_createWalletLimiter) {
      const reqPerHour = ((Defaults.RateLimit.createWallet.max / Defaults.RateLimit.createWallet.windowMs) * 60 * 60 * 1000).toFixed(2);
      logger.info('Limiting wallet creation per IP: %o req/h', reqPerHour);
      _createWalletLimiter = new RateLimit(Defaults.RateLimit.createWallet);
    }
    return _createWalletLimiter;
  }
};