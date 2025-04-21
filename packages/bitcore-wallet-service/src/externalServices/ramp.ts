import * as request from 'request';
import config from '../config';
import { Utils } from '../lib/common/utils';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';

export class RampService {
  request: any = request;

  private rampGetKeys(req) {
    if (!config.ramp) throw new Error('Ramp missing credentials');

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
      API_KEY: string;
    } = {
      API: config.ramp[env].api,
      WIDGET_API: config.ramp[env].widgetApi,
      API_KEY: config.ramp[env].apiKey,
    };

    return keys;
  }

  rampGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['cryptoAssetSymbol', 'fiatValue', 'fiatCurrency'])) {
        return reject(new ClientError("Ramp's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      const URL: string = API + `/host-api/v3/onramp/quote/all?hostApiKey=${API_KEY}`;

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

  rampGetSellQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      /*
        * Although fiatValue and cryptoAmount are not both required, you need to pass one of them.
        * cryptoAmount - should be passed in token wei - e.g. for 1ETH cryptoAmount: 1000000000000000000
        * cryptoAmount?: string;
        * fiatValue?: number;
      */
      if (!checkRequired(req.body, ['cryptoAssetSymbol', 'fiatCurrency']) || (!checkRequired(req.body, ['fiatValue']) && !checkRequired(req.body, ['cryptoAmount']))) {
        return reject(new ClientError("Ramp's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      const URL: string = API + `/host-api/v3/offramp/quote/all?hostApiKey=${API_KEY}`;

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

  rampGetSignedPaymentUrl(req): { urlWithSignature: string } {
    const webRequiredParams = [
      'selectedCountryCode',
    ];
    const appRequiredParams = [
      'enabledFlows',
      'defaultFlow',
      'selectedCountryCode',
      'defaultAsset',
    ];
    const extraRequiredParams = req.body.flow && req.body.flow === 'sell' ? ['offrampAsset'] : ['finalUrl', 'userAddress', 'swapAmount','swapAsset'];
    appRequiredParams.concat(extraRequiredParams);

    const requiredParams = req.body.context === 'web' ? webRequiredParams : appRequiredParams;
    const keys = this.rampGetKeys(req);
    const API_KEY = keys.API_KEY;
    const WIDGET_API = keys.WIDGET_API;

    if (
      !checkRequired(req.body, requiredParams)
    ) {
      throw new ClientError("Ramp's request missing arguments");
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    let qs = [];
    qs.push('hostApiKey=' + API_KEY);
    qs.push('selectedCountryCode=' + encodeURIComponent(req.body.selectedCountryCode));
    if (req.body.finalUrl) qs.push('finalUrl=' + encodeURIComponent(req.body.finalUrl));
    if (req.body.userAddress) qs.push('userAddress=' + encodeURIComponent(req.body.userAddress));
    if (req.body.swapAsset) qs.push('swapAsset=' + encodeURIComponent(req.body.swapAsset));
    if (req.body.offrampAsset) qs.push('offrampAsset=' + encodeURIComponent(req.body.offrampAsset));
    if (req.body.enabledFlows) qs.push('enabledFlows=' + encodeURIComponent(req.body.enabledFlows));
    if (req.body.defaultFlow) qs.push('defaultFlow=' + encodeURIComponent(req.body.defaultFlow));
    if (req.body.hostLogoUrl) qs.push('hostLogoUrl=' + encodeURIComponent(req.body.hostLogoUrl));
    if (req.body.hostAppName) qs.push('hostAppName=' + encodeURIComponent(req.body.hostAppName));
    if (req.body.swapAmount) qs.push('swapAmount=' + encodeURIComponent(req.body.swapAmount));
    if (req.body.fiatValue) qs.push('fiatValue=' + encodeURIComponent(req.body.fiatValue));
    if (req.body.fiatCurrency) qs.push('fiatCurrency=' + encodeURIComponent(req.body.fiatCurrency));
    if (req.body.defaultAsset) qs.push('defaultAsset=' + encodeURIComponent(req.body.defaultAsset));
    if (req.body.userEmailAddress) qs.push('userEmailAddress=' + encodeURIComponent(req.body.userEmailAddress));
    if (req.body.useSendCryptoCallback) qs.push('useSendCryptoCallback=' + encodeURIComponent(req.body.useSendCryptoCallback));
    if (req.body.paymentMethodType) qs.push('paymentMethodType=' + encodeURIComponent(req.body.paymentMethodType));
    if (req.body.hideExitButton) qs.push('hideExitButton=' + encodeURIComponent(req.body.hideExitButton));
    if (req.body.variant) qs.push('variant=' + encodeURIComponent(req.body.variant));
    if (req.body.useSendCryptoCallbackVersion) qs.push('useSendCryptoCallbackVersion=' + encodeURIComponent(req.body.useSendCryptoCallbackVersion));

    const URL_SEARCH: string = `?${qs.join('&')}`;

    const urlWithSignature = `${WIDGET_API}${URL_SEARCH}`;

    return { urlWithSignature };
  }

  rampGetAssets(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Content-Type': 'application/json'
      };
      let URL: string;

      let qs = [];
      // "Buy" and "Sell" features use the same properties. Use "flow" to target the correct endpoint
      qs.push('hostApiKey=' + API_KEY);
      if (req.body.currencyCode) qs.push('currencyCode=' + encodeURIComponent(req.body.currencyCode));
      if (req.body.withDisabled) qs.push('withDisabled=' + encodeURIComponent(req.body.withDisabled));
      if (req.body.withHidden) qs.push('withHidden=' + encodeURIComponent(req.body.withHidden));
      if (req.body.useIp) {
        const ip = Utils.getIpFromReq(req);
        qs.push('userIp=' + encodeURIComponent(ip));
      }

      URL = API + `/host-api/v3${req.body.flow && req.body.flow === 'sell' ? '/offramp' : ''}/assets?${qs.join('&')}`;

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

  rampGetSellTransactionDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;

      if (!checkRequired(req.body, ['id', 'saleViewToken'])) {
        return reject(new ClientError("Ramp's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };
      let URL: string;

      let qs = [];
      qs.push('secret=' + req.body.saleViewToken);

      URL = API + `/host-api/v3/offramp/sale/${req.body.id}?${qs.join('&')}`;

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