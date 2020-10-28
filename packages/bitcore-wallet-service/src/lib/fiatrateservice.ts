import * as async from 'async';
import _ from 'lodash';
import * as request from 'request';
import { Storage } from './storage';

const $ = require('preconditions').singleton();
const Common = require('./common');
const Defaults = Common.Defaults;
import logger from './logger';

const fiatCurrencies = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'GBP', name: 'Pound Sterling' },
  { code: 'EUR', name: 'Eurozone Euro' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'NZD', name: 'New Zealand Dollar' }
];

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
        done => {
          if (opts.storage) {
            this.storage = opts.storage;
            done();
          } else {
            this.storage = new Storage();
            this.storage.connect(opts.storageOpts, done);
          }
        }
      ],
      err => {
        if (err) {
          logger.error(err);
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
    cb = cb || function() {};
    const coins = ['btc', 'bch', 'eth', 'xrp'];
    const provider = this.providers[0];

    //    async.each(this.providers, (provider, next) => {
    async.each(
      coins,
      (coin, next2) => {
        this._retrieve(provider, coin, (err, res) => {
          if (err) {
            logger.warn('Error retrieving data for ' + provider.name + coin, err);
            return next2();
          }
          this.storage.storeFiatRate(coin, res, err => {
            if (err) {
              logger.warn('Error storing data for ' + provider.name, err);
            }
            return next2();
          });
        });
      },
      //        next),
      cb
    );
  }

  _retrieve(provider, coin, cb) {
    logger.debug(`Fetching data for ${provider.name} / ${coin} `);
    this.request.get(
      {
        url: provider.url + coin.toUpperCase(),
        json: true
      },
      (err, res, body) => {
        if (err || !body) {
          return cb(err);
        }

        logger.debug(`Data for ${provider.name} /  ${coin} fetched successfully`);

        if (!provider.parseFn) {
          return cb(new Error('No parse function for provider ' + provider.name));
        }
        try {
          const rates = _.filter(provider.parseFn(body), x => _.some(fiatCurrencies, ['code', x.code]));
          return cb(null, rates);
        } catch (e) {
          return cb(e);
        }
      }
    );
  }

  getRate(opts, cb) {
    $.shouldBeFunction(cb, 'Failed state: type error (cb not a function) at <getRate()>');

    opts = opts || {};

    const now = Date.now();
    const coin = opts.coin || 'btc';
    //    const provider = opts.provider || this.defaultProvider;
    const ts = _.isNumber(opts.ts) || _.isArray(opts.ts) ? opts.ts : now;

    async.map(
      [].concat(ts),
      (ts, cb) => {
        this.storage.fetchFiatRate(coin, opts.code, ts, (err, rate) => {
          if (err) return cb(err);
          if (rate && ts - rate.ts > Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME * 60 * 1000) rate = null;

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

  getRates(opts, cb) {
    $.shouldBeFunction(cb, 'Failed state: type error (cb not a function) at <getRates()>');

    opts = opts || {};
    const rates = [];

    const now = Date.now();
    const coin = opts.coin;
    const ts = opts.ts ? opts.ts : now;
    let fiatFiltered = [];

    if (opts.code) {
      fiatFiltered = _.filter(fiatCurrencies, ['code', opts.code]);
      if (!fiatFiltered.length) return cb(opts.code + ' is not supported');
    }
    const currencies = fiatFiltered.length ? fiatFiltered : fiatCurrencies;

    async.map(
      currencies,
      (currency, cb) => {
        this.storage.fetchFiatRate(coin, currency.code, ts, (err, rate) => {
          if (err) return cb(err);
          if (rate && ts - rate.ts > Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME * 60 * 1000) rate = null;
          rates.push({
            ts: +ts,
            rate: rate ? rate.value : undefined,
            fetchedOn: rate ? rate.ts : undefined,
            code: currency.code,
            name: currency.name
          });
          return cb(null, rates);
        });
      },
      (err, res: any) => {
        if (err) return cb(err);
        return cb(null, res[0]);
      }
    );
  }

  getHistoricalRates(opts, cb) {
    $.shouldBeFunction(cb);

    opts = opts || {};
    const historicalRates = {};

    // Oldest date in timestamp range in epoch number ex. 24 hours ago
    const now = Date.now() - Defaults.FIAT_RATE_FETCH_INTERVAL * 60 * 1000;
    const ts = _.isNumber(opts.ts) ? opts.ts : now;
    const coins = ['btc', 'bch', 'eth', 'xrp'];

    async.map(
      coins,
      (coin: string, cb) => {
        this.storage.fetchHistoricalRates(coin, opts.code, ts, (err, rates) => {
          if (err) return cb(err);
          if (!rates) return cb();
          for (const rate of rates) {
            rate.rate = rate.value;
            delete rate['_id'];
            delete rate['code'];
            delete rate['value'];
            delete rate['coin'];
          }
          historicalRates[coin] = rates;
          return cb(null, historicalRates);
        });
      },
      (err, res: any) => {
        if (err) return cb(err);
        return cb(null, res[0]);
      }
    );
  }
}
