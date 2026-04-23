import * as async from 'async';
import { Common } from '../common';
import { Errors } from '../errors/errordefinitions';
import { Session } from '../model';
import { UPGRADES, checkRequired } from './shared';
import type { WalletService } from '../server';

const { Utils } = Common;

interface WalletServiceClass {
  new(): WalletService;
  upgradeNeeded(paths, opts);
}

export function getInstance(WalletServiceClass: WalletServiceClass, opts?): WalletService {
  opts = opts || {};

  const upgradeMessage = WalletServiceClass.upgradeNeeded(UPGRADES.bwc_$lt_1_2, opts);
  if (upgradeMessage) {
    throw Errors.UPGRADE_NEEDED.withMessageMaybe(upgradeMessage);
  }

  const service = new WalletServiceClass();
  service._setClientVersion(opts.clientVersion);
  service._setAppVersion(opts.userAgent);
  service.userAgent = opts.userAgent;
  return service;
}

export function getInstanceWithAuth(WalletServiceClass: WalletServiceClass, opts, cb): void {
  const withSignature = cb => {
    if (!checkRequired(opts, ['copayerId', 'message', 'signature'], cb)) {
      return;
    }

    let service: WalletService;
    try {
      service = getInstance(WalletServiceClass, opts);
    } catch (ex) {
      return cb(ex);
    }

    service.storage.fetchCopayerLookup(opts.copayerId, (err, copayer) => {
      if (err) {
        return cb(err);
      }
      if (!copayer) {
        return cb(Errors.NOT_AUTHORIZED.withMessage('Copayer not found'));
      }

      const isValid = !!service._getSigningKey(opts.message, opts.signature, copayer.requestPubKeys);
      if (!isValid) {
        return cb(Errors.NOT_AUTHORIZED.withMessage('Invalid signature'));
      }

      service.walletId = copayer.walletId;

      if (copayer.isSupportStaff) {
        service.walletId = opts.walletId || copayer.walletId;
        service.copayerIsSupportStaff = true;
      }
      if (copayer.isMarketingStaff) {
        service.copayerIsMarketingStaff = true;
      }

      service.copayerId = opts.copayerId;
      return cb(null, service);
    });
  };

  const withSession = cb => {
    if (!checkRequired(opts, ['copayerId', 'session'], cb)) {
      return;
    }

    let service: WalletService;
    try {
      service = getInstance(WalletServiceClass, opts);
    } catch (ex) {
      return cb(ex);
    }

    service.storage.getSession(opts.copayerId, (err, s) => {
      if (err) {
        return cb(err);
      }

      const isValid = s && s.id === opts.session && s.isValid();
      if (!isValid) {
        return cb(Errors.NOT_AUTHORIZED.withMessage('Session expired'));
      }

      service.storage.fetchCopayerLookup(opts.copayerId, (err, copayer) => {
        if (err) {
          return cb(err);
        }
        if (!copayer) {
          return cb(Errors.NOT_AUTHORIZED.withMessage('Copayer not found'));
        }

        service.copayerId = opts.copayerId;
        service.walletId = copayer.walletId;
        return cb(null, service);
      });
    });
  };

  const authFn = opts.session ? withSession : withSignature;
  return authFn(cb);
}

export function login(service: WalletService, _opts, cb) {
  let session;
  async.series(
    [
      next => {
        service.storage.getSession(service.copayerId, (err, s) => {
          if (err) {
            return next(err);
          }
          session = s;
          next();
        });
      },
      next => {
        if (!session || !session.isValid()) {
          session = Session.create({
            copayerId: service.copayerId,
            walletId: service.walletId
          });
        } else {
          session.touch();
        }
        next();
      },
      next => {
        service.storage.storeSession(session, next);
      }
    ],
    err => {
      if (err) {
        return cb(err);
      }
      if (!session) {
        return cb(new Error('Could not get current session for this copayer'));
      }

      return cb(null, session.id);
    }
  );
}

export function logout(_service: WalletService, _opts, _cb) {
  // this.storage.removeSession(this.copayerId, cb);
}

export function setClientVersion(service: WalletService, version) {
  delete service.parsedClientVersion;
  service.clientVersion = version;
}

export function setAppVersion(service: WalletService, userAgent) {
  const parsed = Utils.parseAppVersion(userAgent);
  if (!parsed) {
    service.appName = service.appVersion = null;
  } else {
    service.appName = parsed.app;
    service.appVersion = parsed;
  }
}

export function parseClientVersion(service: WalletService) {
  if (service.parsedClientVersion == null) {
    service.parsedClientVersion = Utils.parseVersion(service.clientVersion);
  }
  return service.parsedClientVersion;
}

export function clientSupportsPayProRefund(service: WalletService) {
  const version = service._parseClientVersion();
  if (!version) return false;
  if (version.agent != 'bwc') return true;
  if (version.major < 1 || (version.major == 1 && version.minor < 2)) return false;
  return true;
}
