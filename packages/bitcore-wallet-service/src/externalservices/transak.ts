import * as crypto from 'crypto';
import { Web3 } from '@bitpay-labs/crypto-wallet-core';
import * as request from 'request';
import config from '../config';
import { Utils } from '../lib/common/utils';
import { ClientError } from '../lib/errors/clienterror';
import { Lock } from '../lib/lock';
import logger from '../lib/logger';
import { checkRequired } from '../lib/server';
import { Storage } from '../lib/storage';

interface TransakKeys {
  ENV: string;
  API: string;
  API_KEY: string;
  API_KEY_HEADLESS: string | undefined;
  SECRET_KEY: string;
  WIDGET_API: string;
}

interface TransakPartnerToken {
  accessToken: string;
  /** Unix epoch in milliseconds */
  expiresAt: number;
  /** Unix epoch in milliseconds */
  fetchedAt: number;
}

// The partner access token from /partners/api/v2/refresh-token is scoped to
// BitPay's whole Transak account (it can read every order), so it must never
// leave BWS. It is cached in the shared global cache so every BWS instance
// reuses one token until it nears expiry, as Transak requires.
const PARTNER_TOKEN_CACHE_PREFIX = 'transakPartnerToken:';
const PARTNER_TOKEN_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const PARTNER_TOKEN_REFRESH_BUFFER = 10 * 60 * 1000;
// Used if Transak omits expiresAt or returns one that is already (nearly) past.
const PARTNER_TOKEN_FALLBACK_TTL = 60 * 60 * 1000;
// If Transak rejects a token fetched less than this long ago, the rejection
// isn't about token age, so don't refresh again.
const PARTNER_TOKEN_MIN_FORCED_REFRESH_AGE = 60 * 1000;
// Statuses that mean Transak rejected the token itself.
const PARTNER_TOKEN_REJECTED_STATUSES = [401, 403];
// If a refresh can't happen, keep serving the current token until this close
// to its real expiry.
const PARTNER_TOKEN_EXPIRY_MARGIN = 30 * 1000;
const PARTNER_TOKEN_REQUEST_TIMEOUT = 10 * 1000;
// Lock time is well above the request timeout so a holder never outlives its
// lock (Lock.release is not owner-checked).
const PARTNER_TOKEN_LOCK_TIME = 30 * 1000;
const PARTNER_TOKEN_LOCK_WAIT = 15 * 1000;
// After a failed refresh, don't retry for this long (shared across instances),
// so an outage or disabled key doesn't turn every checkout into a refresh call.
const PARTNER_TOKEN_FAILURE_PREFIX = 'transakPartnerTokenFailure:';
const PARTNER_TOKEN_FAILURE_BACKOFF = 30 * 1000;

// App builds and the bitpay.com widget still call getAccessToken and refuse to
// continue without a non-empty accessToken and an integer expiresAt (seconds).
// They get this placeholder; BWS ignores whatever token a client sends back.
const CLIENT_TOKEN_PLACEHOLDER = 'server-managed';
// Short so a rollback (or old pods during a rolling deploy) only sees the
// placeholder briefly; getAccessToken no longer calls Transak, so it's cheap.
const CLIENT_TOKEN_PLACEHOLDER_TTL = 2 * 60; // seconds

// Only these client fields are forwarded to Transak's front-end widget.
const WIDGET_PARAMS = [
  'walletAddress',
  'disableWalletAddressForm',
  'redirectURL',
  'exchangeScreenTitle',
  'fiatAmount',
  'fiatCurrency',
  'network',
  'defaultNetwork',
  'cryptoCurrencyCode',
  'cryptoCurrencyList',
  'hideExchangeScreen',
  'themeColor',
  'hideMenu',
  'partnerOrderId',
  'partnerCustomerId',
  'paymentMethod',
  'defaultPaymentMethod',
];

const ORDER_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

const HEADLESS_PAYMENT_CATEGORIES = ['credit_debit_card', 'apple_pay', 'google_pay'];

// Transak's error message, if any, for logs. Never the whole body.
function transakErrorDetail(data): string {
  const message = data?.body?.error?.message ?? data?.body?.message;
  if (message == null) return '';
  const text = typeof message === 'string' ? message : JSON.stringify(message);
  return ` (${text.slice(0, 200)})`;
}

export class TransakService {
  request: any = request;
  storage: Storage;
  lock: Lock;
  partnerTokenLockWait = PARTNER_TOKEN_LOCK_WAIT;

