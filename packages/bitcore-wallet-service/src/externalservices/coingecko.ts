import { Validation } from 'crypto-wallet-core';
import * as request from 'request';
import config from '../config';
import { Constants } from '../lib/common/constants';
import { Defaults } from '../lib/common/defaults';
import logger from '../lib/logger';
import { Storage } from '../lib/storage';
import type { Request } from 'express';

type CoinMarketStats = {
  symbol: string;
  name: string;
  image?: string;
  price: number | null;
  high52w: number | null;
  low52w: number | null;
  volume24h: number | null;
  circulatingSupply: number | null;
  marketCap: number | null;
  lastUpdated?: string;
  about?: string;
};

type FiatRatePoint = { ts: number; rate: number };

type TokenListToken = {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
};

type CoinGeckoRequest = Pick<Request, 'params' | 'query'>;

const SUPPORTED_FIAT_CODES = new Set<string>(Defaults.FIAT_CURRENCIES.map(f => f.code));

const ALLOWED_DAYS = new Set([1, 7, 30, 90, 365, 1825]);
const DEFAULT_ALL_TIME_DAYS = 100000;

const MAX_QUERY_PARAM_LENGTH = 64;
const CHAIN_PARAM_PATTERN = /^[a-z0-9-_]+$/i;

const COIN_GECKO_REQUEST_TIMEOUT_MS = 15000;

/**
 * Default market-stats / fiat-rates coins when the caller does not specify a coin.
 *
 * Intentionally limited to the subset shown by default in the BitPay app's Exchange Rates view,
 * and cached in the DB.
 */
const DEFAULT_COINS: Record<string, string> = {
  btc: 'bitcoin',
  bch: 'bitcoin-cash',
  doge: 'dogecoin',
  eth: 'ethereum',
  ltc: 'litecoin',
  pol: 'polygon-ecosystem-token',
  sol: 'solana',
  xrp: 'ripple',
};

const DEFAULT_COIN_ENTRIES = Object.entries(DEFAULT_COINS);
const DEFAULT_IDS = DEFAULT_COIN_ENTRIES.map(([, id]) => id);
const DEFAULT_ID_SET = new Set(DEFAULT_IDS);

type EvmChain = (typeof Constants.EVM_CHAINS)[keyof typeof Constants.EVM_CHAINS];
type SvmChain = (typeof Constants.SVM_CHAINS)[keyof typeof Constants.SVM_CHAINS];
type BitPayTokenChain = EvmChain | SvmChain;

const CHAIN_ALIASES = {
  pol: Constants.EVM_CHAINS.MATIC
} as const satisfies Record<string, BitPayTokenChain>;

const COINGECKO_PLATFORM_ID_BY_CHAIN = {
  [Constants.EVM_CHAINS.ARB]: 'arbitrum-one',
  [Constants.EVM_CHAINS.BASE]: 'base',
  [Constants.EVM_CHAINS.ETH]: 'ethereum',
  [Constants.EVM_CHAINS.MATIC]: 'polygon-pos',
  [Constants.EVM_CHAINS.OP]: 'optimistic-ethereum',
  [Constants.SVM_CHAINS.SOL]: 'solana'
} as const satisfies Record<BitPayTokenChain, string>;

const CHAIN_BY_COINGECKO_PLATFORM_ID = Object.entries(COINGECKO_PLATFORM_ID_BY_CHAIN).reduce(
  (acc, [chain, platformId]) => {
    acc[platformId] = chain as BitPayTokenChain;
    return acc;
  },
  {} as Record<string, BitPayTokenChain>
);

function isBitPayTokenChain(value: string): value is BitPayTokenChain {
  return Object.prototype.hasOwnProperty.call(COINGECKO_PLATFORM_ID_BY_CHAIN, value);
}

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

function badRequest(message: string): Error {
  const err: any = new Error(message);
  err.statusCode = 400;
  return err;
}

function getQueryString(query: Record<string, unknown> | undefined, key: string): string | undefined {
  const raw = first(query?.[key]);
  if (raw === undefined || raw === null) return undefined;

  const s = (typeof raw === 'string' ? raw : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : '')
    .trim();

  if (!s) return undefined;
  if (s.length > MAX_QUERY_PARAM_LENGTH) throw badRequest('Query param too long');
  return s;
}

