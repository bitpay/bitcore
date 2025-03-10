import * as async from 'async';
import _ from 'lodash';
import { Storage } from './storage';
import axios, {AxiosInstance} from 'axios';

const $ = require('preconditions').singleton();
import { Common } from './common';
const Defaults = Common.Defaults;

import logger from './logger';
export class CurrencyRateService {
  request: AxiosInstance;
  apiKey: string = '';
  providers: any[];
  storage: Storage;
  apiUrl: '';
  init(opts, cb) {
    opts = opts || {};

    this.request = opts.request || axios;
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
    this.request.get(this.apiUrl, { params })
      .then((response) => {
        if (!response.data) {
          return cb(new Error('No response data'));
        }
        logger.debug('Data for currency rate fetched successfully');

        try {
          const rates = this.convertRates(response.data.data);
          return cb(null, rates);
        } catch (e) {
          return cb(e);
        }
      })
      .catch((err) => cb(err));
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
