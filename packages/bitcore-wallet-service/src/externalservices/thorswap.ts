import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';

export class ThorswapService {
  request: any = request;

  private thorswapGetKeys(req) {
    if (!config.thorswap) throw new Error('Thorswap missing credentials');

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
      REFERER: string;
    } = {
      API: config.thorswap[env].api,
      API_KEY: config.thorswap[env].apiKey,
      SECRET_KEY: config.thorswap[env].secretKey,
      REFERER: config.thorswap[env].referer
    };

    return keys;
  }

  thorswapGetSupportedChains(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.thorswapGetKeys(req);
      const API = keys.API;
      const REFERER = keys.REFERER;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': REFERER,
        'x-api-key': API_KEY
      };

      const uriPath: string = req?.body?.includeDetails ? '/tokenlist/utils/chains/details' : '/tokenlist/utils/chains';
      const URL: string = API + uriPath;

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

  thorswapGetCryptoCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.thorswapGetKeys(req);
      const API = keys.API;
      const REFERER = keys.REFERER;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': REFERER,
        'x-api-key': API_KEY
      };

      let qs: string[] = [];
      qs.push('categories=' + (req?.body?.categories ?? 'all'));

      const uriPath: string = req?.body?.includeDetails ? '/tokenlist/utils/currencies/details' : '/tokenlist/utils/currencies';
      const URL: string = API + `${uriPath}?${qs.join('&')}`;

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

  thorswapGetSwapQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.thorswapGetKeys(req);
      const API = keys.API;
      const REFERER = keys.REFERER;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': REFERER,
        'x-api-key': API_KEY
      };

      let qs: string[] = [];
      if (!checkRequired(req.body, ['sellAsset', 'buyAsset', 'sellAmount'])) {
        return reject(new ClientError("Thorswap's request missing arguments"));
      }
      qs.push('sellAsset=' + req.body.sellAsset);
      qs.push('buyAsset=' + req.body.buyAsset);
      qs.push('sellAmount=' + req.body.sellAmount);
      if (req.body.senderAddress) qs.push('senderAddress=' + req.body.senderAddress);
      if (req.body.recipientAddress) qs.push('recipientAddress=' + req.body.recipientAddress);
      if (req.body.slippage) qs.push('slippage=' + req.body.slippage);
      if (req.body.limit) qs.push('limit=' + req.body.limit);
      if (req.body.providers) qs.push('providers=' + req.body.providers);
      if (req.body.subProviders) qs.push('subProviders=' + req.body.subProviders);
      if (req.body.preferredProvider) qs.push('preferredProvider=' + req.body.preferredProvider);
      if (req.body.affiliateAddress) qs.push('affiliateAddress=' + req.body.affiliateAddress);
      if (req.body.affiliateBasisPoints) qs.push('affiliateBasisPoints=' + req.body.affiliateBasisPoints);
      if (req.body.isAffiliateFeeFlat) qs.push('isAffiliateFeeFlat=' + req.body.isAffiliateFeeFlat);
      if (req.body.allowSmartContractRecipient) qs.push('allowSmartContractRecipient=' + req.body.allowSmartContractRecipient);

      const URL: string = API + `/aggregator/tokens/quote?${qs.join('&')}`;

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

  thorswapGetSwapTx(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.thorswapGetKeys(req);
      const API = keys.API;
      const REFERER = keys.REFERER;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': REFERER,
        'x-api-key': API_KEY
      };

      if (!checkRequired(req.body, ['hash']) && !checkRequired(req.body, ['txn'])) {
        return reject(new ClientError("Thorswap's request missing arguments"));
      }

      this.request.post(
        API + '/tracker/v2/txn',
        // API + '/apiusage/v2/txn',
        // 'https://api.swapkit.dev/track',
        // /apiusage/v2/txn
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
}