function validateQueryParam(query: Record<string, unknown> | undefined, key: string): string | undefined {
  try {
    return getQueryString(query, key);
  } catch {
    throw badRequest(`Unsupported ${key}`);
  }
}

function parseCoinChainTokenAddress(
  query: Record<string, unknown> | undefined
): { coin?: string; chain?: string; tokenAddress?: string } {
  return {
    coin: validateQueryParam(query, 'coin'),
    chain: validateQueryParam(query, 'chain'),
    tokenAddress: validateQueryParam(query, 'tokenAddress')
  };
}

function normalizeChainSafe(chain: unknown): string | undefined {
  const c = (chain ?? '').toString().trim().toLowerCase();
  if (!c) return undefined;
  if (c.length > MAX_QUERY_PARAM_LENGTH) return undefined;
  if (!CHAIN_PARAM_PATTERN.test(c)) return undefined;

  const normalizedChain = CHAIN_ALIASES[c] || (isBitPayTokenChain(c) ? c : undefined);

  if (!normalizedChain) return undefined;

  return COINGECKO_PLATFORM_ID_BY_CHAIN[normalizedChain];
}

function asNumberOrNull(value: any): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isValidTokenAddressForPlatform(tokenAddress: string, platformId: string): boolean {
  const chain = CHAIN_BY_COINGECKO_PLATFORM_ID[platformId];
  if (!chain) return false;
  return Validation.validateAddress(chain, 'mainnet', tokenAddress);
}

export class CoinGeckoService {
  request: any = request;
  storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  private coinGeckoGetCredentials(): { API: string; API_KEY?: string } {
    if (!config.coinGecko) throw new Error('coinGecko missing credentials');
    return { API: config.coinGecko.api, API_KEY: config.coinGecko.apiKey };
  }

