import {
  Constants as ConstantsCWC,
} from 'crypto-wallet-core';
import * as request from 'request';
import config from '../config';
import { Defaults } from '../lib/common/defaults';
import { ClientError } from '../lib/errors/clienterror';
import logger from '../lib/logger';
import { checkRequired } from '../lib/server';
import { Storage } from '../lib/storage';

export class OneInchService {
  request: any = request;
  storage: Storage;

  constructor(storage) {
    this.storage = storage;
  }

  private oneInchGetCredentials() {
    if (!config.oneInch) throw new Error('1Inch missing credentials');

    const credentials = {
      API: config.oneInch.api,
      API_KEY: config.oneInch.apiKey,
      referrerAddress: config.oneInch.referrerAddress,
      referrerFee: config.oneInch.referrerFee
    };

    return credentials;
  }

  oneInchGetReferrerFee(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const credentials = this.oneInchGetCredentials();

      const referrerFee: number = credentials.referrerFee;

      resolve({ referrerFee });
    });
  }

  oneInchGetSwap(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const credentials = this.oneInchGetCredentials();

      if (
        !checkRequired(req.body, [
          'fromTokenAddress',
          'toTokenAddress',
          'amount',
          'fromAddress',
          'slippage',
          'destReceiver'
        ])
      ) {
        return reject(new ClientError('oneInchGetSwap request missing arguments'));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      let qs = [];
      qs.push('fromTokenAddress=' + req.body.fromTokenAddress);
      qs.push('toTokenAddress=' + req.body.toTokenAddress);
      qs.push('amount=' + req.body.amount);
      qs.push('fromAddress=' + req.body.fromAddress);
      qs.push('slippage=' + req.body.slippage);
      qs.push('destReceiver=' + req.body.destReceiver);

      if (credentials.referrerFee) qs.push('fee=' + credentials.referrerFee);
      if (credentials.referrerAddress) qs.push('referrerAddress=' + credentials.referrerAddress);

      const chainNetwork: string = `${req.params?.['chain']?.toUpperCase()}_mainnet` || 'eth_mainnet';
      const chainId: number = ConstantsCWC.EVM_CHAIN_NETWORK_TO_CHAIN_ID[chainNetwork];

      const URL: string = `${credentials.API}/v5.2/${chainId}/swap/?${qs.join('&')}`;

      this.request.get(
        URL,
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  oneInchGetTokens(req): Promise<any> {
    return new Promise((resolve, reject) => {

      const credentials = this.oneInchGetCredentials();
      const chain = req.params?.['chain'] || 'eth';
      const cacheKey = `oneInchTokens:${chain}`;

      this.storage.checkAndUseGlobalCache(cacheKey, Defaults.ONE_INCH_CACHE_DURATION, (err, values, oldvalues) => {
        if (err) logger.warn('Could not get stored tokens list', err);
        if (values) return resolve(values);

        const headers = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + credentials.API_KEY,
        };

        const chainIdMap = {
          eth: 1,
          matic: 137,
          pol: 137,
          arb: 42161,
          base: 8453,
          op: 10,
        };

        const chainId = chainIdMap[chain];

        const URL: string = `${credentials.API}/v5.2/${chainId}/tokens`;

        this.request.get(
          URL,
          {
            headers,
            json: true
          },
          (err, data) => {
            if (err) {
              logger.warn('An error occured while retrieving the token list', err);
              if (oldvalues) {
                logger.warn('Using old cached values');
                return resolve(oldvalues);
              }
              return reject(err.body ?? err);
            } else if (data?.statusCode === 429 && oldvalues) {
              // oneinch rate limit
              return resolve(oldvalues);
            } else {
              if (!data?.body?.tokens) {
                if (oldvalues) {
                  logger.warn('No token list available... using old cached values');
                  return resolve(oldvalues);
                }
                return reject(new Error('Could not get tokens list'));
              }
              this.storage.storeGlobalCache(cacheKey, data.body.tokens, err => {
                if (err) {
                  logger.warn('Could not store tokens list');
                }
                return resolve(data.body.tokens);
              });
            }
          }
        );
      });
    });
  }
}