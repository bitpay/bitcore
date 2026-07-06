import * as crypto from 'crypto';
import * as request from 'request';
import Uuid from 'uuid';
import config from '../config';
import { Utils } from '../lib/common/utils';
import { ClientError } from '../lib/errors/clienterror';
import { logger } from '../lib/logger';
import { OnrampWebhookEvent } from '../lib/model/onrampWebhookEvent';
import { checkRequired } from '../lib/server';

export class SimplexService {
  request: any = request;

  private simplexGetKeys(req) {
    if (!config.simplex) throw new Error('Simplex missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys = {
      API: config.simplex[env].api,
      API_SELL: config.simplex[env].apiSell,
      API_KEY: config.simplex[env].apiKey,
      PUBLIC_KEY: config.simplex[env].publicKey,
      APP_PROVIDER_ID: config.simplex[env].appProviderId,
      APP_SELL_REF_ID: config.simplex[env].appSellRefId
    };

    return keys;
  }

  simplexGetCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);
      const API = keys.API;
      const PUBLIC_KEY = keys.PUBLIC_KEY;

      const headers = {
        'Content-Type': 'application/json'
      };

      const URL = API + `/v2/supported_crypto_currencies?public_key=${PUBLIC_KEY}`;

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

  simplexGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const ip = Utils.getIpFromReq(req);

      req.body.client_ip = ip;
      req.body.wallet_id = keys.APP_PROVIDER_ID;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      if (req.body && req.body.payment_methods && Array.isArray(req.body.payment_methods)) {
        // Workaround to fix older versions of the app
        req.body.payment_methods = req.body.payment_methods.map(item => item === 'simplex_account' ? 'sepa_open_banking' : item);
      }

      this.request.post(
        API + '/wallet/merchant/v2/quote',
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            return resolve(data.body ? data.body : null);
          }
        }
      );
    });
  }

  simplexGetSellQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API_SELL;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['base_currency', 'base_amount', 'quote_currency', 'pp_payment_method'])) {
        return reject(new ClientError("Simplex's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY,
      };

      if (req.body.userCountry && typeof req.body.userCountry === 'string') {
        headers['x-country-code'] = req.body.userCountry.toUpperCase();
      }

      const qs: string[] = [];
      qs.push('base_currency=' + req.body.base_currency);
      qs.push('base_amount=' + req.body.base_amount);
      qs.push('quote_currency=' + req.body.quote_currency);
      qs.push('pp_payment_method=' + req.body.pp_payment_method);

      const URL: string = API + `/v3/quote?${qs.join('&')}`;

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

  simplexPaymentRequest(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const appProviderId = keys.APP_PROVIDER_ID;
      const paymentId = Uuid.v4();
      const orderId = Uuid.v4();
      const apiHost = keys.API;
      const ip = Utils.getIpFromReq(req);

      if (
        !checkRequired(req.body, ['account_details', 'transaction_details']) &&
        !checkRequired(req.body.transaction_details, ['payment_details'])
      ) {
        return reject(new ClientError("Simplex's request missing arguments"));
      }

      req.body.account_details.app_provider_id = appProviderId;
      req.body.account_details.signup_login = {
        ip,
        location: '',
        uaid: '',
        accept_language: 'de,en-US;q=0.7,en;q=0.3',
        http_accept_language: 'de,en-US;q=0.7,en;q=0.3',
        user_agent: req.body.account_details.signup_login ? req.body.account_details.signup_login.user_agent : '', // Format: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:67.0) Gecko/20100101 Firefox/67.0'
        cookie_session_id: '',
        timestamp: req.body.account_details.signup_login ? req.body.account_details.signup_login.timestamp : ''
      };

      req.body.transaction_details.payment_details.payment_id = paymentId;
      req.body.transaction_details.payment_details.order_id = orderId;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      this.request.post(
        API + '/wallet/merchant/v2/payments/partner/data',
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            data.body.payment_id = paymentId;
            data.body.order_id = orderId;
            data.body.app_provider_id = appProviderId;
            data.body.api_host = apiHost;
            return resolve(data.body);
          }
        }
      );
    });
  }

  simplexSellPaymentRequest(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.simplexGetKeys(req);

      const API = keys.API_SELL;
      const API_KEY = keys.API_KEY;
      const appSellRefId = keys.APP_SELL_REF_ID;

      if (
        !checkRequired(req.body, ['referer_url', 'return_url']) ||
        !checkRequired(req.body.txn_details, ['quote_id'])
      ) {
        return reject(new ClientError("Simplex's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY,
      };

      if (req.body.userCountry && typeof req.body.userCountry === 'string') {
        headers['x-country-code'] = req.body.userCountry.toUpperCase();
      }

      this.request.post(
        API + '/v3/initiate-sell/widget',
        {
          headers,
          body: req.body,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : err);
          } else {
            data.body.app_sell_ref_id = appSellRefId;
            return resolve(data.body);
          }
        }
      );
    });
  }

  simplexGetEvents(req): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!config.simplex) return reject(new Error('Simplex missing credentials'));
      if (!req.env || (req.env != 'sandbox' && req.env != 'production'))
        return reject(new Error("Simplex's request wrong environment"));

      const API = config.simplex[req.env].api;
      const API_KEY = config.simplex[req.env].apiKey;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'ApiKey ' + API_KEY
      };

      this.request.get(
        API + '/wallet/merchant/v2/events',
        {
          headers,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ? err.body : null);
          } else {
            return resolve(data.body ? data.body : null);
          }
        }
      );
    });
  }

  /**
   * Handles incoming Simplex webhook events.
   * Simplex signs each request with a RS256 JWT in the X-Signature-SHA256 header.
   * The JWT expires after 5 minutes to prevent replay attacks.
   * https://integrations.simplex.com/docs/webhooks
   *
   * Sandbox and production use different public keys, so the environment is
   * determined by which configured key verifies the JWT, not by the request.
   */
  simplexHandleWebhook(req): { event: OnrampWebhookEvent } {
    if (!config.simplex) throw new Error('Simplex missing credentials');

    const publicKeys: { key: string; env: string }[] = [
      { key: config.simplex.production?.publicKeyWebhook, env: 'production' },
      { key: config.simplex.sandbox?.publicKeyWebhook, env: 'sandbox' }
    ].filter(k => !!k.key);

    let env = 'production';
    if (publicKeys.length) {
      const signature = req.headers['x-signature-sha256'] as string;
      if (!signature) {
        throw new Error('Simplex webhook missing X-Signature-SHA256 header');
      }
      try {
        // Verify RS256 JWT: split into header.payload.signature parts
        const parts = signature.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');
        const signingInput = `${parts[0]}.${parts[1]}`;
        const sig = Buffer.from(parts[2], 'base64url');
        const matched = publicKeys.find(({ key }) => {
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(signingInput);
          return verifier.verify(key, sig);
        });
        if (!matched) {
          throw new Error('Simplex webhook signature mismatch');
        }
        const jwtPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (jwtPayload?.exp != null && jwtPayload.exp * 1000 < Date.now()) {
          throw new Error('Simplex webhook JWT expired');
        }
        env = matched.env;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        logger.warn('Simplex webhook signature error: %s', errMsg);
        throw new Error('Simplex webhook signature verification failed');
      }
    } else {
      logger.warn('Simplex webhook: no publicKeyWebhook configured, skipping signature verification');
    }

    const body = req.body || {};
    const payment = body.payment || {};
    const fiatAmount = payment.fiat_total_amount?.amount;
    const fiatCurrency = payment.fiat_total_amount?.currency;
    const cryptoCurrency = payment.requested_digital_amount?.currency;

    const event = OnrampWebhookEvent.create({
      partner: 'simplex',
      externalId: payment.id || body.event_id,
      status: body.name || '',
      eventName: body.name,
      createdAt: payment.created_at || body.timestamp,
      fiatAmount: fiatAmount != null ? Number(fiatAmount) : undefined,
      fiatCurrency,
      cryptoCurrency,
      userId: payment.user_id,
      rawPayload: body,
      env
    });

    return { event };
  }
}