  private coinGeckoGetHeaders(apiKey?: string): Record<string, string | undefined> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-cg-pro-api-key': apiKey
    };
  }

  private cgUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const { API } = this.coinGeckoGetCredentials();
    const base = API.endsWith('/') ? API.slice(0, -1) : API;
    const url = new URL(path.startsWith('/') ? `${base}${path}` : `${base}/${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async withGlobalCache<T>(
    cacheKey: string,
    duration: number,
    fetcher: () => Promise<T>,
    logName = cacheKey
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.storage.checkAndUseGlobalCache(cacheKey, duration, async (err, values, oldvalues) => {
        if (err) logger.warn('%s cache check failed: %o', logName, err);
        if (values !== undefined && values !== null) return resolve(values);

        try {
          const fetched = await fetcher();
          this.storage.storeGlobalCache(cacheKey, fetched, storeErr => {
            if (storeErr) logger.warn('Could not cache %s: %o', logName, storeErr);
            resolve(fetched);
          });
        } catch (e: any) {
          if (e?.statusCode === 429 && oldvalues) return resolve(oldvalues);
          if (oldvalues) {
            logger.warn('Using old cached %s values', logName);
            return resolve(oldvalues);
          }
          reject(e);
        }
      });
    });
  }

  private coinGeckoGetJson(url: string, headers: Record<string, string | undefined>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.get(url, { headers, json: true, timeout: COIN_GECKO_REQUEST_TIMEOUT_MS }, (err, data) => {
        const body = data?.body;
        const status = body?.status;
        const httpStatusCode = data?.statusCode;
        const coinGeckoErrorCode = status?.error_code;

        if (err) {
          logger.error('CoinGecko request failed: %o', { url, httpStatusCode, coinGeckoErrorCode, err, body });
          return reject(err.body ?? err);
        }

        if (httpStatusCode === 429 || coinGeckoErrorCode === 429) {
          logger.warn('CoinGecko rate limit: %o', { url, httpStatusCode, coinGeckoErrorCode, body });
          const rateLimitErr: any = new Error('coinGecko rate limit');
          rateLimitErr.statusCode = 429;
          rateLimitErr.coinGeckoErrorCode = coinGeckoErrorCode;
          rateLimitErr.body = body;
          return reject(rateLimitErr);
        }

        const hasCoinGeckoError = !!(status?.error_code || status?.error_message);
        if ((httpStatusCode && httpStatusCode >= 400) || hasCoinGeckoError) {
          logger.error('CoinGecko request failed: %o', { url, httpStatusCode, coinGeckoErrorCode, body });
          const cgErr: any = new Error(status?.error_message || body?.status || 'coinGecko error');
          cgErr.statusCode = httpStatusCode || coinGeckoErrorCode;
          cgErr.coinGeckoErrorCode = coinGeckoErrorCode;
          cgErr.body = body;
          return reject(cgErr);
        }

        resolve(body);
      });
    });
  }

  private async resolveCoinGeckoId(coin: string | undefined, chain?: unknown, tokenAddress?: string): Promise<string> {
    const sym = (coin || '').trim().toLowerCase();
    if (sym && sym.length > MAX_QUERY_PARAM_LENGTH) throw badRequest('Unsupported coin');

    const chainRaw = first(chain);
    const chainProvided = chainRaw !== undefined && chainRaw !== null && String(chainRaw).trim().length > 0;
    const platformId = normalizeChainSafe(chainRaw);
    const normalizedTokenAddress = tokenAddress?.trim();

    // If chain is provided, tokenAddress is required for deterministic token resolution.
    // Keep invalid-chain errors specific when chain validation fails.
    if (chainProvided && !normalizedTokenAddress) {
      if (!platformId) throw badRequest('Unsupported chain');
      throw badRequest('chain is only supported for token lookups; provide tokenAddress or omit chain for native coins');
    }

    // If a token contract address is provided, require a valid chain and resolve via contract lookup.
    if (normalizedTokenAddress) {
      if (!platformId) throw badRequest('tokenAddress requires valid chain');
      if (!isValidTokenAddressForPlatform(normalizedTokenAddress, platformId)) {
        throw badRequest('Invalid tokenAddress');
      }

      const { API_KEY } = this.coinGeckoGetCredentials();
      const headers = this.coinGeckoGetHeaders(API_KEY);
      try {
        const url = this.cgUrl(
          `/v3/coins/${encodeURIComponent(platformId)}/contract/${encodeURIComponent(normalizedTokenAddress)}`
        );
        const body = await this.coinGeckoGetJson(url, headers);
        const id = (body?.id ?? '').toString().trim().toLowerCase();
        if (!id) throw badRequest('Unsupported tokenAddress');
        const tokenSymbol = (body?.symbol ?? '').toString().trim().toLowerCase();
        if (sym && (!tokenSymbol || tokenSymbol !== sym)) throw badRequest('tokenAddress does not match coin');
        const tokenAssetPlatformId = (body?.asset_platform_id ?? '').toString().trim().toLowerCase();
        const platforms = body?.platforms;
        const detailPlatforms = body?.detail_platforms;
        const platformKeys = (obj: any) => (obj && typeof obj === 'object' ? Object.keys(obj).map(k => k.toLowerCase()) : []);
        const platformSignals = [
          ...(tokenAssetPlatformId ? [tokenAssetPlatformId] : []),
          ...platformKeys(platforms),
          ...platformKeys(detailPlatforms)
        ];
        if (platformSignals.length > 0 && !platformSignals.includes(platformId)) {
          throw badRequest('tokenAddress does not match chain');
        }
        return id;
      } catch (e: any) {
        if (e?.statusCode === 404) {
          throw badRequest('Unsupported tokenAddress');
        }
        throw e;
      }
    }

    if (!sym) throw badRequest('Unsupported coin');

    const defaultId = DEFAULT_COINS[sym];
    if (defaultId) return defaultId;

    // Coin-only requests are intentionally restricted to DEFAULT_COINS.
    // Tokens must be requested with both chain + tokenAddress.
    throw badRequest('Unsupported coin. For token symbols, pass `chain` and `tokenAddress`.');
  }

  private async fetchFiatRatesForId(id: string, vsCurrency: string, days: number): Promise<FiatRatePoint[]> {
    const { API_KEY } = this.coinGeckoGetCredentials();
    const headers = this.coinGeckoGetHeaders(API_KEY);

    const params: any = { vs_currency: vsCurrency, days };
    if (days >= 90) params.interval = 'daily';

    const url = this.cgUrl(`/v3/coins/${encodeURIComponent(id)}/market_chart`, params);
    const body = await this.coinGeckoGetJson(url, headers);

    const prices = Array.isArray(body?.prices) ? body.prices : null;
    if (!prices) throw new Error('CoinGecko market_chart response missing prices');

    return prices
      .map((p: any) => ({ ts: p?.[0], rate: p?.[1] }))
      .filter((p: any) => typeof p.ts === 'number' && typeof p.rate === 'number');
  }

  private async getFiatRatesForId(
    id: string,
    vsCurrency: string,
    days: number,
    useDbCache: boolean
  ): Promise<FiatRatePoint[]> {
    if (!useDbCache) return this.fetchFiatRatesForId(id, vsCurrency, days);

    const cacheKey = `cgFiatRates:${id}:${vsCurrency}:${days}`;
    return this.withGlobalCache(cacheKey, Defaults.COIN_GECKO_MARKET_STATS_CACHE_DURATION, () =>
      this.fetchFiatRatesForId(id, vsCurrency, days)
    );
  }

  private async fetchMarketStats(ids: string[], vsCurrency: string): Promise<CoinMarketStats[]> {
    const { API_KEY } = this.coinGeckoGetCredentials();
    const headers = this.coinGeckoGetHeaders(API_KEY);

    const marketsUrl = this.cgUrl('/v3/coins/markets', {
      vs_currency: vsCurrency,
      ids: ids.join(','),
      order: 'market_cap_desc',
      per_page: 250,
      page: 1,
      sparkline: false
    });

    const marketsBody = await this.coinGeckoGetJson(marketsUrl, headers);
    if (!Array.isArray(marketsBody)) throw new Error('Could not get market data');

    const marketById = new Map<string, any>();
    for (const m of marketsBody) {
      const id = (m?.id ?? '').toString().toLowerCase();
      if (id) marketById.set(id, m);
    }

    const stats = await Promise.all(
      ids.map(async id => {
        const market = marketById.get(id);
        if (!market) throw new Error(`Could not get market data for '${id}'`);

        const chartUrl = this.cgUrl(`/v3/coins/${encodeURIComponent(id)}/market_chart`, {
          vs_currency: vsCurrency,
          days: 365,
          interval: 'daily'
        });

        const infoUrl = this.cgUrl(`/v3/coins/${encodeURIComponent(id)}`, {
          localization: false,
          tickers: false,
          market_data: false,
          community_data: false,
          developer_data: false,
          sparkline: false
        });

        const [chartBody, infoBody] = await Promise.all([
          this.coinGeckoGetJson(chartUrl, headers),
          this.coinGeckoGetJson(infoUrl, headers)
        ]);

        const prices = Array.isArray(chartBody?.prices) ? chartBody.prices : [];
        let high52w: number | null = null;
        let low52w: number | null = null;
        for (const p of prices) {
          const price = p?.[1];
          if (typeof price !== 'number') continue;
          if (high52w === null || price > high52w) high52w = price;
          if (low52w === null || price < low52w) low52w = price;
        }

        const about = infoBody?.description?.en;

        return {
          symbol: (market?.symbol || '').toString().toUpperCase(),
          name: (market?.name || id).toString(),
          image: typeof market?.image === 'string' ? market.image : undefined,
          price: asNumberOrNull(market?.current_price),
          high52w,
          low52w,
          volume24h: asNumberOrNull(market?.total_volume),
          circulatingSupply: asNumberOrNull(market?.circulating_supply),
          marketCap: asNumberOrNull(market?.market_cap),
          lastUpdated: typeof market?.last_updated === 'string' ? market.last_updated : undefined,
          about: typeof about === 'string' ? about : undefined
        } as CoinMarketStats;
      })
    );

    return stats;
  }

  async coinGeckoGetMarketStats(req: CoinGeckoRequest): Promise<CoinMarketStats[]> {
    const currency = (req.params?.['code'] || 'USD').toString().toUpperCase();
    if (!SUPPORTED_FIAT_CODES.has(currency)) throw badRequest(`Unsupported fiat currency code '${currency}'`);

    const vsCurrency = currency.toLowerCase();

    const { coin: coinParam, chain: chainParam, tokenAddress: tokenAddressParam } = parseCoinChainTokenAddress(req.query);

    let ids: string[];
    let cacheKey: string | null = null;

    if (coinParam || chainParam || tokenAddressParam) {
      const id = await this.resolveCoinGeckoId(coinParam, chainParam, tokenAddressParam);
      ids = [id];
      if (DEFAULT_ID_SET.has(id)) cacheKey = `cgMarketStats:${vsCurrency}:${id}`;
    } else {
      ids = DEFAULT_IDS.slice();
      cacheKey = `cgMarketStats:${vsCurrency}`;
    }

    if (!cacheKey) return this.fetchMarketStats(ids, vsCurrency);

    return this.withGlobalCache(cacheKey, Defaults.COIN_GECKO_MARKET_STATS_CACHE_DURATION, () =>
      this.fetchMarketStats(ids, vsCurrency)
    );
  }

  async coinGeckoGetFiatRates(req: CoinGeckoRequest): Promise<Record<string, FiatRatePoint[]> | FiatRatePoint[]> {
    const currency = (req.params?.['code'] || '').toString().toUpperCase();
    if (!SUPPORTED_FIAT_CODES.has(currency)) throw badRequest(`Unsupported fiat currency code '${currency}'`);

    const vsCurrency = currency.toLowerCase();

    const { coin: coinParam, chain: chainParam, tokenAddress: tokenAddressParam } = parseCoinChainTokenAddress(req.query);

    let days = DEFAULT_ALL_TIME_DAYS;
    try {
      const daysParam = getQueryString(req.query, 'days');
      if (daysParam !== undefined) {
        const parsed = +daysParam;
        if (!ALLOWED_DAYS.has(parsed)) throw badRequest('Invalid days');
        days = parsed;
      }
    } catch {
      throw badRequest('Invalid days');
    }

    if (coinParam || chainParam || tokenAddressParam) {
      const id = await this.resolveCoinGeckoId(coinParam, chainParam, tokenAddressParam);
      const useDbCache = DEFAULT_ID_SET.has(id);
      return this.getFiatRatesForId(id, vsCurrency, days, useDbCache);
    }

    const tasks = DEFAULT_COIN_ENTRIES.map(([, id]) => this.getFiatRatesForId(id, vsCurrency, days, true));
    const results = await Promise.allSettled(tasks);

    const out: Record<string, FiatRatePoint[]> = {};
    for (const [i, r] of results.entries()) {
      const coin = DEFAULT_COIN_ENTRIES[i][0];
      if (r.status === 'fulfilled') out[coin] = r.value;
      else {
        const reason: any = r.reason;
        logger.warn('CoinGecko fiat rates fetch failed: %o', {
          coin,
          statusCode: reason?.statusCode,
          err: reason?.message || reason
        });
      }
    }

    return out;
  }

  async coinGeckoGetTokens(req: CoinGeckoRequest): Promise<TokenListToken[]> {
    const chain = (req.params?.['chain'] || 'eth').toString();

    const platformId = normalizeChainSafe(chain);
    if (!platformId) {
      throw badRequest(`Unsupported chain '${chain}'`);
    }

    const cacheKey = `cgTokenList:${platformId}`;

    return this.withGlobalCache(cacheKey, Defaults.COIN_GECKO_CACHE_DURATION, async () => {
      const { API_KEY } = this.coinGeckoGetCredentials();
      const headers = this.coinGeckoGetHeaders(API_KEY);

      const url = this.cgUrl(`/v3/token_lists/${encodeURIComponent(platformId)}/all.json`);
      const body = await this.coinGeckoGetJson(url, headers);

      const tokens = Array.isArray(body?.tokens) ? body.tokens : null;
      if (!tokens) throw new Error('Could not get tokens list');

      return tokens.map((t: any) => {
        if (!t || typeof t !== 'object') return t;
        const logoURI = t?.logoURI?.includes('/thumb/') ? t.logoURI.replace('/thumb/', '/large/') : t.logoURI;
        return { ...t, logoURI };
      });
    });
  }
}
