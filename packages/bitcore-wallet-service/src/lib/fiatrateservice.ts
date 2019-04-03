import * as async from 'async';
import _ from 'lodash';
import * as request from 'request';
import { Storage } from './storage';

const $ = require('preconditions').singleton();
const Common = require('./common');
const Defaults = Common.Defaults;
let log = require('npmlog');
log.debug = log.verbose;

export class FiatRateService {
  request: request.RequestAPI<any, any, any>;
  defaultProvider: any;
  providers: any[];
  storage: Storage;
  init(opts, cb) {
    opts = opts || {};

    this.request = opts.request || request;
    this.defaultProvider = opts.defaultProvider || Defaults.FIAT_RATE_PROVIDER;

    async.parallel(
      [
        (done) => {
          if (opts.storage) {
            this.storage = opts.storage;
            done();
          } else {
            this.storage = new Storage();
            this.storage.connect(
              opts.storageOpts,
              done
            );
          }
        }
      ],
      (err) => {
        if (err) {
          log.error(err);
        }
        return cb(err);
      }
    );
  }

  startCron(opts, cb) {
    opts = opts || {};

    this.providers = _.values(require('./fiatrateproviders'));

    const interval = opts.fetchInterval || Defaults.FIAT_RATE_FETCH_INTERVAL;
    if (interval) {
      this._fetch();
      setInterval(() => {
        this._fetch();
      }, interval * 60 * 1000);
    }

    return cb();
  }

  _fetch(cb?) {
    cb = cb || function() { };

    async.each(
      this.providers,
      (provider, next) => {
        this._retrieve(provider, (err, res) => {
          if (err) {
            log.warn('Error retrieving data for ' + provider.name, err);
            return next();
          }
          this.storage.storeFiatRate(provider.name, res, (err) => {
            if (err) {
              log.warn('Error storing data for ' + provider.name, err);
            }
            return next();
          });
        });
      },
      cb
    );
  }

  _retrieve(provider, cb) {
    log.debug('Fetching data for ' + provider.name);
    this.request.get(
      {
        url: provider.url,
        json: true
      },
      (err, res, body) => {
        if (err || !body) {
          return cb(err);
        }

        log.debug('Data for ' + provider.name + ' fetched successfully');

        if (!provider.parseFn) {
          return cb(
            new Error('No parse function for provider ' + provider.name)
          );
        }
        const rates = provider.parseFn(body);

        return cb(null, rates);
      }
    );
  }

  getRate(opts, cb) {
    $.shouldBeFunction(cb);

    opts = opts || {};

    const now = Date.now();
    const provider = opts.provider || this.defaultProvider;
    const ts = _.isNumber(opts.ts) || _.isArray(opts.ts) ? opts.ts : now;

    async.map(
      [].concat(ts),
      (ts, cb) => {
        this.storage.fetchFiatRate(provider, opts.code, ts, (
          err,
          rate
        ) => {
          if (err) return cb(err);
          if (
            rate &&
            ts - rate.ts > Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME * 60 * 1000
          )
            rate = null;

          return cb(null, {
            ts: +ts,
            rate: rate ? rate.value : undefined,
            fetchedOn: rate ? rate.ts : undefined
          });
        });
      },
      (err, res: any) => {
        if (err) return cb(err);
        if (!_.isArray(ts)) res = res[0];
        return cb(null, res);
      }
    );
  }
}
