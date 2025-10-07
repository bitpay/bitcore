import * as _ from 'lodash';
import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';

export class TransakService {
  request: any = request;

  private transakGetKeys(req) {
    if (!config.transak) throw new Error('Transak missing credentials');

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
      WIDGET_API: string;
    } = {
      API: config.transak[env].api,
      API_KEY: config.transak[env].apiKey,
      SECRET_KEY: config.transak[env].secretKey,
      WIDGET_API: config.transak[env].widgetApi
    };

    return keys;
  }

  transakGetAccessToken(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.transakGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      const headers = {
        'Content-Type': 'application/json',
        'api-secret': SECRET_KEY,
      };

      req.body = {
        apiKey: API_KEY
      }

      const URL: string = API + '/partners/api/v2/refresh-token';

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

  transakGetCryptoCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.transakGetKeys(req);
      const API = keys.API;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      const URL: string = API + '/api/v2/currencies/crypto-currencies';

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

  transakGetFiatCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.transakGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      const URL: string = API + `/api/v2/currencies/fiat-currencies?apiKey=${API_KEY}`;

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

  transakGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.transakGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['fiatCurrency', 'cryptoCurrency', 'network', 'paymentMethod'])) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      const headers = {
        Accept: 'application/json',
      };

      let qs: string[] = [];
      qs.push('partnerApiKey=' + API_KEY);
      qs.push('fiatCurrency=' + req.body.fiatCurrency);
      qs.push('cryptoCurrency=' + req.body.cryptoCurrency);
      qs.push('isBuyOrSell=BUY');
      qs.push('network=' + req.body.network);
      qs.push('paymentMethod=' + req.body.paymentMethod);

      if (req.body.fiatAmount) qs.push('fiatAmount=' + req.body.fiatAmount);
      if (req.body.cryptoAmount) qs.push('cryptoAmount=' + req.body.cryptoAmount);

      const URL: string = API + `/api/v2/currencies/price?${qs.join('&')}`;

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

  transakGetSignedPaymentUrl(req): Promise<{ urlWithSignature: string }> {
    return new Promise(async (resolve, reject) => {
      const appRequiredParams = [
        'walletAddress',
        'redirectURL',
        'fiatAmount',
        'fiatCurrency',
        'network',
        'cryptoCurrencyCode',
        'partnerOrderId',
        'partnerCustomerId',
      ];

      const env = _.cloneDeep(req.body.env);
      const requiredParams = req.body.context === 'web' ? [] : appRequiredParams;
      const referrerDomain = req.body.referrerDomain ?? req.body.context === 'web' ? 'bitpay.com' : 'bitpay';
      const keys = this.transakGetKeys(req);
      const API_KEY = keys.API_KEY;
      const WIDGET_API = keys.WIDGET_API;

      if (
        !checkRequired(req.body, requiredParams)
      ) {
        throw new ClientError("Transak's request missing arguments");
      }

      let accessToken;
        if (req.body.accessToken) {
          accessToken = req.body.accessToken;
        } else {
          try {
            const accessTokenData = await this.transakGetAccessToken({ body: env });
            accessToken = accessTokenData?.data?.accessToken;
          } catch (err) {
            return reject(err?.body ? err.body : err);
          }
        }

        const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'access-token': accessToken,
        };

        req.body = {
          widgetParams: {
            ...req.body,
            apiKey: API_KEY,
            referrerDomain,
          },
        };

      const URL: string = WIDGET_API + '/api/v2/auth/session';

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
            return resolve({urlWithSignature: data?.body?.data?.widgetUrl ?? data?.data?.widgetUrl});
          }
        }
      );
  });
  }

  transakGetOrderDetails(req): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const env = _.cloneDeep(req.body.env);
      const keys = this.transakGetKeys(req);
      const API = keys.API;

      if (!checkRequired(req.body, ['orderId'])) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      let accessToken;
      if (req.body.accessToken) {
        accessToken = req.body.accessToken;
      } else {
        try {
          const accessTokenData = await this.transakGetAccessToken({ body: env });
          accessToken = accessTokenData?.data?.accessToken;
        } catch (err) {
          return reject(err?.body ? err.body : err);
        }
      }

      const headers = {
        Accept: 'application/json',
        'access-token': accessToken,
      };

      const URL: string = API + `/partners/api/v2/order/${req.body.orderId}`;

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