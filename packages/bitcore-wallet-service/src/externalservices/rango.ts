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
export class RangoService {
  request: any = request;

  private rangoGetKeys(req) {
    if (!config.rango) throw new Error('Rango missing credentials');

    const env: 'sandbox' | 'production' = req.body.env === 'production' ? 'production' : 'sandbox';

    delete req.body.env;

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
    const qs: string[] = [];
    qs.push('apiKey=' + keys.API_KEY);

    const URL: string = keys.API + `/basic/meta/blockchains?${qs.join('&')}`;
    return this.rangoGet(URL);
  }

  rangoGetCryptoCurrencies(req): Promise<any> {
    const keys = this.rangoGetKeys(req);
    const qs: string[] = [];
    qs.push('apiKey=' + keys.API_KEY);

    if (req.body.blockchains) qs.push('blockchains=' + req.body.blockchains);
    if (req.body.blockchainsExclude) qs.push('blockchainsExclude=' + req.body.blockchainsExclude);
    if (req.body.swappers) qs.push('swappers=' + req.body.swappers);
    if (req.body.swappersExclude) qs.push('swappersExclude=' + req.body.swappersExclude);
    if (req.body.transactionTypes) qs.push('transactionTypes=' + req.body.transactionTypes);
    if (req.body.excludeNonPopulars) qs.push('excludeNonPopulars=' + req.body.excludeNonPopulars);

    const URL: string = keys.API + `/basic/meta?${qs.join('&')}`;
    return this.rangoGet(URL);
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

    const qs: string[] = [];
    qs.push('apiKey=' + keys.API_KEY);
    qs.push('from=' + req.body.from);
    qs.push('to=' + req.body.to);
    qs.push('amount=' + req.body.amount);
    qs.push('slippage=' + (req.body.slippage ?? 1.5));

    // The referrer fee must match between quote and swap or the quoted output
    // will not match what the user receives.
    const referrerFee = req.body.referrerFee ?? keys.REFERRER_FEE;
    if (referrerFee) qs.push('referrerFee=' + referrerFee);

    if (req.body.fromAddress) qs.push('fromAddress=' + req.body.fromAddress);
    if (req.body.toAddress) qs.push('toAddress=' + req.body.toAddress);
    if (req.body.swappers) qs.push('swappers=' + req.body.swappers);
    if (req.body.swappersExclude) qs.push('swappersExclude=' + req.body.swappersExclude);

    const URL: string = keys.API + `/basic/quote?${qs.join('&')}`;
    return this.rangoGet(URL);
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

    const qs: string[] = [];
    qs.push('apiKey=' + keys.API_KEY);
    qs.push('from=' + req.body.from);
    qs.push('to=' + req.body.to);
    qs.push('amount=' + req.body.amount);
    qs.push('slippage=' + (req.body.slippage ?? 1.5));
    qs.push('fromAddress=' + req.body.fromAddress);
    qs.push('toAddress=' + req.body.toAddress);

    // referrerAddress is where BitPay's cut lands. Rango supports EVM,
    // Starknet and Osmosis addresses for this; Solana fee collection is not
    // generally available, so routes originating on Solana may collect nothing.
    const referrerFee = req.body.referrerFee ?? keys.REFERRER_FEE;
    const referrerAddress = req.body.referrerAddress ?? keys.REFERRER_ADDRESS;
    if (referrerFee && referrerAddress) {
      qs.push('referrerFee=' + referrerFee);
      qs.push('referrerAddress=' + referrerAddress);
    }

    if (req.body.disableEstimate) qs.push('disableEstimate=' + req.body.disableEstimate);
    if (req.body.swappers) qs.push('swappers=' + req.body.swappers);
    if (req.body.swappersExclude) qs.push('swappersExclude=' + req.body.swappersExclude);

    const URL: string = keys.API + `/basic/swap?${qs.join('&')}`;
    return this.rangoGet(URL);
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

    const qs: string[] = [];
    qs.push('apiKey=' + keys.API_KEY);
    qs.push('requestId=' + req.body.requestId);
    qs.push('txId=' + req.body.txId);

    const URL: string = keys.API + `/basic/status?${qs.join('&')}`;
    return this.rangoGet(URL);
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

    const qs: string[] = [];
    qs.push('apiKey=' + keys.API_KEY);
    qs.push('requestId=' + req.body.requestId);
    qs.push('txId=' + req.body.txId);

    const URL: string = keys.API + `/basic/is-approved?${qs.join('&')}`;
    return this.rangoGet(URL);
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

      const URL: string = keys.API + `/basic/report-tx?apiKey=${keys.API_KEY}`;

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