  constructor(storage: Storage, lock?: Lock) {
    this.storage = storage;
    this.lock = lock ?? new Lock(storage);
  }

  private transakGetKeys(req, cleanBody: boolean = true) {
    if (!config.transak) throw new Error('Transak missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    if (cleanBody) {
      delete req.body.env;
      delete req.body.context;
    }

    const keys: TransakKeys = {
      ENV: env,
      API: config.transak[env].api,
      API_KEY: config.transak[env].apiKey,
      API_KEY_HEADLESS: config.transak[env].apiKeyHeadless,
      SECRET_KEY: config.transak[env].secretKey,
      WIDGET_API: config.transak[env].widgetApi
    };

    return keys;
  }

  // Web requests are proxied through the bitpay backend, so the IP on the
  // request belongs to that server, not the customer. The proxy captures the
  // customer's public IP and forwards it as deviceIp. Web credentials are only
  // held by the proxy, so the forwarded value is trusted for that context only.
  // Falls back to the request IP so web calls keep working until the proxy
  // change that forwards deviceIp is deployed.
  // Must be called before transakGetKeys, which strips context from the body.
  private transakGetUserIp(req): string {
    const isWebContext = req.body?.context === 'web';
    let userIp = (isWebContext && req.body.deviceIp) || Utils.getIpFromReq(req);
    if (userIp) {
      // Canonicalize IPv4-mapped IPv6 (dual-stack sockets report IPv4 clients as
      // ::ffff:1.2.3.4) so Transak sees a plain IPv4 address.
      userIp = String(userIp).trim().replace(/^::ffff:/i, '');
    }
    return userIp || '';
  }

  /**
   * Kept for clients that still fetch a token before checkout. Returns a
   * placeholder in the shape they expect; the real partner token stays in BWS.
   */
  async transakGetAccessToken(req): Promise<{ data: { accessToken: string; expiresAt: number } }> {
    this.transakGetKeys(req);
    return {
      data: {
        accessToken: CLIENT_TOKEN_PLACEHOLDER,
        expiresAt: Math.floor(Date.now() / 1000) + CLIENT_TOKEN_PLACEHOLDER_TTL
      }
    };
  }

  /**
   * Cache/lock id for a partner token. Includes a hash of the API key so a
   * rotated key never reuses a token minted for the old one.
   */
  private partnerTokenId(keys: TransakKeys): string {
    const keyHash = crypto.createHash('sha256').update(String(keys.API_KEY)).digest('hex').slice(0, 12);
    return `${keys.ENV}:${keyHash}`;
  }

  private readCachedPartnerToken(id: string): Promise<TransakPartnerToken | null> {
    return new Promise(resolve => {
      this.storage.checkAndUseGlobalCache(PARTNER_TOKEN_CACHE_PREFIX + id, PARTNER_TOKEN_CACHE_MAX_AGE, (err, values) => {
        if (err) {
          logger.warn(`Transak partner token cache read failed: ${err.message || err}`);
          return resolve(null);
        }
        return resolve(values?.accessToken ? values : null);
      });
    });
  }

  private storeCachedPartnerToken(id: string, token: TransakPartnerToken): Promise<void> {
    return new Promise(resolve => {
      this.storage.storeGlobalCache(PARTNER_TOKEN_CACHE_PREFIX + id, token, err => {
        if (err) logger.warn(`Transak partner token cache write failed: ${err.message || err}`);
        return resolve();
      });
    });
  }

  private recentRefreshFailed(id: string): Promise<boolean> {
    return new Promise(resolve => {
      this.storage.checkAndUseGlobalCache(PARTNER_TOKEN_FAILURE_PREFIX + id, PARTNER_TOKEN_FAILURE_BACKOFF, (err, values) => {
        return resolve(!err && !!values);
      });
    });
  }

  private markRefreshFailed(id: string): Promise<void> {
    return new Promise(resolve => {
      this.storage.storeGlobalCache(PARTNER_TOKEN_FAILURE_PREFIX + id, { failedAt: Date.now() }, () => resolve());
    });
  }

  private acquirePartnerTokenLock(id: string): Promise<((cb?: () => void) => void) | null> {
    return new Promise(resolve => {
      this.lock.acquire(
        PARTNER_TOKEN_CACHE_PREFIX + id,
        { lockTime: PARTNER_TOKEN_LOCK_TIME, waitTime: this.partnerTokenLockWait },
        (err, release) => {
          if (err) {
            logger.warn(`Transak partner token lock not acquired: ${err.message || err}`);
            return resolve(null);
          }
          return resolve(release);
        }
      );
    });
  }

