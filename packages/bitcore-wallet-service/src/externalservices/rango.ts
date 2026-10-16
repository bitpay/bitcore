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
    if (fee <= 0 || fee > RANGO_MAX_REFERRER_FEE) {
      throw new Error(
        `Rango referrerFee must be between 0 and ${RANGO_MAX_REFERRER_FEE}, got ${keys.REFERRER_FEE}`
      );
    }
    return { referrerFee: keys.REFERRER_FEE, referrerAddress: keys.REFERRER_ADDRESS };
  }

  private rangoGetKeys(req) {
    if (!config.rango) throw new Error('Rango missing credentials');

    const env: 'sandbox' | 'production' = req.body.env === 'production' ? 'production' : 'sandbox';

    delete req.body.env;

    if (!config.rango[env]) {
      throw new ClientError(`Rango is not configured for the ${env} environment`);
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

  /**
   * Blockchains, tokens and swapper metadata. `blockchains` narrows the
   * response, which matters because the full meta payload is multi-megabyte.
   */
  rangoGetSupportedChains(req): Promise<any> {
    const keys = this.rangoGetKeys(req);
    const qs = this.rangoQs({ apiKey: keys.API_KEY });
    return this.rangoGet(keys.API + `/basic/meta/blockchains?${qs}`);
  }

  rangoGetCryptoCurrencies(req): Promise<any> {
    const keys = this.rangoGetKeys(req);

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

    return this.rangoGet(keys.API + `/basic/meta?${qs}`);
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

    let referrer;
    try {
      referrer = this.rangoReferrer(keys);
    } catch (err) {
      return Promise.reject(new ClientError(err.message));
    }

    const qs = this.rangoQs({
      apiKey: keys.API_KEY,
      from: req.body.from,
      to: req.body.to,
      amount: req.body.amount,
      slippage: req.body.slippage ?? 1.5,
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

    let referrer;
    try {
      referrer = this.rangoReferrer(keys);
    } catch (err) {
      return Promise.reject(new ClientError(err.message));
    }

    const qs = this.rangoQs({
      apiKey: keys.API_KEY,
      from: req.body.from,
      to: req.body.to,
      amount: req.body.amount,
      slippage: req.body.slippage ?? 1.5,
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
