import * as crypto from 'crypto';
import * as _ from 'lodash';
import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { logger } from '../lib/logger';
import { OnrampWebhookEvent } from '../lib/model/onrampWebhookEvent';
import { checkRequired } from '../lib/server';

export class BanxaService {
  request: any = request;

  private banxaGetKeys(req) {
    if (!config.banxa) throw new Error('Banxa missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }

    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      API_KEY: string;
      SECRET_KEY: string;
    } = {
      API: config.banxa[env].api,
      API_KEY: config.banxa[env].apiKey,
      SECRET_KEY: config.banxa[env].secretKey
    };

    return keys;
  }

  private getBanxaSignature(method: 'get' | 'post', endpoint: string, apiKey: string, secret: string, body?: string) {
    let signature;
    const nonce = Date.now().toString();

    switch (method) {
      case 'get':
        signature = 'GET' + '\n' + `/api${endpoint}` + '\n' + nonce;
        break;
      case 'post':
        const stringifiedBody = body ? JSON.stringify(_.cloneDeep(body)) : '';
        signature = 'POST' + '\n' + `/api${endpoint}` + '\n' + nonce + '\n' + stringifiedBody;
        break;
      default:
        signature = undefined;
        break;
    }

    const localSignature = crypto.createHmac('sha256', secret).update(signature).digest('hex');
    const auth = `${apiKey}:${localSignature}:${nonce}`;
    return auth;
  }

  banxaGetCoins(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['orderType'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }
      if (!['buy', 'sell'].includes(req.body.orderType)) {
        return reject(new ClientError("Banxa's 'orderType' property must be 'sell' or 'buy'"));
      }

      const UriPath = `/coins/${req.body.orderType}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
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

  banxaGetPaymentMethods(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      const qs: string[] = [];
      if (req.body.source) qs.push('source=' + req.body.source);
      if (req.body.target) qs.push('target=' + req.body.target);

      const UriPath = `/payment-methods${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
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

  banxaGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['source', 'target'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      const qs: string[] = [];
      qs.push('source=' + req.body.source);
      qs.push('target=' + req.body.target);

      if (req.body.source_amount) qs.push('source_amount=' + req.body.source_amount);
      if (req.body.target_amount) qs.push('target_amount=' + req.body.target_amount);
      if (req.body.payment_method_id) qs.push('payment_method_id=' + req.body.payment_method_id);
      if (req.body.account_reference) qs.push('account_reference=' + req.body.account_reference);
      if (req.body.blockchain) qs.push('blockchain=' + req.body.blockchain);

      const UriPath = `/prices${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
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

  banxaCreateOrder(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['account_reference', 'source', 'target', 'wallet_address', 'return_url_on_success'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      if (!req.body.payment_method || req.body.payment_method === 'other') {
        // Workaround to allow older versions of the app to freely choose the payment method on the checkout page when they select "other".
        delete req.body.payment_method_id;
      }
      delete req.body.payment_method;

      // Banxa's webhook payload doesn't carry any partner-supplied user identifier
      // `meta_data` is a free-form string Banxa echoes back (as `metadata`) on the
      // webhook
      if (req.body.userId && !req.body.meta_data) {
        req.body.meta_data = req.body.userId;
      }
      delete req.body.userId;

      const UriPath = '/orders';
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('post', UriPath, API_KEY, SECRET_KEY, req.body);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
      };

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

  banxaGetOrder(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.banxaGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['order_id'])) {
        return reject(new ClientError("Banxa's request missing arguments"));
      }

      const qs: string[] = [];
      if (req.body.fx_currency) qs.push('fx_currency=' + req.body.fx_currency);

      const UriPath = `/orders/${req.body.order_id}${qs.length > 0 ? '?' + qs.join('&') : ''}`;
      const URL: string = API + UriPath;
      const auth = this.getBanxaSignature('get', UriPath, API_KEY, SECRET_KEY);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth}`
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
   * Handles incoming Banxa webhook events.
   * Banxa signs each webhook with HMAC-SHA256. Header format:
   *   Authorization: Bearer {API_KEY}:{SIGNATURE}:{NONCE}
   * Signature is computed over: POST\n{WEBHOOK_PATH}\n{NONCE}\n{RAW_BODY}
   * https://docs.banxa.com/products/hosted-checkout/docs/transaction-lifecycle/webhooks
   *
   * WEBHOOK_PATH must be the full URI path of this endpoint as registered in the
   * Banxa dashboard (including any proxy prefix, e.g. /bws/api/v1/service/banxa/webhook).
   * Configure it per env in config.banxa[env].webhookPath.
   *
   * The environment is determined by which configured key verifies the signature
   * (separate URLs/keys per env in the dashboard), not by the request.
   */
  banxaHandleWebhook(req): { event: OnrampWebhookEvent } {
    if (!config.banxa) throw new Error('Banxa missing credentials');

    const secretKeys: { key: string; env: string; webhookPath: string }[] = [
      { key: (config.banxa.production as any)?.webhookSecretKey || config.banxa.production?.secretKey, env: 'production', webhookPath: (config.banxa.production as any)?.webhookPath || '/v1/service/banxa/webhook' },
      { key: (config.banxa.sandbox as any)?.webhookSecretKey || config.banxa.sandbox?.secretKey, env: 'sandbox', webhookPath: (config.banxa.sandbox as any)?.webhookPath || '/v1/service/banxa/webhook' }
    ].filter(k => !!k.key);

    let env = 'production';
    if (secretKeys.length) {
      const authHeader = req.headers['authorization'] as string;
      if (!authHeader) {
        throw new Error('Banxa webhook missing Authorization header');
      }
      try {
        // Strip 'Bearer ' prefix
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        const parts = token.split(':');
        if (parts.length !== 3) throw new Error('Invalid Banxa Authorization header format');
        const [, receivedSig, nonce] = parts;
        const rawBody: string = (req as any).rawBody ?? JSON.stringify(req.body);
        const given = Buffer.from(receivedSig, 'hex');
        const matched = secretKeys.find(({ key, webhookPath }) => {
          const signingString = `POST\n${webhookPath}\n${nonce}\n${rawBody}`;
          const expected = crypto.createHmac('sha256', key).update(signingString).digest();
          return expected.length === given.length && crypto.timingSafeEqual(expected, given);
        });
        if (!matched) {
          throw new Error('Banxa webhook signature mismatch');
        }
        env = matched.env;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        logger.warn('Banxa webhook signature error: %s', errMsg);
        throw new Error('Banxa webhook signature verification failed');
      }
    } else {
      logger.warn('Banxa webhook: no secretKey configured, skipping signature verification');
    }

    const body = req.body || {};

    const event = OnrampWebhookEvent.create({
      partner: 'banxa',
      externalId: body.order_id,
      status: body.status || '',
      eventName: body.status,
      createdAt: body.created_at,
      // Banxa docs recommend order_id + status as the dedup key; updated_at is
      // also used here for out-of-order detection.
      updatedAt: body.updated_at,
      deliveryVersion: body.updated_at,
      fiatAmount: body.fiat_amount != null ? Number(body.fiat_amount) : undefined,
      fiatCurrency: body.fiat_currency,
      cryptoAmount: body.crypto_amount != null ? Number(body.crypto_amount) : undefined,
      cryptoCurrency: body.crypto_coin,
      paymentMethod: body.payment_method,
      // `metadata` is what we ask Banxa to echo back for the meta_data sent at
      // order creation (see banxaCreateOrder).
      userId: typeof body.metadata === 'string' ? body.metadata : undefined,
      rawPayload: body,
      env
    });

    return { event };
  }
}