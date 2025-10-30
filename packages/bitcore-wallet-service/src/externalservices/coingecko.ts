import * as request from 'request';
import config from '../config';
import { Defaults } from '../lib/common/defaults';
import logger from '../lib/logger';
import { Storage } from '../lib/storage';

export class CoinGeckoService {
  request: any = request;
  storage: Storage;

  constructor(storage) {
    this.storage = storage;
  }

  private coinGeckoGetCredentials() {
    if (!config.coinGecko) throw new Error('coinGecko missing credentials');

    const credentials = {
      API: config.coinGecko.api,
      API_KEY: config.coinGecko.apiKey,
    };

    return credentials;
  }

  coinGeckoGetTokens(req): Promise<Array<{
    chainId: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI: string;
  }>> {
    return new Promise((resolve, reject) => {
      const chain = req.params?.['chain'] || 'eth';
      const cacheKey = `cgTokenList:${chain}`;
      const credentials = this.coinGeckoGetCredentials();

      this.storage.checkAndUseGlobalCache(cacheKey, Defaults.COIN_GECKO_CACHE_DURATION, (err, values, oldvalues) => {
        if (err) logger.warn('Cache check failed', err);
        if (values) return resolve(values);

        const assetPlatformMap = {
          eth: 'ethereum',
          matic: 'polygon-pos',
          pol: 'polygon-pos',
          arb: 'arbitrum-one',
          base: 'base',
          op: 'optimistic-ethereum',
          sol: 'solana',
        };

        const assetId = assetPlatformMap[chain];
        if (!assetId) return reject(new Error(`Unsupported chain '${chain}'`));

        const URL: string = `${credentials.API}/v3/token_lists/${assetId}/all.json`;
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-cg-pro-api-key': credentials.API_KEY
        };

        this.request.get(
          URL,
          {
            headers,
            json: true
          },
          (err, data) => {
            const tokens = data?.body?.tokens;
            const status = data?.body?.status;
            if (err) {
              logger.warn('An error occured while retrieving the token list', err);
              if (oldvalues) {
                logger.warn('Using old cached values');
                return resolve(oldvalues);
              }
              return reject(err.body ?? err);
            } else if (status?.error_code === 429 && oldvalues) {
              return resolve(oldvalues);
            } else {
              if (!tokens) {
                if (oldvalues) {
                  logger.warn('No token list available... using old cached values');
                  return resolve(oldvalues);
                }
                return reject(new Error(`Could not get tokens list. Code: ${status?.error_code}. Error: ${status?.error_message || 'Unknown error'}`));
              }
              const updatedTokens = tokens.map(token => {
                if (token.logoURI?.includes('/thumb/')) {
                  token.logoURI = token.logoURI.replace('/thumb/', '/large/');
                }
                return token;
              });
              this.storage.storeGlobalCache(cacheKey, updatedTokens, storeErr => {
                if (storeErr) logger.warn('Could not cache token list', storeErr);
                return resolve(updatedTokens);
              });
            }
          });
      });
    });
  }
}