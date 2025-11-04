import * as crypto from 'crypto';
import * as _ from 'lodash';
import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';

export class BanxaService {
  request: any = request;

  private banxaGetKeys(req) {
    if (!config.banxa) throw new Error('Banxa missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      API_KEY: string;
      SECRET_KEY: string;
    } = {
      API: config.banxa[env].api,
      API_KEY: config.banxa[env].apiKey,
      SECRET_KEY: config.banxa[env].secretKey
    };

    return keys;
  }

  private getBanxaSignature(method: 'get' | 'post', endpoint: string, apiKey: string, secret: string, body?: string) {
    let signature;
    const nonce = Date.now().toString();

    switch (method) {
      case 'get':
        signature = 'GET' + '\n' + `/api${endpoint}` + '\n' + nonce;
        break;
      case 'post':
        const stringifiedBody = body ? JSON.stringify(_.cloneDeep(body)) : '';
        signature = 'POST' + '\n' + `/api${endpoint}` + '\n' + nonce + '\n' + stringifiedBody;
        break;
      default:
        signature = undefined;
        break;
    }

    const localSignature = crypto.createHmac('sha256', secret).update(signature).digest('hex');
    const auth = `${apiKey}:${localSignature}:${nonce}`;
    return auth;
  }

  banxaGetCoins(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['orderType'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }
      if (!['buy', 'sell'].includes(req.body.orderType)) {
        return reject(new ClientError("Banxa's 'orderType' property must be 'sell' or 'buy'"));
      }

      const UriPath = `/coins/${req.body.orderType}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

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

  banxaGetPaymentMethods(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      const qs: string[] = [];
      if (req.body.source) qs.push('source=' + req.body.source);
      if (req.body.target) qs.push('target=' + req.body.target);

      const UriPath = `/payment-methods${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

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

  banxaGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['source', 'target'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      const qs: string[] = [];
      qs.push('source=' + req.body.source);
      qs.push('target=' + req.body.target);

      if (req.body.source_amount) qs.push('source_amount=' + req.body.source_amount);
      if (req.body.target_amount) qs.push('target_amount=' + req.body.target_amount);
      if (req.body.payment_method_id) qs.push('payment_method_id=' + req.body.payment_method_id);
      if (req.body.account_reference) qs.push('account_reference=' + req.body.account_reference);
      if (req.body.blockchain) qs.push('blockchain=' + req.body.blockchain);

      const UriPath = `/prices${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

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

  banxaCreateOrder(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['account_reference', 'source', 'target', 'wallet_address', 'return_url_on_success'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      delete req.body.payment_method_id;

      const UriPath = '/orders';
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('post', UriPath, API_KEY, SECRET_KEY, req.body);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

      this.request.post(
        URL,
        {
          headers,
          body: req.body,
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

  banxaGetOrder(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['order_id'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      const qs: string[] = [];
      if (req.body.fx_currency) qs.push('fx_currency=' + req.body.fx_currency);

      const UriPath = `/orders/${req.body.order_id}${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

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
}