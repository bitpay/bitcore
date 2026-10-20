import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { checkRequired } from '../lib/server';

/**
 * Rango Exchange — cross-chain swap aggregator (Basic API, single step).
 *
 * Rango authenticates with an `apiKey` query parameter rather than a header, so
 * the key is appended here and never leaves BWS. The app talks only to the
 * routes in expressapp.ts.
 *
 * Docs: https://docs.rango.exchange/api-integration/basic-api-single-step
 */
/**
 * Environment the two unauthenticated metadata routes always use, whatever
 * the caller asks for. Metadata is identical between environments, so there
 * is nothing to gain by letting an anonymous request pick production.
 */
const RANGO_PUBLIC_ENV: 'sandbox' | 'production' = 'sandbox';

/** Upstream request timeout. Rango's meta payload is large, so this is generous. */
const RANGO_REQUEST_TIMEOUT_MS = 30000;

/**
 * How long a metadata response is reused before it is fetched again.
 *
 * This cache is what actually bounds the two public routes. `setPublicCache`
 * only sets a Cache-Control header, and both routes are POST, so no browser or
 * shared cache stores the response — without this every anonymous call spends
 * a Rango request on our API key.
 */
const RANGO_META_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Module scope, deliberately: `WalletService.getInstance()` builds a new
 * RangoService per request, so an instance field would never be read twice.
 */
const rangoMetaCache = new Map<string, { at: number; value: Promise<any> }>();

/** Drops every cached metadata response. Exists for tests. */
export function resetRangoMetaCache(): void {
  rangoMetaCache.clear();
}

/**
 * Caches the in-flight promise rather than the settled value, so a burst of
 * concurrent callers shares one upstream request instead of starting one each.
 * A rejected fetch is evicted so a transient Rango failure is not served for
 * the rest of the TTL.
 */