  private isUsablePartnerToken(token: TransakPartnerToken | null, staleToken?: string): boolean {
    return !!token?.accessToken
      && token.accessToken !== staleToken
      && token.expiresAt - PARTNER_TOKEN_REFRESH_BUFFER > Date.now();
  }

  private isUnexpiredPartnerToken(token: TransakPartnerToken | null, staleToken?: string): boolean {
    return !!token?.accessToken
      && token.accessToken !== staleToken
      && token.expiresAt - PARTNER_TOKEN_EXPIRY_MARGIN > Date.now();
  }

  private fetchPartnerToken(keys: TransakKeys, userIp: string): Promise<TransakPartnerToken> {
    return new Promise((resolve, reject) => {
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      const headers = {
        'Content-Type': 'application/json',
        'api-secret': SECRET_KEY,
        'x-api-key': API_KEY,
        'x-user-ip': userIp,
      };

      const body = {
        apiKey: API_KEY
      };

      const URL: string = API + '/partners/api/v2/refresh-token';

      this.request.post(
        URL,
        {
          headers,
          body,
          json: true,
          timeout: PARTNER_TOKEN_REQUEST_TIMEOUT
        },
        (err, data) => {
          if (err) {
            logger.error(`Transak request failed with error (${URL}): ${err.stack || err}`);
            return reject(new ClientError('Failed to get Transak access token'));
          }
          const success = data.statusCode >= 200 && data.statusCode < 300;
          const accessToken = data.body?.data?.accessToken;
          if (!success || !accessToken || typeof accessToken !== 'string') {
            logger.warn(`Transak request failed with status code ${data.statusCode}: ${URL}${transakErrorDetail(data)}`);
            return reject(new ClientError('Transak did not return an access token'));
          }

          // Transak returns expiresAt in seconds; accept milliseconds too. If it
          // is missing or already inside the refresh buffer (e.g. a duration
          // instead of a timestamp), use a fallback TTL rather than treating the
          // token as expired and refreshing on every request.
          const now = Date.now();
          const rawExpiresAt = Number(data.body.data.expiresAt);
          let expiresAt = rawExpiresAt < 1e12 ? rawExpiresAt * 1000 : rawExpiresAt;
          if (!Number.isFinite(expiresAt) || expiresAt - PARTNER_TOKEN_REFRESH_BUFFER <= now) {
            logger.warn(`Transak returned an unusable access token expiresAt (${data.body.data.expiresAt}); using fallback TTL`);
            expiresAt = now + PARTNER_TOKEN_FALLBACK_TTL;
          }
          return resolve({ accessToken, expiresAt, fetchedAt: now });
        }
      );
    });
  }

  /**
   * Returns the cached partner token if usable, or null if a refresh is
   * needed. Throws if a refresh must not happen right now.
   */
  private async checkPartnerTokenCache(id: string, staleToken?: string): Promise<string | null> {
    const cached = await this.readCachedPartnerToken(id);
    if (this.isUsablePartnerToken(cached, staleToken)) return cached.accessToken;

    if (staleToken && cached?.accessToken === staleToken
      && Date.now() - (cached.fetchedAt || 0) < PARTNER_TOKEN_MIN_FORCED_REFRESH_AGE) {
      throw new ClientError('Transak rejected the access token');
    }
    if (await this.recentRefreshFailed(id)) {
      throw new ClientError('Failed to get Transak access token');
    }
    return null;
  }

  /**
   * Returns the cached partner access token, refreshing it at most once across
   * all BWS instances when it is missing, near expiry, or equal to staleToken
   * (a token Transak just rejected).
   */
  private async getPartnerToken(keys: TransakKeys, userIp: string, staleToken?: string): Promise<string> {
    const id = this.partnerTokenId(keys);

    const cached = await this.readCachedPartnerToken(id);
    if (this.isUsablePartnerToken(cached, staleToken)) return cached.accessToken;

    try {
      return await this.refreshPartnerToken(keys, userIp, id, staleToken);
    } catch (err) {
      // The refresh buffer is proactive. If the refresh can't happen right now
      // (backoff, lock timeout, Transak error), keep serving the current token
      // while Transak would still accept it.
      const current = await this.readCachedPartnerToken(id);
      if (this.isUnexpiredPartnerToken(current, staleToken)) {
        logger.warn(`Transak partner token refresh unavailable; using current token: ${err?.message || err}`);
        return current.accessToken;
      }
      throw err;
    }
  }

