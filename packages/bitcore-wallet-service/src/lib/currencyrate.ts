import * as async from 'async';
import _ from 'lodash';
import * as request from 'request';
import { Storage } from './storage';
const config = require('../config');

const $ = require('preconditions').singleton();
const Common = require('./common');
const Defaults = Common.Defaults;
const Constants = Common.Constants;

import logger from './logger';
export class CurrencyRateService {
  request: request.RequestAPI<any, any, any>;
  apiKey: string = '';
  providers: any[];
  storage: Storage;
  apiUrl: '';
  init(opts, cb) {
    opts = opts || {};

    this.request = opts.request || request;
    this.apiKey = opts.apiKey || opts.currencyRateServiceOpts.apiKey;
    this.apiUrl = opts.apiUrl || opts.currencyRateServiceOpts.apiUrl;

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
    const interval = opts.currencyRateServiceOpts.fetchInterval || Defaults.FIAT_RATE_FETCH_INTERVAL;
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

    this._retrieve((err, res) => {
      if (err) {
        logger.warn('Error retrieving data', err);
      }
      if (!!res && res.length > 0) {
        this.storage.storeCurrencyRate(res, err => {
          if (err) {
            logger.warn('Error storing data', err);
          }
        });
      }
    });
  }

  _retrieve(cb) {
    logger.debug('Fetching data for currency rate ');
    let params = {
      apikey: this.apiKey
    };
    this.request.get(
      {
        url: this.apiUrl,
        qs: params,
        useQuerystring: true,
        json: true
      },
      (err, res, body) => {
        if (err || !body) {
          return cb(err);
        }
        logger.debug('Data for currency rate fetched successfully');
        try {
          const rates = this.convertRates(body.data);
          return cb(null, rates);
        } catch (e) {
          return cb(e);
        }
      }
    );
  }

  convertRates(raw): any {
    return _.compact(
      Object.keys(raw).map(key => {
        if (!raw[key]) return null;
        return {
          code: key,
          value: +raw[key].value
        };
      })
    );
  }
}
