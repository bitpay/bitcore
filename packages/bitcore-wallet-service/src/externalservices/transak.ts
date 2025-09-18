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

  transakGetSignedPaymentUrl(req): { urlWithSignature: string } {
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

    const requiredParams = req.body.context === 'web' ? [] : appRequiredParams;
    const keys = this.transakGetKeys(req);
    const API_KEY = keys.API_KEY;
    const WIDGET_API = keys.WIDGET_API;

    if (
      !checkRequired(req.body, requiredParams)
    ) {
      throw new ClientError("Transak's request missing arguments");
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    let qs: string[] = [];
    // Recommended parameters to customize from the app
    if (req.body.walletAddress) qs.push('walletAddress=' + encodeURIComponent(req.body.walletAddress));
    if (req.body.disableWalletAddressForm) qs.push('disableWalletAddressForm=' + encodeURIComponent(req.body.disableWalletAddressForm));
    if (req.body.redirectURL) qs.push('redirectURL=' + encodeURIComponent(req.body.redirectURL));
    if (req.body.exchangeScreenTitle) qs.push('exchangeScreenTitle=' + encodeURIComponent(req.body.exchangeScreenTitle));
    if (req.body.fiatAmount) qs.push('fiatAmount=' + encodeURIComponent(req.body.fiatAmount));
    if (req.body.fiatCurrency) qs.push('fiatCurrency=' + encodeURIComponent(req.body.fiatCurrency));
    if (req.body.network) qs.push('network=' + encodeURIComponent(req.body.network));
    if (req.body.paymentMethod) qs.push('paymentMethod=' + encodeURIComponent(req.body.paymentMethod));
    if (req.body.cryptoCurrencyCode) qs.push('cryptoCurrencyCode=' + encodeURIComponent(req.body.cryptoCurrencyCode));
    if (req.body.cryptoCurrencyList) qs.push('cryptoCurrencyList=' + encodeURIComponent(req.body.cryptoCurrencyList));
    if (req.body.hideExchangeScreen) qs.push('hideExchangeScreen=' + encodeURIComponent(req.body.hideExchangeScreen));
    if (req.body.themeColor) qs.push('themeColor=' + encodeURIComponent(req.body.themeColor));
    if (req.body.hideMenu) qs.push('hideMenu=' + encodeURIComponent(req.body.hideMenu));
    if (req.body.partnerOrderId) qs.push('partnerOrderId=' + encodeURIComponent(req.body.partnerOrderId));
    if (req.body.partnerCustomerId) qs.push('partnerCustomerId=' + encodeURIComponent(req.body.partnerCustomerId));
    // Other parameters
    if (req.body.environment) qs.push('environment=' + encodeURIComponent(req.body.environment));
    if (req.body.widgetHeight) qs.push('widgetHeight=' + encodeURIComponent(req.body.widgetHeight));
    if (req.body.widgetWidth) qs.push('widgetWidth=' + encodeURIComponent(req.body.widgetWidth));
    if (req.body.productsAvailed) qs.push('productsAvailed=' + encodeURIComponent(req.body.productsAvailed));
    if (req.body.defaultFiatAmount) qs.push('defaultFiatAmount=' + encodeURIComponent(req.body.defaultFiatAmount));
    if (req.body.countryCode) qs.push('countryCode=' + encodeURIComponent(req.body.countryCode));
    if (req.body.excludeFiatCurrencies) qs.push('excludeFiatCurrencies=' + encodeURIComponent(req.body.excludeFiatCurrencies));
    if (req.body.defaultNetwork) qs.push('defaultNetwork=' + encodeURIComponent(req.body.defaultNetwork));
    if (req.body.networks) qs.push('networks=' + encodeURIComponent(req.body.networks));
    if (req.body.defaultPaymentMethod) qs.push('defaultPaymentMethod=' + encodeURIComponent(req.body.defaultPaymentMethod));
    if (req.body.disablePaymentMethods) qs.push('disablePaymentMethods=' + encodeURIComponent(req.body.disablePaymentMethods));
    if (req.body.defaultCryptoAmount) qs.push('defaultCryptoAmount=' + encodeURIComponent(req.body.defaultCryptoAmount));
    if (req.body.cryptoAmount) qs.push('cryptoAmount=' + encodeURIComponent(req.body.cryptoAmount));
    if (req.body.defaultCryptoCurrency) qs.push('defaultCryptoCurrency=' + encodeURIComponent(req.body.defaultCryptoCurrency));
    if (req.body.isFeeCalculationHidden) qs.push('isFeeCalculationHidden=' + encodeURIComponent(req.body.isFeeCalculationHidden));
    if (req.body.walletAddressesData) qs.push('walletAddressesData=' + encodeURIComponent(req.body.walletAddressesData));
    if (req.body.email) qs.push('email=' + encodeURIComponent(req.body.email));
    if (req.body.userData) qs.push('userData=' + encodeURIComponent(req.body.userData));
    if (req.body.isAutoFillUserData) qs.push('isAutoFillUserData=' + encodeURIComponent(req.body.isAutoFillUserData));

    const URL_SEARCH: string = `?apiKey=${API_KEY}&${qs.join('&')}`;

    const urlWithSignature = `${WIDGET_API}${URL_SEARCH}`;

    return { urlWithSignature };
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