  private async refreshPartnerToken(keys: TransakKeys, userIp: string, id: string, staleToken?: string): Promise<string> {
    const cached = await this.checkPartnerTokenCache(id, staleToken);
    if (cached) return cached;

    const release = await this.acquirePartnerTokenLock(id);
    if (!release) {
      // Never refresh without the lock: if the holder is slow, every waiter
      // would time out together and refresh at once.
      const afterWait = await this.readCachedPartnerToken(id);
      if (this.isUsablePartnerToken(afterWait, staleToken)) return afterWait.accessToken;
      throw new ClientError('Failed to get Transak access token');
    }

    try {
      // Another instance may have refreshed (or failed) while we waited.
      const recheck = await this.checkPartnerTokenCache(id, staleToken);
      if (recheck) return recheck;

      let fresh: TransakPartnerToken;
      try {
        fresh = await this.fetchPartnerToken(keys, userIp);
      } catch (err) {
        await this.markRefreshFailed(id);
        throw err;
      }
      await this.storeCachedPartnerToken(id, fresh);
      return fresh.accessToken;
    } finally {
      release();
    }
  }

  /**
   * Calls a Transak endpoint with the partner token. If Transak rejects the
   * token (revoked or expired early), refreshes it once and retries.
   */
  private async withPartnerToken(
    keys: TransakKeys,
    userIp: string,
    call: (accessToken: string) => Promise<any>
  ): Promise<any> {
    const accessToken = await this.getPartnerToken(keys, userIp);
    const data = await call(accessToken);
    if (!PARTNER_TOKEN_REJECTED_STATUSES.includes(data?.statusCode)) return data;

    logger.warn('Transak rejected the cached partner token; refreshing');
    const freshToken = await this.getPartnerToken(keys, userIp, accessToken);
    return call(freshToken);
  }

