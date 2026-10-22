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

  // Headless (Whitelabel) API. Transak only accepts these calls from
  // whitelisted partner IPs, so the app reaches them through BWS. The user's
  // accessToken comes from transakHeadlessVerifyOtp and is forwarded as the
  // 'authorization' header; BWS does not store it.
  private transakHeadlessRequest(
    req,
    opts: {
      method: 'get' | 'post';
      path: string;
      requiredParams?: string[];
      userAuth?: boolean;
      query?: (apiKey: string) => { [key: string]: string | undefined };
      body?: (apiKey: string) => any;
    }
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const userIp = this.transakGetUserIp(req);
      let keys;
      try {
        keys = this.transakGetKeys(req, false);
      } catch (err) {
        return reject(err);
      }
      const API_KEY = keys.API_KEY;
      const WIDGET_API = keys.WIDGET_API;

      const requiredParams = [...(opts.userAuth ? ['userAccessToken'] : []), ...(opts.requiredParams ?? [])];
      if (!checkRequired(req.body, requiredParams)) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': userIp,
        ...(opts.userAuth && { authorization: req.body.userAccessToken }),
      };

      let URL: string = WIDGET_API + opts.path;
      if (opts.query) {
        const qs = new URLSearchParams();
        for (const [key, value] of Object.entries(opts.query(API_KEY))) {
          if (value !== undefined && value !== null && value !== '') qs.append(key, String(value));
        }
        URL += `?${qs.toString()}`;
      }

      this.request[opts.method](
        URL,
        {
          headers,
          ...(opts.body && { body: opts.body(API_KEY) }),
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

  transakHeadlessSendOtp(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'post',
      path: '/api/v2/auth/login',
      requiredParams: ['email'],
      body: apiKey => ({ apiKey, email: req.body.email })
    });
  }

  transakHeadlessVerifyOtp(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'post',
      path: '/api/v2/auth/verify',
      requiredParams: ['email', 'otp', 'stateToken'],
      body: apiKey => ({
        apiKey,
        email: req.body.email,
        otp: req.body.otp,
        stateToken: req.body.stateToken
      })
    });
  }

  transakHeadlessGetQuote(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: '/api/v2/lookup/quotes',
      requiredParams: ['fiatCurrency', 'cryptoCurrency', 'network', 'paymentMethod', 'fiatAmount'],
      query: apiKey => ({
        apiKey,
        fiatCurrency: req.body.fiatCurrency,
        cryptoCurrency: req.body.cryptoCurrency,
        isBuyOrSell: 'BUY',
        network: req.body.network,
        paymentMethod: req.body.paymentMethod,
        fiatAmount: req.body.fiatAmount,
        partnerCustomerId: req.body.partnerCustomerId,
        partnerOrderId: req.body.partnerOrderId
      })
    });
  }

  transakHeadlessGetKycRequirement(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: '/api/v2/kyc/requirement',
      userAuth: true,
      requiredParams: ['quoteId'],
      query: apiKey => ({ apiKey, 'metadata[quoteId]': req.body.quoteId })
    });
  }

  transakHeadlessGetSavedCards(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: '/api/v2/payment-instrument/status',
      userAuth: true,
      query: () => ({ paymentInstrumentId: 'credit_debit_card' })
    });
  }

  transakHeadlessCreateCardSession(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'post',
      path: '/api/v2/transaction-session',
      userAuth: true,
      requiredParams: ['quoteId', 'walletAddress', 'successUrl', 'failureUrl'],
      body: () => ({
        quoteId: req.body.quoteId,
        walletAddress: req.body.walletAddress,
        successUrl: req.body.successUrl,
        failureUrl: req.body.failureUrl,
        ...(req.body.config && { config: req.body.config }),
        ...(req.body.billingAddress && { billingAddress: req.body.billingAddress })
      })
    });
  }

  // New card: only the requestId returned by the card component.
  // Saved card: the quote, wallet and card are sent instead.
  transakHeadlessCreateOrder(req): Promise<any> {
    if (req.body?.requestId) {
      return this.transakHeadlessRequest(req, {
        method: 'post',
        path: '/api/v2/orders',
        userAuth: true,
        body: () => ({ requestId: req.body.requestId })
      });
    }
    return this.transakHeadlessRequest(req, {
      method: 'post',
      path: '/api/v2/orders',
      userAuth: true,
      requiredParams: ['quoteId', 'walletAddress', 'paymentIdentifierId', 'successUrl', 'failureUrl'],
      body: () => ({
        quoteId: req.body.quoteId,
        walletAddress: req.body.walletAddress,
        paymentInstrumentId: 'credit_debit_card',
        paymentIdentifierId: req.body.paymentIdentifierId,
        additionalData: {
          successUrl: req.body.successUrl,
          failureUrl: req.body.failureUrl
        }
      })
    });
  }

  transakHeadlessGetOrderDetails(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: `/api/v2/orders/${encodeURIComponent(req.body?.orderId ?? '')}`,
      userAuth: true,
      requiredParams: ['orderId']
    });
  }
}