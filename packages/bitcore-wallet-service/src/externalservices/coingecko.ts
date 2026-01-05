import * as request from 'request';
import config from '../config';
import { Defaults } from '../lib/common/defaults';
import logger from '../lib/logger';
import { Storage } from '../lib/storage';

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

  private getDefaultMarketStatsSymbols(): string[] {
    return ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'BCH', 'SHIB', 'POL', 'APE', 'LTC', 'WBTC', 'WETH'];
  }

  private resolveCoinGeckoId(coin: string): string {
    const normalized = coin.trim().toLowerCase();
    const symbolToIdMap: Record<string, string> = {
      btc: 'bitcoin',
      eth: 'ethereum',
      xrp: 'ripple',
      sol: 'solana',
      doge: 'dogecoin',
      bch: 'bitcoin-cash',
      shib: 'shiba-inu',
      pol: 'polygon-ecosystem-token',
      ape: 'apecoin',
      ltc: 'litecoin',
      wbtc: 'wrapped-bitcoin',
      weth: 'weth'
    };

    if (symbolToIdMap[normalized]) return symbolToIdMap[normalized];

    const knownIds = new Set(Object.values(symbolToIdMap));
    if (knownIds.has(normalized)) return normalized;

    throw new Error(`Unsupported coin '${coin}'`);
  }

  private coinGeckoGetJson(url: string, headers: Record<string, string | undefined>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request.get(
        url,
        {
          headers,
          json: true
        },
        (err, data) => {
          const status = data?.body?.status;
          const statusCode = data?.statusCode || status?.error_code;

          if (err) return reject(err.body ?? err);
          if (statusCode === 429) {
            const rateLimitErr: any = new Error('coinGecko rate limit');
            rateLimitErr.statusCode = 429;
            return reject(rateLimitErr);
          }
          return resolve(data?.body);
        }
      );
    });
  }

  coinGeckoGetMarketStats(req): Promise<CoinMarketStats[]> {
    return new Promise((resolve, reject) => {
      const currency = (req.params?.['code'] || 'USD').toString().toUpperCase();
      const vsCurrency = currency.toLowerCase();
      const coinParam = (req.query?.coin as string) || null;
      const symbols = coinParam ? [coinParam] : this.getDefaultMarketStatsSymbols();

      let ids: string[];
      try {
        ids = symbols.map(s => this.resolveCoinGeckoId(s));
      } catch (e) {
        return reject(e);
      }

      const cacheKey = `cgMarketStats:${vsCurrency}:${ids.join(',')}`;
      const credentials = this.coinGeckoGetCredentials();
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-cg-pro-api-key': credentials.API_KEY
      };

      this.storage.checkAndUseGlobalCache(cacheKey, Defaults.COIN_GECKO_MARKET_STATS_CACHE_DURATION, async (err, values, oldvalues) => {
        if (err) logger.warn('Cache check failed', err);
        if (values) return resolve(values);

        try {
          const marketsUrl = `${credentials.API}/v3/coins/markets?vs_currency=${encodeURIComponent(vsCurrency)}&ids=${encodeURIComponent(
            ids.join(',')
          )}&order=market_cap_desc&per_page=250&page=1&sparkline=false`;
          const marketsBody = await this.coinGeckoGetJson(marketsUrl, headers);

          if (!Array.isArray(marketsBody)) throw new Error('Could not get market data');

          const marketById = new Map<string, any>();
          for (const marketItem of marketsBody) {
            if (marketItem?.id) marketById.set(marketItem.id, marketItem);
          }

          const perCoinStats = await Promise.all(
            ids.map(async id => {
              const marketItem = marketById.get(id);
              if (!marketItem) throw new Error(`Could not get market data for '${id}'`);

              const chartUrl = `${credentials.API}/v3/coins/${encodeURIComponent(
                id
              )}/market_chart?vs_currency=${encodeURIComponent(vsCurrency)}&days=365&interval=daily`;
              const infoUrl = `${credentials.API}/v3/coins/${encodeURIComponent(
                id
              )}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;

              const [chartBody, infoBody] = await Promise.all([
                this.coinGeckoGetJson(chartUrl, headers),
                this.coinGeckoGetJson(infoUrl, headers)
              ]);

              const prices: Array<[number, number]> = chartBody?.prices || [];
              let high52w: number | null = null;
              let low52w: number | null = null;
              for (const p of prices) {
                const price = p?.[1];
                if (typeof price !== 'number') continue;
                if (high52w === null || price > high52w) high52w = price;
                if (low52w === null || price < low52w) low52w = price;
              }

              const about = infoBody?.description?.en;

              const stats: CoinMarketStats = {
                symbol: (marketItem?.symbol || '').toUpperCase(),
                name: marketItem?.name,
                image: marketItem?.image,
                price: typeof marketItem?.current_price === 'number' ? marketItem.current_price : null,
                high52w,
                low52w,
                volume24h: typeof marketItem?.total_volume === 'number' ? marketItem.total_volume : null,
                circulatingSupply:
                  typeof marketItem?.circulating_supply === 'number' ? marketItem.circulating_supply : null,
                marketCap: typeof marketItem?.market_cap === 'number' ? marketItem.market_cap : null,
                lastUpdated: marketItem?.last_updated,
                about: typeof about === 'string' ? about : undefined
              };

              return { id, stats };
            })
          );

          const order = new Map<string, number>();
          let i = 0;
          for (const s of symbols) {
            order.set(this.resolveCoinGeckoId(s), i);
            i++;
          }
          const sortedStats = perCoinStats
            .slice()
            .sort((a, b) => {
              const ai = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
              const bi = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
              return ai - bi;
            })
            .map(entry => entry.stats);

          const response = sortedStats;
          this.storage.storeGlobalCache(cacheKey, response, storeErr => {
            if (storeErr) logger.warn('Could not cache market stats', storeErr);
            return resolve(response);
          });
        } catch (e: any) {
          const statusCode = e?.statusCode;
          if (statusCode === 429 && oldvalues) {
            return resolve(oldvalues);
          }
          if (oldvalues) {
            logger.warn('Using old cached values');
            return resolve(oldvalues);
          }
          return reject(e);
        }
      });
    });
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