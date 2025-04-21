import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';

export class SardineService {
  request: any = request;

  private sardineGetKeys(req) {
    if (!config.sardine) throw new Error('Sardine missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }
    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      SECRET_KEY: string;
      CLIENT_ID: string;
    } = {
      API: config.sardine[env].api,
      SECRET_KEY: config.sardine[env].secretKey,
      CLIENT_ID: config.sardine[env].clientId,
    };

    return keys;
  }

  sardineGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['asset_type', 'network', 'total'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      let qs = [];
      qs.push('asset_type=' + req.body.asset_type);
      qs.push('network=' + req.body.network);
      qs.push('total=' + req.body.total);

      if (req.body.currency) qs.push('currency=' + req.body.currency);
      if (req.body.paymentType) qs.push('paymentType=' + req.body.paymentType);
      if (req.body.quote_type) qs.push('quote_type=' + req.body.quote_type);

      const URL: string = API + `/v1/quotes?${qs.join('&')}`;

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

  sardineGetCurrencyLimits(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      const URL: string = API + '/v1/fiat-currencies';

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

  sardineGetToken(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['referenceId', 'externalUserId', 'customerId'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${secretBase64}`,
      };

      const URL: string = API + '/v1/auth/client-tokens';

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

  sardineGetSupportedTokens(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${secretBase64}`,
      };

      const URL: string = API + '/v1/supported-tokens';

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

  sardineGetOrdersDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['orderId']) && !checkRequired(req.body, ['externalUserId']) && !checkRequired(req.body, ['referenceId'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      let qs = [];
      let URL: string;

      if (req.body.orderId) {
        URL = API + `/v1/orders/${req.body.orderId}`;
      } else if (req.body.externalUserId || req.body.referenceId) {
        if (req.body.externalUserId) qs.push('externalUserId=' + req.body.externalUserId);
        if (req.body.referenceId) qs.push('referenceId=' + req.body.referenceId);
        if (req.body.startDate) qs.push('startDate=' + req.body.startDate);
        if (req.body.endDate) qs.push('endDate=' + req.body.endDate);
        if (req.body.limit) qs.push('limit=' + req.body.limit);

        URL = API + `/v1/orders?${qs.join('&')}`;
      }

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