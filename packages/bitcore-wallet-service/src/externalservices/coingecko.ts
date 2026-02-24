import * as request from 'request';
import config from '../config';
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
  chainId: string;
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

const CHAIN_TO_PLATFORM_ID: Record<string, string> = {
  arb: 'arbitrum-one',
  base: 'base',
  eth: 'ethereum',
  matic: 'polygon-pos',
  op: 'optimistic-ethereum',
  pol: 'polygon-pos',
  sol: 'solana'
};

const SUPPORTED_TOKEN_LIST_PLATFORM_IDS = new Set(Object.values(CHAIN_TO_PLATFORM_ID));

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

function getQueryString(query: Record<string, unknown> | undefined, key: string): string | undefined {
  const raw = first(query?.[key]);
  if (raw === undefined || raw === null) return undefined;

  const s = (typeof raw === 'string' ? raw : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : '')
    .trim();

  if (!s) return undefined;
  if (s.length > MAX_QUERY_PARAM_LENGTH) throw new Error('Query param too long');
  return s;
}

function normalizeChainSafe(chain: unknown): string | undefined {
  const c = (chain ?? '').toString().trim().toLowerCase();
  if (!c) return undefined;
  if (c.length > MAX_QUERY_PARAM_LENGTH) return undefined;
  if (!CHAIN_PARAM_PATTERN.test(c)) return undefined;
  return CHAIN_TO_PLATFORM_ID[c] || c;
}

