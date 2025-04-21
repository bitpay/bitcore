import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';
const Bitcore = require('bitcore-lib');

export class MoonpayService {
  request: any = request;

  private moonpayGetKeys(req) {
    if (!config.moonpay) throw new Error('Moonpay missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      WIDGET_API: string;
      SELL_WIDGET_API: string;
      API_KEY: string;
      SECRET_KEY: string;
    } = {
      API: config.moonpay[env].api,
      WIDGET_API: config.moonpay[env].widgetApi,
      SELL_WIDGET_API: config.moonpay[env].sellWidgetApi,
      API_KEY: config.moonpay[env].apiKey,
      SECRET_KEY: config.moonpay[env].secretKey
    };

    return keys;
  }

  moonpayGetCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;

      const headers = {
        'Content-Type': 'application/json'
      };

      const URL = API + '/v3/currencies/'

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

  moonpayGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['currencyAbbreviation', 'baseCurrencyAmount', 'baseCurrencyCode'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('apiKey=' + API_KEY);
      qs.push('baseCurrencyAmount=' + req.body.baseCurrencyAmount);
      qs.push('baseCurrencyCode=' + req.body.baseCurrencyCode);

      if (req.body.extraFeePercentage) qs.push('extraFeePercentage=' + req.body.extraFeePercentage);
      if (req.body.paymentMethod) qs.push('paymentMethod=' + req.body.paymentMethod);
      if (req.body.areFeesIncluded) qs.push('areFeesIncluded=' + req.body.areFeesIncluded);

      const URL: string = API + `/v3/currencies/${req.body.currencyAbbreviation}/buy_quote/?${qs.join('&')}`;

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

  moonpayGetSellQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['currencyAbbreviation', 'quoteCurrencyCode', 'baseCurrencyAmount'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('apiKey=' + API_KEY);
      qs.push('quoteCurrencyCode=' + req.body.quoteCurrencyCode);
      qs.push('baseCurrencyAmount=' + req.body.baseCurrencyAmount);

      if (req.body.extraFeePercentage) qs.push('extraFeePercentage=' + req.body.extraFeePercentage);
      if (req.body.payoutMethod) qs.push('payoutMethod=' + req.body.payoutMethod);

      const URL: string = API + `/v3/currencies/${req.body.currencyAbbreviation}/sell_quote?${qs.join('&')}`;

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

  moonpayGetCurrencyLimits(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['currencyAbbreviation', 'baseCurrencyCode'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('apiKey=' + API_KEY);
      qs.push('baseCurrencyCode=' + encodeURIComponent(req.body.baseCurrencyCode));
      if (req.body.areFeesIncluded) qs.push('areFeesIncluded=' + encodeURIComponent(req.body.areFeesIncluded));
      if (req.body.paymentMethod) qs.push('paymentMethod=' + encodeURIComponent(req.body.paymentMethod));

      const URL = API + `/v3/currencies/${req.body.currencyAbbreviation}/limits/?${qs.join('&')}`

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

  moonpayGetSignedPaymentUrl(req): { urlWithSignature: string } {
    const keys = this.moonpayGetKeys(req);
    const SECRET_KEY = keys.SECRET_KEY;
    const API_KEY = keys.API_KEY;
    const WIDGET_API = keys.WIDGET_API;

    if (
      !checkRequired(req.body, [
        'currencyCode',
        'walletAddress',
        'baseCurrencyCode',
        'baseCurrencyAmount',
        'externalTransactionId',
        'redirectURL'
      ])
    ) {
      throw new ClientError("Moonpay's request missing arguments");
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    let qs = [];
    qs.push('apiKey=' + API_KEY);
    qs.push('currencyCode=' + encodeURIComponent(req.body.currencyCode));
    qs.push('walletAddress=' + encodeURIComponent(req.body.walletAddress));
    qs.push('baseCurrencyCode=' + encodeURIComponent(req.body.baseCurrencyCode));
    qs.push('baseCurrencyAmount=' + encodeURIComponent(req.body.baseCurrencyAmount));
    qs.push('externalTransactionId=' + encodeURIComponent(req.body.externalTransactionId));
    qs.push('redirectURL=' + encodeURIComponent(req.body.redirectURL));
    if (req.body.lockAmount) qs.push('lockAmount=' + encodeURIComponent(req.body.lockAmount));
    if (req.body.showWalletAddressForm)
      qs.push('showWalletAddressForm=' + encodeURIComponent(req.body.showWalletAddressForm));
    if (req.body.paymentMethod) qs.push('paymentMethod=' + encodeURIComponent(req.body.paymentMethod));
    if (req.body.areFeesIncluded) qs.push('areFeesIncluded=' + encodeURIComponent(req.body.areFeesIncluded));

    const URL_SEARCH: string = `?${qs.join('&')}`;

    const URLSignatureHash: string = Bitcore.crypto.Hash.sha256hmac(
      Buffer.from(URL_SEARCH),
      Buffer.from(SECRET_KEY)
    ).toString('base64');

    const urlWithSignature = `${WIDGET_API}${URL_SEARCH}&signature=${encodeURIComponent(URLSignatureHash)}`;

    return { urlWithSignature };
  }

  moonpayGetSellSignedPaymentUrl(req): { urlWithSignature: string } {
    const keys = this.moonpayGetKeys(req);
    const SECRET_KEY = keys.SECRET_KEY;
    const API_KEY = keys.API_KEY;
    const SELL_WIDGET_API = keys.SELL_WIDGET_API;

    if (
      !checkRequired(req.body, [
        'baseCurrencyCode',
        'baseCurrencyAmount',
        'externalTransactionId',
        'redirectURL',
      ])
    ) {
      throw new ClientError("Moonpay's request missing arguments");
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    let qs = [];
    qs.push('apiKey=' + API_KEY);
    qs.push('baseCurrencyCode=' + encodeURIComponent(req.body.baseCurrencyCode));
    qs.push('baseCurrencyAmount=' + encodeURIComponent(req.body.baseCurrencyAmount));
    qs.push('externalTransactionId=' + encodeURIComponent(req.body.externalTransactionId));
    qs.push('redirectURL=' + encodeURIComponent(req.body.redirectURL));

    if (req.body.quoteCurrencyCode) qs.push('quoteCurrencyCode=' + encodeURIComponent(req.body.quoteCurrencyCode));
    if (req.body.paymentMethod) qs.push('paymentMethod=' + encodeURIComponent(req.body.paymentMethod));
    if (req.body.externalCustomerId) qs.push('externalCustomerId=' + encodeURIComponent(req.body.externalCustomerId));
    if (req.body.refundWalletAddress) qs.push('refundWalletAddress=' + encodeURIComponent(req.body.refundWalletAddress));
    if (req.body.lockAmount) qs.push('lockAmount=' + encodeURIComponent(req.body.lockAmount));
    if (req.body.colorCode) qs.push('colorCode=' + encodeURIComponent(req.body.colorCode));
    if (req.body.theme) qs.push('theme=' + encodeURIComponent(req.body.theme));
    if (req.body.language) qs.push('language=' + encodeURIComponent(req.body.language));
    if (req.body.email) qs.push('email=' + encodeURIComponent(req.body.email));
    if (req.body.externalCustomerId) qs.push('externalCustomerId=' + encodeURIComponent(req.body.externalCustomerId));
    if (req.body.showWalletAddressForm)
      qs.push('showWalletAddressForm=' + encodeURIComponent(req.body.showWalletAddressForm));
    if (req.body.unsupportedRegionRedirectUrl) qs.push('unsupportedRegionRedirectUrl=' + encodeURIComponent(req.body.unsupportedRegionRedirectUrl));
    if (req.body.skipUnsupportedRegionScreen) qs.push('skipUnsupportedRegionScreen=' + encodeURIComponent(req.body.skipUnsupportedRegionScreen));

    const URL_SEARCH: string = `?${qs.join('&')}`;

    const URLSignatureHash: string = Bitcore.crypto.Hash.sha256hmac(
      Buffer.from(URL_SEARCH),
      Buffer.from(SECRET_KEY)
    ).toString('base64');

    const urlWithSignature = `${SELL_WIDGET_API}${URL_SEARCH}&signature=${encodeURIComponent(URLSignatureHash)}`;

    return { urlWithSignature };
  }

  moonpayGetTransactionDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['transactionId']) && !checkRequired(req.body, ['externalId'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };
      let URL: string;

      let qs = [];
      qs.push('apiKey=' + API_KEY);
      if (req.body.transactionId) {
        URL = API + `/v1/transactions/${req.body.transactionId}?${qs.join('&')}`;
      } else if (req.body.externalId) {
        URL = API + `/v1/transactions/ext/${req.body.externalId}?${qs.join('&')}`;
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

  moonpayGetSellTransactionDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['transactionId']) && !checkRequired(req.body, ['externalId'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };
      let URL: string;

      let qs = [];
      qs.push('apiKey=' + API_KEY);
      if (req.body.transactionId) {
        URL = API + `/v3/sell_transactions/${req.body.transactionId}?${qs.join('&')}`;
      } else if (req.body.externalId) {
        URL = API + `/v3/sell_transactions/ext/${req.body.externalId}?${qs.join('&')}`;
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

  moonpayCancelSellTransaction(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['transactionId']) && !checkRequired(req.body, ['externalId'])) {
        return reject(new ClientError("Moonpay's request missing arguments"));
      }

      const headers = {
        Authorization: 'Api-Key ' + SECRET_KEY,
        Accept: 'application/json'
      };
      let URL: string;

      if (req.body.transactionId) {
        URL = API + `/v3/sell_transactions/${req.body.transactionId}`;
      } else if (req.body.externalId) {
        URL = API + `/v3/sell_transactions/ext/${req.body.externalId}`;
      }

      this.request.delete(
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

  moonpayGetAccountDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.moonpayGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('apiKey=' + API_KEY);

      const URL = API + `/v3/accounts/me?${qs.join('&')}`;

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