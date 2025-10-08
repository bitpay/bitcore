import * as request from 'request';
import config from '../config';
import { Utils } from '../lib/common/utils';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';
const Uuid = require('uuid');

export class SimplexService {
  request: any = request;

  private simplexGetKeys(req) {
    if (!config.simplex) throw new Error('Simplex missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys = {
      API: config.simplex[env].api,
      API_SELL: config.simplex[env].apiSell,
      API_KEY: config.simplex[env].apiKey,
      PUBLIC_KEY: config.simplex[env].publicKey,
      APP_PROVIDER_ID: config.simplex[env].appProviderId,
      APP_SELL_REF_ID: config.simplex[env].appSellRefId
    };

    return keys;
  }

  simplexGetCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);
      const API = keys.API;
      const PUBLIC_KEY = keys.PUBLIC_KEY;

      const headers = {
        'Content-Type': 'application/json'
      };

      const URL = API + `/v2/supported_crypto_currencies?public_key=${PUBLIC_KEY}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  simplexGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const ip = Utils.getIpFromReq(req);

      req.body.client_ip = ip;
      req.body.wallet_id = keys.APP_PROVIDER_ID;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      if (req.body && req.body.payment_methods && Array.isArray(req.body.payment_methods)) {
        // Workaround to fix older versions of the app
        req.body.payment_methods = req.body.payment_methods.map(item => item === 'simplex_account' ? 'sepa_open_banking' : item);
      }

      this.request.post(
        API + '/wallet/merchant/v2/quote',
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : null);
          }
        }
      );
    });
  }

  simplexGetSellQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API_SELL;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['base_currency', 'base_amount', 'quote_currency', 'pp_payment_method'])) {
        return reject(new ClientError("Simplex's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY,
      };

      if (req.body.userCountry && typeof req.body.userCountry === 'string') {
        headers['x-country-code'] = req.body.userCountry.toUpperCase();
      }

      let qs: string[] = [];
      qs.push('base_currency=' + req.body.base_currency);
      qs.push('base_amount=' + req.body.base_amount);
      qs.push('quote_currency=' + req.body.quote_currency);
      qs.push('pp_payment_method=' + req.body.pp_payment_method);

      const URL: string = API + `/v3/quote?${qs.join('&')}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : data);
          }
        }
      );
    });
  }

  simplexPaymentRequest(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const appProviderId = keys.APP_PROVIDER_ID;
      const paymentId = Uuid.v4();
      const orderId = Uuid.v4();
      const apiHost = keys.API;
      const ip = Utils.getIpFromReq(req);

      if (
        !checkRequired(req.body, ['account_details', 'transaction_details']) &&
        !checkRequired(req.body.transaction_details, ['payment_details'])
      ) {
        return reject(new ClientError("Simplex's request missing arguments"));
      }

      req.body.account_details.app_provider_id = appProviderId;
      req.body.account_details.signup_login = {
        ip,
        location: '',
        uaid: '',
        accept_language: 'de,en-US;q=0.7,en;q=0.3',
        http_accept_language: 'de,en-US;q=0.7,en;q=0.3',
        user_agent: req.body.account_details.signup_login ? req.body.account_details.signup_login.user_agent : '', // Format: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:67.0) Gecko/20100101 Firefox/67.0'
        cookie_session_id: '',
        timestamp: req.body.account_details.signup_login ? req.body.account_details.signup_login.timestamp : ''
      };

      req.body.transaction_details.payment_details.payment_id = paymentId;
      req.body.transaction_details.payment_details.order_id = orderId;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      this.request.post(
        API + '/wallet/merchant/v2/payments/partner/data',
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            data.body.payment_id = paymentId;
            data.body.order_id = orderId;
            data.body.app_provider_id = appProviderId;
            data.body.api_host = apiHost;
            return resolve(data.body);
          }
        }
      );
    });
  }

  simplexSellPaymentRequest(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API_SELL;
      const API_KEY = keys.API_KEY;
      const appSellRefId = keys.APP_SELL_REF_ID;

      if (
        !checkRequired(req.body, ['referer_url', 'return_url']) ||
        !checkRequired(req.body.txn_details, ['quote_id'])
      ) {
        return reject(new ClientError("Simplex's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY,
      };

      if (req.body.userCountry && typeof req.body.userCountry === 'string') {
        headers['x-country-code'] = req.body.userCountry.toUpperCase();
      }

      this.request.post(
        API + '/v3/initiate-sell/widget',
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            data.body.app_sell_ref_id = appSellRefId;
            return resolve(data.body);
          }
        }
      );
    });
  }

  simplexGetEvents(req): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!config.simplex) return reject(new Error('Simplex missing credentials'));
      if (!req.env || (req.env != 'sandbox' && req.env != 'production'))
        return reject(new Error("Simplex's request wrong environment"));

      const API = config.simplex[req.env].api;
      const API_KEY = config.simplex[req.env].apiKey;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      this.request.get(
        API + '/wallet/merchant/v2/events',
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : null);
          } else {
            return resolve(data.body ? data.body : null);
          }
        }
      );
    });
  }
}