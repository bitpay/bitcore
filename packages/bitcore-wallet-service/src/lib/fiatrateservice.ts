import * as async from 'async';
import _ from 'lodash';
import * as request from 'request';
import { Common } from './common';
import { providers } from './fiatrateproviders';
import { Storage } from './storage';

const $ = require('preconditions').singleton();
const Defaults = Common.Defaults;
const Constants = Common.Constants;
import logger from './logger';
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
          logger.error('%o', err);
        }
        return cb(err);
      }
    );
  }

  startCron(opts, cb) {
    opts = opts || {};

    this.providers = providers;
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
    const coins = Object.values(Constants.BITPAY_SUPPORTED_COINS);
    const provider = this.providers[0];

    async.each(
      coins,
      (coin, next2) => {
        this._retrieve(provider, coin, (err, res) => {
          if (err) {
            logger.warn('Error retrieving data for %o: %o', provider.name + coin, err);
            return next2();
          }
          this.storage.storeFiatRate(coin, res, err => {
            if (err) {
              logger.warn('Error storing data for %o: %o', provider.name, err);
            }
            return next2();
          });
        });
      },
      cb
    );
  }

  _retrieve(provider, coin, cb) {
    logger.debug(`Fetching data for ${provider.name} / ${coin}`);
    const coinUC = coin.toUpperCase();

    const handleCoinsRates = (err, res) => {
      if (err || !res) {
        return cb(err);
      }

      logger.debug(`Data for ${provider.name} / ${coin} fetched successfully`);

      if (!provider.parseFn) {
        return cb(new Error('No parse function for provider ' + provider.name));
      }
      try {
        const rates = provider.parseFn(res)?.filter(x => Defaults.FIAT_CURRENCIES.some(c => c.code == x.code)) || [];
        return cb(null, rates);
      } catch (e) {
        return cb(e);
      }
    };

    const ts = Date.now();
    if (Constants.BITPAY_USD_STABLECOINS[coinUC]) {
      return this.getRatesForStablecoin({ code: 'USD', ts }, handleCoinsRates);
    }

    if (Constants.BITPAY_EUR_STABLECOINS[coinUC]) {
      return this.getRatesForStablecoin({ code: 'EUR', ts }, handleCoinsRates);
    }
    this.request.get(
      {
        url: provider.getUrl(coinUC),
        json: true
      },
      (err, res, body) => handleCoinsRates(err, body)
    );
  }

  getRate(opts, cb) {
    $.shouldBeFunction(cb, 'Failed state: type error (cb not a function) at <getRate()>');

    opts = opts || {};

    const now = Date.now();
    let coin = opts.coin || 'btc';
    //    const provider = opts.provider || this.defaultProvider;
    const ts = _.isNumber(opts.ts) || _.isArray(opts.ts) ? opts.ts : now;

    async.map(
      [].concat(ts),
      (ts, cb) => {
        if (coin === 'wbtc') {
          logger.info('Using btc for wbtc rate.');
          coin = 'btc';
        }
        this.storage.fetchFiatRate(coin, opts.code, ts, (err, rate) => {
          if (err) return cb(err);
          if (rate && ts - rate.ts > Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME * 60 * 1000) rate = null;

          return cb(null, {
            ts: +ts,
            rate: rate?.value,
            fetchedOn: rate?.ts
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

    const now = Date.now();
    const ts = opts.ts ? opts.ts : now;
    let fiatFiltered = [];
    let rates = [];

    if (opts.code) {
      fiatFiltered = _.filter(Defaults.FIAT_CURRENCIES, ['code', opts.code]);
      if (!fiatFiltered.length) return cb(opts.code + ' is not supported');
    }
    const currencies: { code: string; name: string }[] = fiatFiltered.length ? fiatFiltered : Defaults.FIAT_CURRENCIES;

    async.map(
      _.values(Constants.BITPAY_SUPPORTED_COINS),
      (coin, cb) => {
        rates[coin] = [];
        async.map(
          currencies,
          (currency, cb) => {
            let c = coin.split('_')[0];
            if (coin === 'wbtc_e' || coin === 'wbtc_m') {
              logger.info('Using btc for wbtc rate.');
              c = 'btc';
            }
            this.storage.fetchFiatRate(c, currency.code, ts, (err, rate) => {
              if (err) return cb(err);
              if (rate && ts - rate.ts > Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME * 60 * 1000) rate = null;
              return cb(null, {
                ts: +ts,
                rate: rate?.value,
                fetchedOn: rate?.ts,
                code: currency.code,
                name: currency.name
              });
            });
          },
          (err, res: any) => {
            if (err) return cb(err);
            var obj = {};
            obj[coin] = res;
            return cb(null, obj);
          }
        );
      },
      (err, res: any) => {
        if (err) return cb(err);
        return cb(null, Object.assign({}, ...res));
      }
    );
  }

  getRatesByCoin(opts, cb) {
    $.shouldBeFunction(cb, 'Failed state: type error (cb not a function) at <getRatesByCoin()>');

    let { coin, code } = opts;
    const ts = opts.ts || Date.now();

    if (Constants.BITPAY_USD_STABLECOINS[coin.toUpperCase()]) {
      return this.getRatesForStablecoin({ code: 'USD', ts }, cb);
    }

    if (Constants.BITPAY_EUR_STABLECOINS[coin.toUpperCase()]) {
      return this.getRatesForStablecoin({ code: 'EUR', ts }, cb);
    }

    let fiatFiltered = [];

    if (code) {
      fiatFiltered = _.filter(Defaults.FIAT_CURRENCIES, ['code', opts.code]);
      if (!fiatFiltered.length) return cb(opts.code + ' is not supported');
    }

    const currencies: { code: string; name: string }[] = fiatFiltered.length ? fiatFiltered : Defaults.FIAT_CURRENCIES;

    async.map(
      currencies,
      (currency, cb) => {
        if (coin === 'wbtc') {
          logger.info('Using btc for wbtc rate.');
          coin = 'btc';
        }
        this.storage.fetchFiatRate(coin, currency.code, ts, (err, rate) => {
          if (err) return cb(err);
          if (rate && ts - rate.ts > Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME * 60 * 1000) rate = null;
          return cb(null, {
            ts: +ts,
            rate: rate?.value,
            fetchedOn: rate?.ts,
            code: currency.code,
            name: currency.name
          });
        });
      },
      cb
    );
  }

  getHistoricalRates(opts, cb) {
    $.shouldBeFunction(cb);

    opts = opts || {};
    const historicalRates = {};

    // Oldest date in timestamp range in epoch number ex. 24 hours ago
    const now = Date.now() - Defaults.FIAT_RATE_FETCH_INTERVAL * 60 * 1000;
    const ts = _.isNumber(opts.ts) ? opts.ts : now;
    const coins = ['btc', 'bch', 'eth', 'matic', 'xrp', 'doge', 'ltc', 'shib', 'ape'];

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

  /**
   * @description calculates fiat rates for a stablecoin
   * @param {String} [opts.coin] crypto to base the fiat rates on (defaults to 'btc')
   * @param {String} opts.code code for fiat currency that the stablecoin is pegged to
   * @param {Number} [opts.ts] timestamp (defaults to now)
   * @param {Function} cb
   */
  getRatesForStablecoin(opts, cb) {
    $.shouldBeFunction(cb, 'Failed state: type error (cb not a function) at <getRatesForStablecoin()>');

    const { coin = 'btc', code } = opts;
    const ts = opts.ts || Date.now();

    this.getRatesByCoin({ coin, ts }, (err, rates) => {
      if (err) return cb(err);

      const fiatRate = rates.find(rate => rate.code === code);
      if (!fiatRate || !fiatRate.rate) return cb(null, []);

      return cb(
        null,
        rates.map(({ rate, ...obj }) => ({
          ...obj,
          rate: parseFloat((rate / fiatRate.rate).toFixed(2))
        }))
      );
    });
  }
}
