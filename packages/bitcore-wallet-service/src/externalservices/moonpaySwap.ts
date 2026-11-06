import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import logger from '../lib/logger';
import { checkRequired } from '../lib/server';

// MoonPay swaps are served by the swaps.xyz API (https://docs.swaps.xyz)
const QUOTE_PARAMS = [
  'srcChainId',
  'srcToken',
  'dstChainId',
  'dstToken',
  'amount',
  'swapDirection',
  'slippage',
  'refundTo',
  'returnDepositAddress'
];

const SWAP_DIRECTIONS = ['exact-amount-in', 'exact-amount-out'];

const ACTION_PARAMS = [
  'actionType',
  'sender',
  'recipient',
  ...QUOTE_PARAMS
];

export class MoonpaySwapService {
  request: any = request;

  private moonpaySwapGetKeys(req) {
    const swapCryptoConfig = config.services?.swapCrypto;
    if (swapCryptoConfig?.disabled || swapCryptoConfig?.moonpay?.disabled) {
      throw new ClientError('Moonpay Swap is disabled');
    }
    if (!config.moonpaySwap) throw new Error('Moonpay Swap missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    if (!config.moonpaySwap[env]) throw new Error('Moonpay Swap missing credentials');

    const keys: {
      API: string;
      API_KEY: string;
    } = {
      API: config.moonpaySwap[env].api,
      API_KEY: config.moonpaySwap[env].apiKey
    };

    return keys;
  }

  // amount is in base units and slippage in basis points
  private hasValidSwapParams(body): boolean {
    if (!/^[1-9]\d*$/.test(String(body.amount))) return false;
    if (!SWAP_DIRECTIONS.includes(body.swapDirection)) return false;
    if (body.slippage !== undefined && !/^\d+$/.test(String(body.slippage))) return false;
    if (body.slippage !== undefined && Number(body.slippage) > 10000) return false;
    return true;
  }

  private getQueryString(body, allowedParams: string[]): string {
    const qs = new URLSearchParams();
    for (const param of allowedParams) {
      const value = body?.[param];
      if (value === undefined || value === null || value === '') continue;
      qs.append(param, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    return qs.toString();
  }

  private moonpaySwapRequest(
    method: 'get' | 'post',
    keys: { API: string; API_KEY: string },
    uriPath: string,
    opts: { body?: any; failedMsg: string; emptyMsg: string }
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': keys.API_KEY
      };

      const URL: string = keys.API + uriPath;
      // Log the path only: the query string carries wallet addresses
      const logURL: string = keys.API + uriPath.split('?')[0];
      // A redirect would re-send x-api-key to another host
      const requestOpts: any = { headers, json: true, timeout: 30000, followRedirect: false };
      if (opts.body) requestOpts.body = opts.body;

      this.request[method](URL, requestOpts, (err, data) => {
        if (err) {
          // Some request errors quote the full URL, query string included
          const errMsg = String(err.message || err).replace(/\?[^\s"']*/g, '');
          logger.error(`Moonpay Swap request failed with error (${logURL}): ${err.code || ''} ${errMsg}`);
          return reject(new ClientError(opts.failedMsg));
        } else {
          if (data.statusCode >= 300 && data.statusCode < 400) {
            logger.warn(`Moonpay Swap request redirected with status code ${data.statusCode}: ${logURL}`);
            return reject(new ClientError(opts.failedMsg));
          }
          const success = data.statusCode >= 200 && data.statusCode < 300;
          if (!success) {
            logger.warn(`Moonpay Swap request failed with status code ${data.statusCode}: ${logURL}`);
          }
          if (!data.body) {
            return reject(new ClientError(opts.emptyMsg));
          }
          return resolve(data.body);
        }
      });
    });
  }

  moonpaySwapGetChainList(req): Promise<any> {
    let keys;
    try {
      keys = this.moonpaySwapGetKeys(req);
    } catch (err) {
      return Promise.reject(err);
    }

    return this.moonpaySwapRequest('get', keys, '/getChainList', {
      failedMsg: 'Failed to get Moonpay Swap supported chains',
      emptyMsg: 'Moonpay Swap did not return supported chains'
    });
  }

  moonpaySwapGetTokenList(req): Promise<any> {
    let keys;
    try {
      keys = this.moonpaySwapGetKeys(req);
    } catch (err) {
      return Promise.reject(err);
    }

    const qs = this.getQueryString(req.body, ['chainId']);
    return this.moonpaySwapRequest('get', keys, '/getTokenList' + (qs ? `?${qs}` : ''), {
      failedMsg: 'Failed to get Moonpay Swap supported tokens',
      emptyMsg: 'Moonpay Swap did not return supported tokens'
    });
  }

  moonpaySwapGetPaths(req): Promise<any> {
    let keys;
    try {
      keys = this.moonpaySwapGetKeys(req);
    } catch (err) {
      return Promise.reject(err);
    }

    if (!checkRequired(req.body, ['srcChainId', 'srcToken'])) {
      return Promise.reject(new ClientError("Moonpay Swap's request missing arguments"));
    }

    const qs = this.getQueryString(req.body, ['srcChainId', 'srcToken', 'dstChainId', 'dstToken']);
    return this.moonpaySwapRequest('get', keys, `/getPaths?${qs}`, {
      failedMsg: 'Failed to get Moonpay Swap paths',
      emptyMsg: 'Moonpay Swap did not return paths'
    });
  }

  moonpaySwapGetQuote(req): Promise<any> {
    let keys;
    try {
      keys = this.moonpaySwapGetKeys(req);
    } catch (err) {
      return Promise.reject(err);
    }

    if (!checkRequired(req.body, ['srcChainId', 'srcToken', 'dstChainId', 'dstToken', 'amount', 'swapDirection'])) {
      return Promise.reject(new ClientError("Moonpay Swap's request missing arguments"));
    }
    if (!this.hasValidSwapParams(req.body)) {
      return Promise.reject(new ClientError("Moonpay Swap's request has invalid arguments"));
    }

    const qs = this.getQueryString(req.body, QUOTE_PARAMS);
    return this.moonpaySwapRequest('get', keys, `/getQuote?${qs}`, {
      failedMsg: 'Failed to get Moonpay Swap quote',
      emptyMsg: 'Moonpay Swap did not return a quote'
    });
  }

  moonpaySwapGetAction(req): Promise<any> {
    let keys;
    try {
      keys = this.moonpaySwapGetKeys(req);
    } catch (err) {
      return Promise.reject(err);
    }

    if (
      !checkRequired(req.body, [
        'sender',
        'srcChainId',
        'srcToken',
        'dstChainId',
        'dstToken',
        'amount',
        'swapDirection',
        'slippage'
      ])
    ) {
      return Promise.reject(new ClientError("Moonpay Swap's request missing arguments"));
    }
    if (!this.hasValidSwapParams(req.body)) {
      return Promise.reject(new ClientError("Moonpay Swap's request has invalid arguments"));
    }

    req.body.actionType = 'swap-action';
    const qs = this.getQueryString(req.body, ACTION_PARAMS);
    return this.moonpaySwapRequest('get', keys, `/getAction?${qs}`, {
      failedMsg: 'Failed to get Moonpay Swap transaction',
      emptyMsg: 'Moonpay Swap did not return a transaction'
    });
  }

  moonpaySwapGetStatus(req): Promise<any> {
    let keys;
    try {
      keys = this.moonpaySwapGetKeys(req);
    } catch (err) {
      return Promise.reject(err);
    }

    if (!checkRequired(req.body, ['txHash']) && !checkRequired(req.body, ['txId'])) {
      return Promise.reject(new ClientError("Moonpay Swap's request missing arguments"));
    }

    const qs = this.getQueryString(req.body, ['txHash', 'txId', 'chainId']);
    return this.moonpaySwapRequest('get', keys, `/getStatus?${qs}`, {
      failedMsg: 'Failed to get Moonpay Swap status',
      emptyMsg: 'Moonpay Swap did not return a status'
    });
  }

  moonpaySwapRegisterTxs(req): Promise<any> {
    let keys;
    try {
      keys = this.moonpaySwapGetKeys(req);
    } catch (err) {
      return Promise.reject(err);
    }

    if (!checkRequired(req.body, ['txId', 'txHash'])) {
      return Promise.reject(new ClientError("Moonpay Swap's request missing arguments"));
    }

    const failedMsg = 'Failed to register Moonpay Swap transaction';
    return this.moonpaySwapRequest('post', keys, '/registerTxs', {
      body: [{ txId: req.body.txId, txHash: req.body.txHash }],
      failedMsg,
      emptyMsg: 'Moonpay Swap did not return a registration result'
    }).then(result => {
      // swaps.xyz answers 200 with a per-transaction result, so a rejected registration is not an HTTP error
      if (!Array.isArray(result) || result.some(r => !r?.success)) {
        logger.warn(`Moonpay Swap registration was not accepted: ${JSON.stringify(result)}`);
        throw new ClientError(failedMsg);
      }
      return result;
    });
  }
}
