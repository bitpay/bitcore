import * as request from 'request';
import config from '../config';
import { Utils } from '../lib/common/utils';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';

export class TransakService {
  request: any = request;

  private transakGetKeys(req, cleanBody: boolean = true) {
    if (!config.transak) throw new Error('Transak missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    if (cleanBody) {
      delete req.body.env;
      delete req.body.context;
    }

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

  // Web requests are proxied through the bitpay backend, so the IP on the
  // request belongs to that server, not the customer. The proxy captures the
  // customer's public IP and forwards it as deviceIp. Web credentials are only
  // held by the proxy, so the forwarded value is trusted for that context only.
  // Falls back to the request IP so web calls keep working until the proxy
  // change that forwards deviceIp is deployed.
  // Must be called before transakGetKeys, which strips context from the body.
  private transakGetUserIp(req): string {
    const isWebContext = req.body?.context === 'web';
    let userIp = (isWebContext && req.body.deviceIp) || Utils.getIpFromReq(req);
    if (userIp) {
      // Canonicalize IPv4-mapped IPv6 (dual-stack sockets report IPv4 clients as
      // ::ffff:1.2.3.4) so Transak sees a plain IPv4 address.
      userIp = String(userIp).trim().replace(/^::ffff:/i, '');
    }
    return userIp || '';
  }

  transakGetAccessToken(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const userIp = this.transakGetUserIp(req);
      let keys;
      try {
        keys = this.transakGetKeys(req);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      const headers = {
        'Content-Type': 'application/json',
        'api-secret': SECRET_KEY,
        'x-api-key': API_KEY,
        'x-user-ip': userIp,
      };

      const body = {
        apiKey: API_KEY
      };

      const URL: string = API + '/partners/api/v2/refresh-token';

      this.request.post(
        URL,
        {
          headers,
          body,
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
      let keys;
      try {
        keys = this.transakGetKeys(req);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': Utils.getIpFromReq(req),
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
      let keys;
      try {
        keys = this.transakGetKeys(req);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': Utils.getIpFromReq(req),
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
      let keys;
      try {
        keys = this.transakGetKeys(req);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['fiatCurrency', 'cryptoCurrency', 'network', 'paymentMethod'])) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      const headers = {
        Accept: 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': Utils.getIpFromReq(req),
      };

      const qs: string[] = [];
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
        'accessToken',
        'walletAddress',
        'redirectURL',
        'fiatAmount',
        'fiatCurrency',
        'network',
        'cryptoCurrencyCode',
        'partnerOrderId',
        'partnerCustomerId',
      ];

      const requiredParams = req.body.context === 'web' ? ['accessToken'] : appRequiredParams;
      const referrerDomain = req.body.referrerDomain ?? req.body.context === 'web' ? 'bitpay.com' : 'bitpay';
      const userIp = this.transakGetUserIp(req);
      let keys;
      try {
        keys = this.transakGetKeys(req, false);
      } catch (err) {
        return reject(err);
      }
      const API_KEY = keys.API_KEY;
      const WIDGET_API = keys.WIDGET_API;

      if (!checkRequired(req.body, requiredParams)) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'access-token': req.body.accessToken,
        'x-api-key': API_KEY,
        'x-user-ip': userIp,
      };

      const widgetBody = { ...req.body };
      delete widgetBody.deviceIp;
      const body = {
        widgetParams: {
          ...widgetBody,
          apiKey: API_KEY,
          referrerDomain,
        },
      };

      const URL: string = WIDGET_API + '/api/v2/auth/session';

      this.request.post(
        URL,
        {
          headers,
          body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve({ urlWithSignature: data?.body?.data?.widgetUrl ?? data?.data?.widgetUrl });
          }
        }
      );
    });
  }

  transakGetOrderDetails(req): Promise<any> {
    return new Promise(async (resolve, reject) => {
      let keys;
      try {
        keys = this.transakGetKeys(req, false);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['orderId', 'accessToken'])) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      const headers = {
        Accept: 'application/json',
        'access-token': req.body.accessToken,
        'x-api-key': API_KEY,
        'x-user-ip': Utils.getIpFromReq(req),
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