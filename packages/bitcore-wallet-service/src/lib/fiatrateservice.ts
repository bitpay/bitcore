import * as async from 'async';
import _, { countBy, reject } from 'lodash';
import * as request from 'request';
import { Storage } from './storage';

const $ = require('preconditions').singleton();
const Common = require('./common');
const Defaults = Common.Defaults;
const Constants = Common.Constants;
const config = require('../config');
const Bitcore = require('@bcpros/bitcore-lib');

const ELECTRICITY_RATE = config.fiatRateServiceOpts.lotusFormula.ELECTRICITY_RATE;
const MINER_MARGIN = config.fiatRateServiceOpts.lotusFormula.MINER_MARGIN;
const RIG_HASHRATE = config.fiatRateServiceOpts.lotusFormula.RIG_HASHRATE;
const RIG_POWER = config.fiatRateServiceOpts.lotusFormula.RIG_POWER;
const MINING_EFFICIENCY = RIG_HASHRATE / RIG_POWER;

import { BlockChainExplorer } from './blockchainexplorer';
import logger from './logger';
import { EtokenSupportPrice } from './model/config-model';
export class FiatRateService {
  request: request.RequestAPI<any, any, any>;
  defaultProvider: any;
  cryptoCompareApiKey: string = '';
  providers: any[];
  storage: Storage;
  init(opts, cb) {
    opts = opts || {};

    this.request = opts.request || request;
    this.defaultProvider = opts.defaultProvider || Defaults.FIAT_RATE_PROVIDER;
    this.cryptoCompareApiKey = opts.cryptoCompareApiKey;

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

  async handleRateCurrencyCoin(res, listRate) {
    let newData = [];
    const valueUsd = _.get(
      _.find(res, item => item.code == 'USD'),
      'value',
      0
    );
    return new Promise((resolve, reject) => {
      _.forEach(listRate, (rate: any) => {
        newData.push({
          code: rate.code,
          value: valueUsd * rate.value
        });
      });
      return resolve(newData);
    });
  }

  _getProviderRate(coin) {
    let nameProvider = this.defaultProvider;
    const etoken = this._getEtokenSupportPrice();
    if (coin == 'xpi') {
      nameProvider = 'LotusExbitron';
    } else if (_.includes(etoken, coin)) {
      nameProvider = 'EtokenPrice';
    } else {
      nameProvider = this.defaultProvider;
    }
    return _.find(this.providers, provider => provider.name === nameProvider);
  }

  getLatestCurrencyRates(opts): Promise<any> {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const ts = opts.ts ? opts.ts : now;
      let fiatFiltered = [];
      let rates = [];

      if (opts.code) {
        fiatFiltered = _.filter(Defaults.FIAT_CURRENCIES, ['code', opts.code]);
        if (!fiatFiltered.length) return reject(opts.code + ' is not supported');
      }
      const currencies: { code: string; name: string }[] = fiatFiltered.length
        ? fiatFiltered
        : Defaults.SUPPORT_FIAT_CURRENCIES;
      const promiseList = [];
      _.forEach(currencies, currency => {
        promiseList.push(this._getCurrencyRate(currency.code, ts));
      });
      Promise.all(promiseList).then(listRate => {
        return resolve(listRate);
      });
    });
  }

  _getCurrencyRate(code, ts): Promise<any> {
    return new Promise((resolve, reject) => {
      this.storage.fetchCurrencyRates(code, ts, async (err, res) => {
        if (err) {
          logger.warn('Error fetching data for ' + code, err);
        }
        return resolve(res);
      });
    });
  }
  _getEtokenSupportPrice() {
    const etokenSupportPrice = _.get(config, 'etoken.etokenSupportPrice', undefined);
    if (!etokenSupportPrice) return [];
    return _.map(etokenSupportPrice, 'coin');
  }

  async _fetch(cb?) {
    cb = cb || function() {};
    let coinsData = ['btc', 'bch', 'xec', 'eth', 'xrp', 'doge', 'xpi', 'ltc'];
    const etoken = this._getEtokenSupportPrice();
    const coins = _.concat(coinsData, etoken);
    const listRate = await this.getLatestCurrencyRates({});
    if (listRate) {
      async.eachSeries(
        coins,
        async (coin, next2) => {
          const provider = this._getProviderRate(coin);
          this._retrieve(provider, coin, async (err, res) => {
            if (err) {
              logger.warn('Error retrieving data for ' + provider.name + coin, err);
              return next2();
            }
            res = await this.handleRateCurrencyCoin(res, listRate);
            this.storage.storeFiatRate(coin, res, err => {
              if (err) {
                logger.warn('Error storing data for ' + provider.name, err);
              }
              return next2();
            });
          });
        },
        cb
      );
    }
  }

  async _retrieve(provider, coin, cb) {
    if (coin === 'xpi') {
      return this._retrieveLotus(cb);
    }
    logger.debug(`Fetching data for ${provider.name} / ${coin} `);
    let params = [];
    let appendString = '';
    let headers = provider.headers ?? '';
    if (provider.name === 'CryptoCompare') {
      params = provider.params;
      params['fsym'] = coin.toUpperCase();
    } else if (provider.name === 'Coingecko') {
      params = provider.params;
      params['ids'] = provider.coinMapping[coin];
    } else if (provider.name === 'LotusExplorer') {
      appendString = '';
    } else if (provider.name === 'LotusExbitron') {
      appendString = '';
    } else if (provider.name === 'EtokenPrice') {
      try {
        const etokenSupportPrice: EtokenSupportPrice[] = _.get(config, 'etoken.etokenSupportPrice', []);
        if (!etokenSupportPrice) return cb('no etoken supported');
        let currencyRate = null;
        if (coin.toLowerCase() === 'elps') {
          currencyRate = await this.getLatestCurrencyRates({ code: 'HNL' });
        }
        const body = await provider.getRate(
          coin,
          etokenSupportPrice,
          currencyRate && currencyRate[0] ? currencyRate[0] : null
        );
        const rates = _.filter(body, x => _.some(Defaults.FIAT_CURRENCIES, ['code', x.code]));
        return cb(null, rates);
      } catch (e) {
        return cb(e);
      }
    } else {
      appendString = coin.toUpperCase();
    }
    this.request.get(
      {
        url: provider.url + appendString,
        qs: params,
        useQuerystring: true,
        headers,
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
          const rates = _.filter(provider.parseFn(body), x => _.some(Defaults.FIAT_CURRENCIES, ['code', x.code]));
          return cb(null, rates);
        } catch (e) {
          return cb(e);
        }
      }
    );
  }

  _retrieveLotus(cb) {
    logger.debug('Fetching data for lotus');
    const bc = BlockChainExplorer({
      coin: 'xpi',
      network: 'livenet',
      url: config.blockchainExplorerOpts.xpi.livenet.url
    });
    bc.getBlockBits((err, bits) => {
      if (err) return cb(err);
      const currentDiff = Bitcore.BlockHeader({ bits }).getDifficulty();
      let lotusPrice = 0;
      const networkHashRate = ((2 ** 48 / 65535 / (2 * 60)) * currentDiff) / 1000 / 1000 / 1000;
      const currentMinerReward = Math.round((Math.log2(currentDiff / 16) + 1) * 130);
      const dailyElectricityCost = (((networkHashRate / MINING_EFFICIENCY) * 24) / 1000) * ELECTRICITY_RATE;
      const lotusCost = dailyElectricityCost / currentMinerReward / 30 / 24;
      lotusPrice = lotusCost * (1 + MINER_MARGIN);
      return cb(null, [{ code: 'USD', value: lotusPrice }]);
    });
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

    const now = Date.now();
    const ts = opts.ts ? opts.ts : now;
    let fiatFiltered = [];
    let rates = [];

    if (opts.code) {
      fiatFiltered = _.filter(Defaults.FIAT_CURRENCIES, ['code', opts.code]);
      if (!fiatFiltered.length) return cb(opts.code + ' is not supported');
    }
    const currencies: { code: string; name: string }[] = fiatFiltered.length
      ? fiatFiltered
      : Defaults.SUPPORT_FIAT_CURRENCIES;
    const etoken = this._getEtokenSupportPrice();
    const coins = _.concat(_.values(Constants.COINS), etoken);
    async.map(
      coins,
      (coin, cb) => {
        rates[coin] = [];
        async.map(
          currencies,
          (currency, cb) => {
            let c = coin;
            if (coin === 'wbtc') {
              logger.info('Using btc for wbtc rate.');
              c = 'btc';
            }
            this.storage.fetchFiatRate(c, currency.code, ts, (err, rate) => {
              if (err) return cb(err);
              if (rate && ts - rate.ts > Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME * 60 * 1000) rate = null;
              return cb(null, {
                ts: +ts,
                rate: rate ? rate.value : undefined,
                fetchedOn: rate ? rate.ts : undefined,
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

  public getRatesByCoin(opts, cb) {
    $.shouldBeFunction(cb, 'Failed state: type error (cb not a function) at <getRatesByCoin()>');

    opts = opts || {};
    const rates = [];

    const now = Date.now();
    let coin = opts.coin;
    const ts = opts.ts ? opts.ts : now;
    let fiatFiltered = [];

    if (opts.code) {
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
    const coins = ['btc', 'bch', 'xec', 'eth', 'xrp', 'doge', 'xpi', 'ltc'];

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
