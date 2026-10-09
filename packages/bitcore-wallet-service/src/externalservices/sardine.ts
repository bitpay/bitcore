import * as crypto from 'crypto';
import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { logger } from '../lib/logger';
import { OnrampWebhookEvent } from '../lib/model/onrampWebhookEvent';
import { checkRequired } from '../lib/server';

export class SardineService {
  request: any = request;

  private sardineGetKeys(req) {
    if (!config.sardine) throw new Error('Sardine missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }
    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      SECRET_KEY: string;
      CLIENT_ID: string;
    } = {
      API: config.sardine[env].api,
      SECRET_KEY: config.sardine[env].secretKey,
      CLIENT_ID: config.sardine[env].clientId,
    };

    return keys;
  }

  sardineGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['asset_type', 'network', 'total'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      const qs: string[] = [];
      qs.push('asset_type=' + req.body.asset_type);
      qs.push('network=' + req.body.network);
      qs.push('total=' + req.body.total);

      if (req.body.currency) qs.push('currency=' + req.body.currency);
      if (req.body.paymentType) qs.push('paymentType=' + req.body.paymentType);
      if (req.body.quote_type) qs.push('quote_type=' + req.body.quote_type);

      const URL: string = API + `/v1/quotes?${qs.join('&')}`;

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

  sardineGetCurrencyLimits(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      const URL: string = API + '/v1/fiat-currencies';

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

  sardineGetToken(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['referenceId', 'externalUserId', 'customerId'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${secretBase64}`,
      };

      const URL: string = API + '/v1/auth/client-tokens';

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

  sardineGetSupportedTokens(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${secretBase64}`,
      };

      const URL: string = API + '/v1/supported-tokens';

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

  sardineGetOrdersDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.sardineGetKeys(req);
      const API = keys.API;
      const CLIENT_ID = keys.CLIENT_ID;
      const SECRET_KEY = keys.SECRET_KEY;

      if (!checkRequired(req.body, ['orderId']) && !checkRequired(req.body, ['externalUserId']) && !checkRequired(req.body, ['referenceId'])) {
        return reject(new ClientError("Sardine's request missing arguments"));
      }

      const secret = `${CLIENT_ID}:${SECRET_KEY}`;
      const secretBase64 = Buffer.from(secret).toString('base64');

      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${secretBase64}`,
      };

      const qs: string[] = [];
      let URL: string = '';

      if (req.body.orderId) {
        URL = API + `/v1/orders/${req.body.orderId}`;
      } else if (req.body.externalUserId || req.body.referenceId) {
        if (req.body.externalUserId) qs.push('externalUserId=' + req.body.externalUserId);
        if (req.body.referenceId) qs.push('referenceId=' + req.body.referenceId);
        if (req.body.startDate) qs.push('startDate=' + req.body.startDate);
        if (req.body.endDate) qs.push('endDate=' + req.body.endDate);
        if (req.body.limit) qs.push('limit=' + req.body.limit);

        URL = API + `/v1/orders?${qs.join('&')}`;
      }

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
   * Handles incoming Sardine webhook events.
   * Docs: https://docs.payments.sardine.ai/integration_guides/onofframps/webhooks.
   * TODO: Confirm the exact scheme with
   * Sardine before relying on it.
   *
   * Payload contains order status updates (draft, expired, declined, processing,
   * processed, complete).
   */
  sardineHandleWebhook(req): { event: OnrampWebhookEvent } {
    if (!config.sardine) throw new Error('Sardine missing credentials');

    const webhookSecrets: { key: string; env: string }[] = [
      { key: (config.sardine.production as any)?.webhookSecret, env: 'production' },
      { key: (config.sardine.sandbox as any)?.webhookSecret, env: 'sandbox' }
    ].filter(k => !!k.key);

    let env = 'production';
    const sigHeader = req.headers['x-sardine-signature'] as string | undefined;
    if (sigHeader && webhookSecrets.length) {
      try {
        const rawBody: string = (req as any).rawBody ?? JSON.stringify(req.body);
        const given = Buffer.from(sigHeader, 'hex');
        const matched = webhookSecrets.find(({ key }) => {
          const expected = crypto.createHmac('sha256', key).update(rawBody).digest();
          return expected.length === given.length && crypto.timingSafeEqual(expected, given);
        });
        if (!matched) {
          throw new Error('Sardine webhook signature mismatch');
        }
        env = matched.env;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        logger.warn('Sardine webhook signature error: %s', errMsg);
        throw new Error('Sardine webhook signature verification failed');
      }
    } else {
      logger.warn('Sardine webhook: signature not verified (header present: %s, secret configured: %s)', !!sigHeader, !!webhookSecrets.length);
    }

    const body = req.body || {};
    // Sardine order payload fields, per the documented Order object shape
    // (GET /v1/orders/{orderId} response, see api_reference/onramp):
    const order = body.order || body;

    const event = OnrampWebhookEvent.create({
      partner: 'sardine',
      externalId: order.id || order.orderId,
      status: order.status || body.eventType || '',
      eventName: body.eventType,
      createdAt: order.createdAt,
      fiatAmount: order.total != null ? Number(order.total) : undefined,
      fiatCurrency: order.fiatCurrency,
      cryptoCurrency: order.assetType || order.cryptoCurrency,
      userId: order.userId || order.externalUserId,
      rawPayload: body,
      env
    });

    return { event };
  }
}