function rangoCachedGet(key: string, fetch: () => Promise<any>): Promise<any> {
  const hit = rangoMetaCache.get(key);
  if (hit && Date.now() - hit.at < RANGO_META_CACHE_TTL_MS) {
    return hit.value;
  }

  const value = fetch().catch(err => {
    rangoMetaCache.delete(key);
    throw err;
  });

  rangoMetaCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Chains BitPay custodies. The metadata route is public, so the chain filter
 * is pinned here rather than taken from the request — an unfiltered
 * /basic/meta is ~13 MB, which an unauthenticated caller could otherwise make
 * BWS fetch and re-serve on our API key.
 */
const RANGO_ALLOWED_BLOCKCHAINS = [
  'BTC',
  'BCH',
  'DOGE',
  'LTC',
  'ETH',
  'POLYGON',
  'ARBITRUM',
  'BASE',
  'OPTIMISM',
  'SOLANA'
];

/** Rango caps the referrer fee at 3%. */
const RANGO_MAX_REFERRER_FEE = 3;

/**
 * Slippage is a percent the client chooses. The app sends either Rango's own
 * quoted slippage or 1.5, so anything outside this range is a client bug —
 * and an unbounded value silently buys a route the user did not intend.
 */
const RANGO_DEFAULT_SLIPPAGE = 1.5;
const RANGO_MAX_SLIPPAGE = 50;

export class RangoService {
  request: any = request;

  /**
   * Builds a query string with every value percent-encoded.
   *
   * Asset identifiers are user-influenced and routinely contain characters
   * that change a URL's meaning: '.' and '--' always, and symbols such as
   * 'USD₮0' are already listed on chains we support. Raw concatenation lets a
   * '#' truncate the query (dropping apiKey) or an '&' inject parameters.
   */
  private rangoQs(params: Record<string, string | number | undefined>): string {
    return Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
  }

  /**
   * Referrer fee and address are read from server config only. They are never
   * taken from the request: a client could otherwise redirect BitPay's
   * affiliate revenue to its own address, or zero the fee.
   *
   * Both are applied together or not at all — Rango's quote endpoint needs the
   * fee to price the route and the swap endpoint needs both, so setting one
   * without the other makes the quoted output differ from what the user gets.
   */
  private rangoReferrer(keys: {
    REFERRER_ADDRESS: string;
    REFERRER_FEE: string;
  }): { referrerFee?: string; referrerAddress?: string } {
    const fee = Number(keys.REFERRER_FEE);
    if (!keys.REFERRER_ADDRESS || !keys.REFERRER_FEE || !Number.isFinite(fee)) {
      return {};
    }
    // A plain Error, not a ClientError: a misconfigured fee is our fault, and
    // ClientError answers 400, which blames the caller and pages nobody. The
    // configured value is left out of the message — it does not cross the
    // boundary.
    if (fee <= 0 || fee > RANGO_MAX_REFERRER_FEE) {
      throw new Error(
        `Rango referrerFee must be between 0 and ${RANGO_MAX_REFERRER_FEE}`
      );
    }
    return { referrerFee: keys.REFERRER_FEE, referrerAddress: keys.REFERRER_ADDRESS };
  }

  /**
   * Bounds the client-supplied slippage. Absent means "use the default"; a
   * value outside the accepted range is rejected rather than forwarded.
   */
  private rangoSlippage(value: unknown): number {
    if (value === undefined || value === null || value === '') {
      return RANGO_DEFAULT_SLIPPAGE;
    }
    const slippage = Number(value);
    if (!Number.isFinite(slippage) || slippage <= 0 || slippage > RANGO_MAX_SLIPPAGE) {
      throw new ClientError(
        `Rango slippage must be between 0 and ${RANGO_MAX_SLIPPAGE}`
      );
    }
    return slippage;
  }

  /**
   * @param opts.forcedEnv pins the environment regardless of what the caller
   *   asked for. Used by the two unauthenticated metadata routes: without it
   *   anonymous callers can select `production` and burn the quota on the
   *   production key, which is the one credential we cannot cheaply rotate.
   */
  private rangoGetKeys(req, opts?: { forcedEnv?: 'sandbox' | 'production' }) {
    if (!config.rango) throw new Error('Rango missing credentials');

    const env: 'sandbox' | 'production' =
      opts?.forcedEnv ?? (req.body.env === 'production' ? 'production' : 'sandbox');

    delete req.body.env;

    // Also a server fault, not a client one.
    if (!config.rango[env]) {
      throw new Error(`Rango is not configured for the ${env} environment`);
    }

    const keys: {
      API: string;
      API_KEY: string;
      REFERRER_ADDRESS: string;
      REFERRER_FEE: string;
    } = {
      API: config.rango[env].api,
      API_KEY: config.rango[env].apiKey,
      REFERRER_ADDRESS: config.rango[env].referrerAddress,
      REFERRER_FEE: config.rango[env].referrerFee
    };

    return keys;
  }

  /**
   * Shared GET helper. Rango returns 200 with an `error` field for business
   * failures, so callers must inspect the body as well as the status.
   */
  private rangoGet(URL: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      this.request.get(
        URL,
        {
          headers,
          json: true,
          // Without this a Rango endpoint that accepts the connection but
          // never answers holds the socket open indefinitely. The app's own
          // pollers check their deadline only between requests, so one hung
          // call strands the swap and the sockets accumulate here.
          timeout: RANGO_REQUEST_TIMEOUT_MS
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

  /**
   * Blockchains, tokens and swapper metadata. `blockchains` narrows the
   * response, which matters because the full meta payload is multi-megabyte.
   */
  rangoGetSupportedChains(req): Promise<any> {
    // Public route: environment is pinned, not caller-selected.
    const keys = this.rangoGetKeys(req, { forcedEnv: RANGO_PUBLIC_ENV });
    const qs = this.rangoQs({ apiKey: keys.API_KEY });
    // Keyed on the route and environment, never on the URL — that carries the
    // API key.
    return rangoCachedGet(`${RANGO_PUBLIC_ENV}:blockchains`, () =>
      this.rangoGet(keys.API + `/basic/meta/blockchains?${qs}`)
    );
  }

  rangoGetCryptoCurrencies(req): Promise<any> {
    // Public route: environment is pinned, not caller-selected.
    const keys = this.rangoGetKeys(req, { forcedEnv: RANGO_PUBLIC_ENV });

    // Blockchains are NOT taken from the request. This route is public and an
    // unfiltered response is multi-megabyte.
    const qs = this.rangoQs({
      apiKey: keys.API_KEY,
      blockchains: RANGO_ALLOWED_BLOCKCHAINS.join(','),
      // Pinned, not client-controlled. With the chain filter but
      // excludeNonPopulars=false Rango still returns ~32,800 tokens / 12.9 MB,
      // which an unauthenticated caller could pull repeatedly on our API key.
      excludeNonPopulars: 'true'
    });

    return rangoCachedGet(`${RANGO_PUBLIC_ENV}:meta`, () =>
      this.rangoGet(keys.API + `/basic/meta?${qs}`)
    );
  }

  /**
   * Preview route. Does not need wallet addresses, so it can be called before
   * the user has picked a destination wallet.
   */
  rangoGetSwapQuote(req): Promise<any> {
    const keys = this.rangoGetKeys(req);

    if (!checkRequired(req.body, ['from', 'to', 'amount'])) {
      return Promise.reject(new ClientError("Rango's request missing arguments"));
    }

    const referrer = this.rangoReferrer(keys);

    const qs = this.rangoQs({
      apiKey: keys.API_KEY,
      from: req.body.from,
      to: req.body.to,
      amount: req.body.amount,
      slippage: this.rangoSlippage(req.body.slippage),
      // Must match the swap call exactly or the quoted output is not what the
      // user receives.
      referrerFee: referrer.referrerFee
    });

    return this.rangoGet(keys.API + `/basic/quote?${qs}`);
  }

  /**
   * Final quote plus the unsigned transaction. The response `tx` is one of
   * EVM | TRANSFER | SOLANA | COSMOS | STARKNET | TRON — the app only handles
   * EVM, TRANSFER and SOLANA, matching the chains the wallet custodies.
   */
  rangoCreateSwapTx(req): Promise<any> {
    const keys = this.rangoGetKeys(req);

    if (!checkRequired(req.body, ['from', 'to', 'amount', 'fromAddress', 'toAddress'])) {
      return Promise.reject(new ClientError("Rango's request missing arguments"));
    }

    const referrer = this.rangoReferrer(keys);

    const qs = this.rangoQs({
      apiKey: keys.API_KEY,
      from: req.body.from,
      to: req.body.to,
      amount: req.body.amount,
      slippage: this.rangoSlippage(req.body.slippage),
      fromAddress: req.body.fromAddress,
      toAddress: req.body.toAddress,
      referrerFee: referrer.referrerFee,
      referrerAddress: referrer.referrerAddress,
      disableEstimate: req.body.disableEstimate
    });

    return this.rangoGet(keys.API + `/basic/swap?${qs}`);
  }

  /**
   * Poll after broadcasting. Rango keys status on the requestId it issued at
   * swap time plus the on-chain hash of the transaction we broadcast.
   */
  rangoGetStatus(req): Promise<any> {
    const keys = this.rangoGetKeys(req);

    if (!checkRequired(req.body, ['requestId', 'txId'])) {
      return Promise.reject(new ClientError("Rango's request missing arguments"));
    }

    const qs = this.rangoQs({
      apiKey: keys.API_KEY,
      requestId: req.body.requestId,
      txId: req.body.txId
    });

    return this.rangoGet(keys.API + `/basic/status?${qs}`);
  }

  /**
   * ERC20 allowance check for the spender Rango nominated for this quote.
   * Note the spender can be quote-specific, so it must be read from the swap
   * response rather than cached.
   */
  rangoIsApproved(req): Promise<any> {
    const keys = this.rangoGetKeys(req);

    if (!checkRequired(req.body, ['requestId', 'txId'])) {
      return Promise.reject(new ClientError("Rango's request missing arguments"));
    }

    const qs = this.rangoQs({
      apiKey: keys.API_KEY,
      requestId: req.body.requestId,
      txId: req.body.txId
    });

    return this.rangoGet(keys.API + `/basic/is-approved?${qs}`);
  }

  /**
   * Report a client-side signing or broadcast failure so Rango can release the
   * route reservation instead of leaving it pending.
   */
  rangoReportFailure(req): Promise<any> {
    const keys = this.rangoGetKeys(req);

    if (!checkRequired(req.body, ['requestId', 'eventType'])) {
      return Promise.reject(new ClientError("Rango's request missing arguments"));
    }

    return new Promise((resolve, reject) => {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      const URL: string = keys.API + `/basic/report-tx?${this.rangoQs({ apiKey: keys.API_KEY })}`;

      this.request.post(
        URL,
        {
          headers,
          body: req.body,
          json: true,
          // Same reason as rangoGet: without this a Rango endpoint that
          // accepts the connection but never answers holds the socket open
          // indefinitely, and they accumulate during an upstream incident.
          timeout: RANGO_REQUEST_TIMEOUT_MS
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