function asNumberOrNull(value: any): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
      this.request.get(url, { headers, json: true }, (err, data) => {
        const body = data?.body;
        const status = body?.status;
        const httpStatusCode = data?.statusCode;
        const coinGeckoErrorCode = status?.error_code;

        if (err) {
          logger.error('CoinGecko request failed: %o', { url, httpStatusCode, coinGeckoErrorCode, err, body });
          return reject(err.body ?? err);
        }

        if (httpStatusCode === 429 || coinGeckoErrorCode === 429) {
          const rateLimitErr: any = new Error('coinGecko rate limit');
          rateLimitErr.statusCode = 429;
          return reject(rateLimitErr);
        }

        const hasCoinGeckoError = !!(status?.error_code || status?.error_message);
        if ((httpStatusCode && httpStatusCode >= 400) || hasCoinGeckoError) {
          const cgErr: any = new Error(status?.error_message || body?.status || 'coinGecko error');
          cgErr.statusCode = httpStatusCode || coinGeckoErrorCode;
          return reject(cgErr);
        }

        resolve(body);
      });
    });
  }

  private async searchCoinIdsBySymbol(symbol: string): Promise<string[]> {
    const { API_KEY } = this.coinGeckoGetCredentials();
    const headers = this.coinGeckoGetHeaders(API_KEY);

    const q = symbol.trim().toLowerCase();
    if (!q) return [];

    const url = this.cgUrl('/v3/search', { query: q });
    const body = await this.coinGeckoGetJson(url, headers);

    const coins = Array.isArray(body?.coins) ? body.coins : [];
    const out: string[] = [];
    const seen = new Set<string>();

    for (const c of coins) {
      const sym = (c?.symbol ?? '').toString().trim().toLowerCase();
      const id = (c?.id ?? '').toString().trim().toLowerCase();
      if (!id || sym !== q || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }

    return out;
  }

  private async getCoinList(): Promise<Array<{ id: string; symbol: string }>> {
    return this.withGlobalCache('cgCoinList', Defaults.COIN_GECKO_CACHE_DURATION, async () => {
      const { API_KEY } = this.coinGeckoGetCredentials();
      const headers = this.coinGeckoGetHeaders(API_KEY);

      const url = this.cgUrl('/v3/coins/list', { include_platform: false });
      const body = await this.coinGeckoGetJson(url, headers);

      if (!Array.isArray(body)) throw new Error('Could not get coin list');

      return body
        .map((c: any) => ({
          id: (c?.id ?? '').toString().trim().toLowerCase(),
          symbol: (c?.symbol ?? '').toString().trim().toLowerCase()
        }))
        .filter(c => c.id && c.symbol);
    });
  }

  private async getCandidateIdsFromCoinList(symbol: string): Promise<string[]> {
    const q = symbol.trim().toLowerCase();
    if (!q) return [];

    const list = await this.getCoinList();
    const ids = new Set<string>();

    for (const c of list) {
      if (c.symbol === q) ids.add(c.id);
    }

    return Array.from(ids).sort();
  }

  private async resolveCoinGeckoId(coin: string, chain?: unknown, tokenAddress?: string): Promise<string> {
    const sym = coin.trim().toLowerCase();
    if (!sym || sym.length > MAX_QUERY_PARAM_LENGTH) throw new Error('Unsupported coin');

    const platformId = normalizeChainSafe(chain);
    const normalizedTokenAddress = tokenAddress?.trim();

    // If a token contract address is provided, require a valid chain and prefer contract lookup.
    // This intentionally overrides default symbol mappings.
    if (normalizedTokenAddress) {
      if (!platformId) throw new Error('tokenAddress requires valid chain');

      const { API_KEY } = this.coinGeckoGetCredentials();
      const headers = this.coinGeckoGetHeaders(API_KEY);
      try {
        const url = this.cgUrl(
          `/v3/coins/${encodeURIComponent(platformId)}/contract/${encodeURIComponent(normalizedTokenAddress)}`
        );
        const body = await this.coinGeckoGetJson(url, headers);
        const id = (body?.id ?? '').toString().trim().toLowerCase();
        if (!id) throw new Error('Unsupported tokenAddress');
        const tokenSymbol = (body?.symbol ?? '').toString().trim().toLowerCase();
        if (!tokenSymbol || tokenSymbol !== sym) throw new Error('tokenAddress does not match coin');
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
          throw new Error('tokenAddress does not match chain');
        }
        return id;
      } catch (e: any) {
        if (e?.statusCode === 404) {
          throw new Error('Unsupported tokenAddress');
        }
        throw e;
      }
    }

    const defaultId = DEFAULT_COINS[sym];
    if (defaultId) return defaultId;

    // Prefer /search for market-cap ordering; fallback to coin-list only if needed.
    let candidates = await this.searchCoinIdsBySymbol(sym);
    if (!candidates.length) candidates = await this.getCandidateIdsFromCoinList(sym);
    if (!candidates.length) throw new Error(`Unsupported coin '${coin}'`);

    if (!platformId) return candidates[0];

    const { API_KEY } = this.coinGeckoGetCredentials();
    const headers = this.coinGeckoGetHeaders(API_KEY);

    let secondary: string | undefined;
    for (const id of candidates.slice(0, 10)) {
      try {
        const url = this.cgUrl(`/v3/coins/${encodeURIComponent(id)}`, {
          localization: false,
          tickers: false,
          market_data: false,
          community_data: false,
          developer_data: false,
          sparkline: false
        });

        const info = await this.coinGeckoGetJson(url, headers);

        const assetPlatformId = (info?.asset_platform_id ?? '').toString().trim().toLowerCase();
        if (assetPlatformId && assetPlatformId === platformId) return id;

        const platforms = info?.platforms;
        const detailPlatforms = info?.detail_platforms;
        const keys = (obj: any) => (obj && typeof obj === 'object' ? Object.keys(obj).map(k => k.toLowerCase()) : []);

        if (!secondary && (keys(platforms).includes(platformId) || keys(detailPlatforms).includes(platformId))) {
          secondary = id;
        }
      } catch {
        // Best-effort only.
      }
    }

    if (secondary) return secondary;

    throw new Error('chain does not match coin');
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
    if (!SUPPORTED_FIAT_CODES.has(currency)) throw new Error(`Unsupported fiat currency code '${currency}'`);

    const vsCurrency = currency.toLowerCase();

    let coinParam: string | undefined;
    try {
      coinParam = getQueryString(req.query, 'coin');
    } catch {
      throw new Error('Unsupported coin');
    }

    let chainParam: string | undefined;
    try {
      chainParam = getQueryString(req.query, 'chain');
    } catch {
      chainParam = undefined;
    }

    let tokenAddressParam: string | undefined;
    try {
      tokenAddressParam = getQueryString(req.query, 'tokenAddress');
    } catch {
      throw new Error('Unsupported tokenAddress');
    }

    let ids: string[];
    let cacheKey: string | null = null;

    if (coinParam) {
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
    if (!SUPPORTED_FIAT_CODES.has(currency)) throw new Error(`Unsupported fiat currency code '${currency}'`);

    const vsCurrency = currency.toLowerCase();

    let coinParam: string | undefined;
    try {
      coinParam = getQueryString(req.query, 'coin');
    } catch {
      throw new Error('Unsupported coin');
    }

    let chainParam: string | undefined;
    try {
      chainParam = getQueryString(req.query, 'chain');
    } catch {
      chainParam = undefined;
    }

    let tokenAddressParam: string | undefined;
    try {
      tokenAddressParam = getQueryString(req.query, 'tokenAddress');
    } catch {
      throw new Error('Unsupported tokenAddress');
    }

    let days = DEFAULT_ALL_TIME_DAYS;
    try {
      const daysParam = getQueryString(req.query, 'days');
      if (daysParam !== undefined) {
        const parsed = +daysParam;
        if (!ALLOWED_DAYS.has(parsed)) throw new Error('Invalid days');
        days = parsed;
      }
    } catch {
      throw new Error('Invalid days');
    }

    if (coinParam) {
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
    if (!platformId || !SUPPORTED_TOKEN_LIST_PLATFORM_IDS.has(platformId)) {
      throw new Error(`Unsupported chain '${chain}'`);
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
        if (t?.logoURI?.includes('/thumb/')) {
          t.logoURI = t.logoURI.replace('/thumb/', '/large/');
        }
        return t;
      });
    });
  }
}