  /**
   * True if address is one of the wallet's addresses in BWS. EVM addresses
   * are matched in any case, since BWS stores them checksummed.
   */
  private isWalletAddress(walletId: string, address: string): Promise<boolean> {
    if (!walletId || !address || typeof address !== 'string') return Promise.resolve(false);
    const candidates = new Set([address]);
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
      candidates.add(address.toLowerCase());
      candidates.add(Web3.utils.toChecksumAddress(address));
    }
    return new Promise(resolve => {
      this.storage.fetchAddressesByWalletId(walletId, [...candidates], (err, addresses) => {
        if (err) {
          logger.warn(`Transak order address lookup failed: ${err.message || err}`);
          return resolve(false);
        }
        return resolve(!!addresses?.length);
      });
    });
  }

  private sendRequest(method: 'get' | 'post' | 'delete', URL: string, opts: any, errorMessage: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.request[method](URL, { ...opts, json: true }, (err, data) => {
        if (err) {
          logger.error(`Transak request failed with error (${URL}): ${err.stack || err}`);
          return reject(new ClientError(errorMessage));
        }
        return resolve(data);
      });
    });
  }

  transakGetCryptoCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys;
      try {
        keys = this.transakGetKeys(req);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': Utils.getIpFromReq(req),
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
            logger.error(`Transak request failed with error (${URL}): ${err.stack || err}`);
            return reject(new ClientError('Failed to get Transak supported currencies'));
          } else {
            const success = data.statusCode >= 200 && data.statusCode < 300;
            if (!success) {
              logger.warn(`Transak request failed with status code ${data.statusCode}: ${URL}`);
            }
            if (!data.body) {
              return reject(new ClientError('Transak did not return supported currencies'));
            }
            return resolve(data.body);
          }
        }
      );
    });
  }

  transakGetFiatCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys;
      try {
        keys = this.transakGetKeys(req);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': Utils.getIpFromReq(req),
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
            logger.error(`Transak request failed with error (${URL}): ${err.stack || err}`);
            return reject(new ClientError('Failed to get Transak supported fiat currencies'));
          } else {
            const success = data.statusCode >= 200 && data.statusCode < 300;
            if (!success) {
              logger.warn(`Transak request failed with status code ${data.statusCode}: ${URL}`);
            }
            if (!data.body) {
              return reject(new ClientError('Transak did not return supported fiat currencies'));
            }
            return resolve(data.body);
          }
        }
      );
    });
  }

  transakGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys;
      try {
        keys = this.transakGetKeys(req);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['fiatCurrency', 'cryptoCurrency', 'network', 'paymentMethod'])) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      const headers = {
        Accept: 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': Utils.getIpFromReq(req),
      };

      const qs: string[] = [];
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
            logger.error(`Transak request failed with error (${URL}): ${err.stack || err}`);
            return reject(new ClientError('Failed to get Transak quote'));
          } else {
            const success = data.statusCode >= 200 && data.statusCode < 300;
            if (!success) {
              logger.warn(`Transak request failed with status code ${data.statusCode}: ${URL}`);
            }
            if (!data.body) {
              return reject(new ClientError('Transak did not return a quote'));
            }
            return resolve(data.body);
          }
        }
      );
    });
  }

  transakGetSignedPaymentUrl(req): Promise<{ urlWithSignature: string }> {
    return new Promise(async (resolve, reject) => {
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
      const referrerDomain = req.body.referrerDomain ?? req.body.context === 'web' ? 'bitpay.com' : 'bitpay';
      const userIp = this.transakGetUserIp(req);
      let keys;
      try {
        keys = this.transakGetKeys(req, false);
      } catch (err) {
        return reject(err);
      }
      const API_KEY = keys.API_KEY;
      const WIDGET_API = keys.WIDGET_API;

      if (!checkRequired(req.body, requiredParams)) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': userIp,
      };

      // Build widgetParams from an allowlist. Spreading req.body here used to
      // forward accessToken, env and context into Transak's front-end widget.
      const widgetBody = {};
      for (const param of WIDGET_PARAMS) {
        if (req.body[param] !== undefined) widgetBody[param] = req.body[param];
      }
      const body = {
        widgetParams: {
          ...widgetBody,
          apiKey: API_KEY,
          referrerDomain,
        },
      };

      const URL: string = WIDGET_API + '/api/v2/auth/session';

      try {
        const data = await this.withPartnerToken(keys, userIp, accessToken =>
          this.sendRequest(
            'post',
            URL,
            { headers: { ...headers, 'access-token': accessToken }, body },
            'Failed to get Transak signed payment URL'
          )
        );
        const widgetUrl = data?.body?.data?.widgetUrl ?? data?.data?.widgetUrl;
        const success = data?.statusCode >= 200 && data?.statusCode < 300;
        if (!success || !widgetUrl) {
          logger.warn(`Transak request failed with status code ${data?.statusCode}: ${URL}${transakErrorDetail(data)}`);
          return reject(new ClientError('Failed to get Transak signed payment URL'));
        }
        return resolve({ urlWithSignature: widgetUrl });
      } catch (err) {
        return reject(err);
      }
    });
  }

  transakGetOrderDetails(req, walletId: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const userIp = this.transakGetUserIp(req);
      let keys;
      try {
        keys = this.transakGetKeys(req, false);
      } catch (err) {
        return reject(err);
      }
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['orderId'])) {
        return reject(new ClientError("Transak's request missing arguments"));
      }

      // orderId goes into the URL path of a request made with the partner token;
      // reject anything that could change the path (e.g. "../orders").
      const orderId = String(req.body.orderId);
      if (!ORDER_ID_PATTERN.test(orderId)) {
        return reject(new ClientError('Invalid Transak orderId'));
      }

      const headers = {
        Accept: 'application/json',
        'x-api-key': API_KEY,
        'x-user-ip': userIp,
      };

      const URL: string = API + `/partners/api/v2/order/${orderId}`;

      try {
        const data = await this.withPartnerToken(keys, userIp, accessToken =>
          this.sendRequest(
            'get',
            URL,
            { headers: { ...headers, 'access-token': accessToken } },
            'Failed to get Transak order details'
          )
        );
        const success = data.statusCode >= 200 && data.statusCode < 300;
        if (!success) {
          logger.warn(`Transak request failed with status code ${data.statusCode}: ${URL}${transakErrorDetail(data)}`);
        }
        if (!data.body) {
          return reject(new ClientError('Transak did not return order details'));
        }
        // An order ID alone isn't proof of ownership: only return an order
        // whose destination address belongs to the requesting wallet.
        if (success && !(await this.isWalletAddress(walletId, data.body?.data?.walletAddress))) {
          logger.warn(`Transak order ${orderId} is not for an address of wallet ${walletId}`);
          return reject(new ClientError('Transak order not found'));
        }
        return resolve(data.body);
      } catch (err) {
        return reject(err);
      }
    });
  }

  // Headless (Whitelabel) API. Transak only accepts these calls from
  // whitelisted partner IPs, so the app reaches them through BWS. The user's
  // accessToken comes from transakHeadlessVerifyOtp and is forwarded as the
  // 'authorization' header; BWS does not store it.
  private async transakHeadlessRequest(
    req,
    opts: {
      method: 'get' | 'post' | 'delete';
      path: string;
      errorMessage: string;
      requiredParams?: string[];
      userAuth?: boolean;
      query?: (apiKey: string) => { [key: string]: string | undefined };
      body?: (apiKey: string) => any;
    }
  ): Promise<any> {
    if (req.body?.context === 'web') {
      throw new ClientError('Transak headless is only available in the app');
    }
    const userIp = this.transakGetUserIp(req);
    const keys = this.transakGetKeys(req, false);
    const API_KEY = keys.API_KEY_HEADLESS;
    const WIDGET_API = keys.WIDGET_API;
    if (!API_KEY || !WIDGET_API) throw new Error('Transak headless missing credentials');

    const requiredParams = [...(opts.userAuth ? ['userAccessToken'] : []), ...(opts.requiredParams ?? [])];
    if (!checkRequired(req.body, requiredParams)) {
      throw new ClientError("Transak's request missing arguments");
    }

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-user-ip': userIp,
      ...(opts.userAuth && { authorization: req.body.userAccessToken }),
    };

    let URL: string = WIDGET_API + opts.path;
    if (opts.query) {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(opts.query(API_KEY))) {
        if (value !== undefined && value !== null && value !== '') qs.append(key, String(value));
      }
      URL += `?${qs.toString()}`;
    }

    const data = await this.sendRequest(
      opts.method,
      URL,
      { headers, ...(opts.body && { body: opts.body(API_KEY) }) },
      opts.errorMessage
    );
    const success = data.statusCode >= 200 && data.statusCode < 300;
    if (!success) {
      logger.warn(`Transak request failed with status code ${data.statusCode}: ${WIDGET_API + opts.path}${transakErrorDetail(data)}`);
    }
    if (!data.body || typeof data.body !== 'object') {
      throw new ClientError(opts.errorMessage);
    }
    return data.body;
  }

  private checkHeadlessOrderId(req): void {
    const orderId = req.body?.orderId;
    if (orderId != null && !ORDER_ID_PATTERN.test(String(orderId))) {
      throw new ClientError('Invalid Transak orderId');
    }
  }

  private async checkHeadlessWalletAddress(req, walletId: string): Promise<void> {
    const walletAddress = req.body?.walletAddress;
    if (walletAddress != null && !(await this.isWalletAddress(walletId, walletAddress))) {
      throw new ClientError('Invalid Transak walletAddress');
    }
  }

  transakHeadlessSendOtp(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'post',
      path: '/api/v2/auth/login',
      errorMessage: 'Failed to send the Transak verification code',
      requiredParams: ['email'],
      body: apiKey => ({ apiKey, email: req.body.email })
    });
  }

  transakHeadlessVerifyOtp(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'post',
      path: '/api/v2/auth/verify',
      errorMessage: 'Failed to verify the Transak verification code',
      requiredParams: ['email', 'otp', 'stateToken'],
      body: apiKey => ({
        apiKey,
        email: req.body.email,
        otp: req.body.otp,
        stateToken: req.body.stateToken
      })
    });
  }

  transakHeadlessGetQuote(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: '/api/v2/lookup/quotes',
      errorMessage: 'Failed to get Transak quote',
      userAuth: true,
      requiredParams: ['fiatCurrency', 'cryptoCurrency', 'network', 'paymentMethod', 'fiatAmount'],
      query: apiKey => ({
        apiKey,
        fiatCurrency: req.body.fiatCurrency,
        cryptoCurrency: req.body.cryptoCurrency,
        isBuyOrSell: 'BUY',
        network: req.body.network,
        paymentMethod: req.body.paymentMethod,
        fiatAmount: req.body.fiatAmount,
        partnerCustomerId: req.body.partnerCustomerId,
        partnerOrderId: req.body.partnerOrderId
      })
    });
  }

  transakHeadlessGetKycRequirement(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: '/api/v2/kyc/requirement',
      errorMessage: 'Failed to get Transak KYC requirement',
      userAuth: true,
      requiredParams: ['quoteId'],
      query: apiKey => ({ apiKey, 'metadata[quoteId]': req.body.quoteId })
    });
  }

  async transakHeadlessGetUserLimits(req): Promise<any> {
    const paymentCategory = req.body?.paymentCategory ?? 'credit_debit_card';
    if (!HEADLESS_PAYMENT_CATEGORIES.includes(paymentCategory)) {
      throw new ClientError('Invalid Transak paymentCategory');
    }
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: '/api/v2/orders/user-limit',
      errorMessage: 'Failed to get Transak user limits',
      userAuth: true,
      requiredParams: ['kycType', 'fiatCurrency'],
      query: () => ({
        isBuyOrSell: 'BUY',
        paymentCategory,
        kycType: req.body.kycType,
        fiatCurrency: req.body.fiatCurrency
      })
    });
  }

  transakHeadlessGetActiveOrders(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: '/api/v2/active-orders',
      errorMessage: 'Failed to get Transak active orders',
      userAuth: true
    });
  }

  async transakHeadlessCancelOrder(req): Promise<any> {
    this.checkHeadlessOrderId(req);
    return this.transakHeadlessRequest(req, {
      method: 'delete',
      path: `/api/v2/orders/${req.body?.orderId}`,
      errorMessage: 'Failed to cancel Transak order',
      userAuth: true,
      requiredParams: ['orderId', 'cancelReason'],
      query: () => ({ cancelReason: req.body.cancelReason })
    });
  }

  transakHeadlessGetSavedCards(req): Promise<any> {
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: '/api/v2/payment-instrument/status',
      errorMessage: 'Failed to get Transak saved cards',
      userAuth: true,
      query: () => ({ paymentInstrumentId: 'credit_debit_card' })
    });
  }

  async transakHeadlessCreateTransactionSession(req, walletId: string): Promise<any> {
    await this.checkHeadlessWalletAddress(req, walletId);
    return this.transakHeadlessRequest(req, {
      method: 'post',
      path: '/api/v2/transaction-session',
      errorMessage: 'Failed to create Transak transaction session',
      userAuth: true,
      requiredParams: ['quoteId', 'walletAddress'],
      body: () => ({
        quoteId: req.body.quoteId,
        walletAddress: req.body.walletAddress,
        ...(req.body.successUrl && { successUrl: req.body.successUrl }),
        ...(req.body.failureUrl && { failureUrl: req.body.failureUrl }),
        ...(req.body.config && { config: req.body.config }),
        ...(req.body.billingAddress && { billingAddress: req.body.billingAddress })
      })
    });
  }

  // New card: only the requestId returned by the card component.
  // Saved card: the quote, wallet and card are sent instead.
  async transakHeadlessCreateOrder(req, walletId: string): Promise<any> {
    if (req.body?.requestId) {
      return this.transakHeadlessRequest(req, {
        method: 'post',
        path: '/api/v2/orders',
        errorMessage: 'Failed to create Transak order',
        userAuth: true,
        body: () => ({ requestId: req.body.requestId })
      });
    }
    await this.checkHeadlessWalletAddress(req, walletId);
    return this.transakHeadlessRequest(req, {
      method: 'post',
      path: '/api/v2/orders',
      errorMessage: 'Failed to create Transak order',
      userAuth: true,
      requiredParams: ['quoteId', 'walletAddress', 'paymentIdentifierId', 'successUrl', 'failureUrl'],
      body: () => ({
        quoteId: req.body.quoteId,
        walletAddress: req.body.walletAddress,
        paymentInstrumentId: 'credit_debit_card',
        paymentIdentifierId: req.body.paymentIdentifierId,
        additionalData: {
          successUrl: req.body.successUrl,
          failureUrl: req.body.failureUrl
        }
      })
    });
  }

  async transakHeadlessGetOrderDetails(req): Promise<any> {
    this.checkHeadlessOrderId(req);
    return this.transakHeadlessRequest(req, {
      method: 'get',
      path: `/api/v2/orders/${req.body?.orderId}`,
      errorMessage: 'Failed to get Transak order details',
      userAuth: true,
      requiredParams: ['orderId']
    });
  }
}