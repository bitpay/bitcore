import Uuid from 'uuid';
import { Errors } from '../errors/errordefinitions';
import { Advertisement } from '../model';
import { checkRequired } from './shared';
import type { WalletService } from '../server';

type Callback = (err?: any, data?: any) => void;

export function createAdvert(service: WalletService, opts, cb: Callback) {
  opts = opts ? { ...opts } : {};

  if (!checkRequired(opts, ['title'], cb)) {
    return;
  }

  const checkIfAdvertExistsAlready = (adId, next: Callback) => {
    service.storage.fetchAdvert(opts.adId, (err, result) => {
      if (err) return next(err);

      if (result) {
        return next(Errors.AD_ALREADY_EXISTS);
      }

      const advert = new Advertisement();
      advert.advertisementId = opts.advertisementId || Uuid.v4();
      advert.name = opts.name;
      advert.title = opts.title;
      advert.country = opts.country;
      advert.type = opts.type;
      advert.body = opts.body;
      advert.imgUrl = opts.imgUrl;
      advert.linkText = opts.linkText;
      advert.linkUrl = opts.linkUrl;
      advert.isAdActive = opts.isAdActive;
      advert.dismissible = opts.dismissible;
      advert.signature = opts.signature;
      advert.app = opts.app;
      advert.isTesting = opts.isTesting;

      return next(null, advert);
    });
  };

  service._runLocked(
    cb,
    next => {
      checkIfAdvertExistsAlready(opts.adId, (err, advert) => {
        if (err) throw err;
        if (advert) {
          service.storage.storeAdvert(advert, next);
        }
      });
    },
    10 * 1000
  );
}

export function getAdvert(service: WalletService, opts, cb: Callback) {
  service.storage.fetchAdvert(opts.adId, (err, advert) => {
    if (err) return cb(err);
    return cb(null, advert);
  });
}

export function getAdverts(service: WalletService, _opts, cb: Callback) {
  service.storage.fetchActiveAdverts((err, adverts) => {
    if (err) return cb(err);
    return cb(null, adverts);
  });
}

export function getAdvertsByCountry(service: WalletService, opts, cb: Callback) {
  service.storage.fetchAdvertsByCountry(opts.country, (err, adverts) => {
    if (err) return cb(err);
    return cb(null, adverts);
  });
}

export function getTestingAdverts(service: WalletService, _opts, cb: Callback) {
  service.storage.fetchTestingAdverts((err, adverts) => {
    if (err) return cb(err);
    return cb(null, adverts);
  });
}

export function getAllAdverts(service: WalletService, opts, cb: Callback) {
  service._runLocked(cb, next => {
    service.getAllAdverts(opts, next);
  });
}

export function removeAdvert(service: WalletService, opts, cb: Callback) {
  opts = opts ? { ...opts } : {};

  if (!checkRequired(opts, ['adId'], cb)) {
    throw new Error('adId is missing');
  }

  const checkIfAdvertExistsAlready = (adId, next: Callback) => {
    service.storage.fetchAdvert(opts.adId, (err, result) => {
      if (err) return next(err);

      if (!result) {
        throw new Error('Advertisement does not exist: ' + opts.adId);
      }

      service.logw('Advert already exists:', opts.adId);
      return next(null, adId);
    });
  };

  service._runLocked(
    cb,
    next => {
      checkIfAdvertExistsAlready(opts.adId, (err, adId) => {
        if (err) throw err;
        service.storage.removeAdvert(adId, next);
      });
    },
    10 * 1000
  );
}

export function activateAdvert(service: WalletService, opts, cb: Callback) {
  opts = opts ? { ...opts } : {};
  if (!checkRequired(opts, ['adId'], cb)) {
    throw new Error('adId is missing');
  }

  service.storage.activateAdvert(opts.adId, (err, result) => {
    if (err) return cb(err);
    return cb(null, result);
  });
}

export function deactivateAdvert(service: WalletService, opts, cb: Callback) {
  opts = opts ? { ...opts } : {};
  if (!checkRequired(opts, ['adId'], cb)) {
    throw new Error('adId is missing');
  }

  service.storage.deactivateAdvert(opts.adId, (err, result) => {
    if (err) return cb(err);
    return cb(null, result);
  });
}
