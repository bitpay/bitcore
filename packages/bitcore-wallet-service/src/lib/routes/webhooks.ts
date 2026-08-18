import express from 'express';
import { brazeService } from '../braze';
import { logger } from '../logger';
import { OnrampWebhookEvent } from '../model/onrampWebhookEvent';
import type * as Types from '../../types/expressapp';

interface RouteContext {
  getServer: Types.GetServerFn;
  returnError: Types.ReturnErrorFn;
}

/**
 * Shared handler: parse/verify event via service handler, log it, optionally
 * store it, respond 200.
 * Invalid signatures and payloads that cannot be keyed get a 400; a storage
 * outage gets a 503 so the partner retries the delivery.
 * Never rejects: any unexpected error falls through to a 500 so the partner
 * always gets a response instead of hanging until it times out.
 *
 * storeEvent (when provided) must run BEFORE the Braze track call: partners
 * can (and do) redeliver the same event, so we only want to emit analytics
 * once per unique delivery. If storeEvent reports `inserted: false`, this was
 * already handled before (a duplicate/retry) and tracking is skipped. If it
 * reports `isStale: true`, a newer state for the same transaction was already
 * recorded (the partner delivered events out of order) and tracking is
 * skipped too, so a late/older update never overwrites newer state downstream.
 */
async function handleWebhook(
  req: express.Request,
  res: express.Response,
  partner: string,
  parseEvent: () => { event: OnrampWebhookEvent } | Promise<{ event: OnrampWebhookEvent }>,
  storeEvent?: (event: OnrampWebhookEvent) => Promise<{ inserted: boolean; isStale?: boolean } | undefined>
): Promise<express.Response> {
  let event: OnrampWebhookEvent;
  try {
    ({ event } = await parseEvent());
  } catch (err) {
    logger.error(`[webhook:${partner}] Failed to process payload: %o`, err);
    // Return 400 so partner knows the payload was rejected (e.g. bad signature)
    return res.status(400).json({ error: (err as Error).message });
  }

  try {
    logger.info(`[webhook:${partner}] Received event externalId=%s status=%s`, event?.externalId, event?.status);

    // Persist first (if applicable) so we know whether this delivery was
    // already handled before deciding whether to emit analytics for it.
    let isDuplicate = false;
    if (storeEvent) {
      try {
        const result = await storeEvent(event);
        isDuplicate = result?.inserted === false || result?.isStale === true;
        if (isDuplicate) {
          logger.info(`[webhook:${partner}] Duplicate or stale/out-of-order delivery detected, skipping Braze tracking externalId=%s`, event?.externalId);
        }
      } catch (err) {
        logger.error(`[webhook:${partner}] Failed to store event: %o`, err);
        if ((err as any)?.invalidPayload) {
          return res.status(400).json({ error: (err as Error).message });
        }
        return res.status(503).json({ error: 'Webhook storage temporarily unavailable' });
      }
    }

    if (!isDuplicate) {
      // Fire-and-forget: analytics tracking must never block or fail the webhook ack.
      brazeService
        .trackEvent({
          externalId: event?.userId,
          name: 'BWS - ONRAMP Webhook Received',
          properties: {
            partner: event?.partner,
            status: event?.status,
            eventName: event?.eventName,
            externalId: event?.externalId,
            fiatAmount: event?.fiatAmount,
            fiatCurrency: event?.fiatCurrency,
            cryptoAmount: event?.cryptoAmount,
            cryptoCurrency: event?.cryptoCurrency,
            paymentMethod: event?.paymentMethod,
            walletAddress: event?.walletAddress,
            walletAddressTag: event?.walletAddressTag,
            env: event?.env,
            isEmbedded: event?.isEmbedded
          }
        })
        .catch(err => logger.warn(`[webhook:${partner}] Braze tracking failed: %o`, err));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Safety net: guarantees a response even if something above throws
    // unexpectedly (e.g. a bug in a fire-and-forget call), instead of leaving
    // an unhandled rejection and the partner request hanging.
    logger.error(`[webhook:${partner}] Unexpected error handling webhook: %o`, err);
    if (res.headersSent) return res;
    return res.status(500).json({ error: 'Internal error handling webhook' });
  }
}

export function registerWebhookRoutes(router: express.Router, context: RouteContext) {
  const { getServer } = context;

  /**
   * POST /v1/service/simplex/webhook
   * Simplex payment event webhook. Secured with RS256 JWT in X-Signature-SHA256.
   */
  router.post('/v1/service/simplex/webhook', (req, res) => {
    const server = getServer(req, res);
    if (!server) return;
    return handleWebhook(
      req, res, 'simplex',
      () => server.externalServices.simplex.simplexHandleWebhook(req),
      event => server.storage.storeOnrampWebhookEvent({ event })
    ).catch(err => logger.error('[webhook:simplex] Unhandled error: %o', err));
  });

  /**
   * POST /v1/service/moonpay/webhook
   * MoonPay buy/sell transaction event. Secured with HMAC-SHA256 in moonpay-signature-v2.
   */
  router.post('/v1/service/moonpay/webhook', (req, res) => {
    const server = getServer(req, res);
    if (!server) return;
    return handleWebhook(
      req, res, 'moonpay',
      () => server.externalServices.moonpay.moonpayHandleWebhook(req),
      event => server.storage.storeOnrampWebhookEvent({ event })
    ).catch(err => logger.error('[webhook:moonpay] Unhandled error: %o', err));
  });

  /**
   * POST /v1/service/ramp/webhook
   * Ramp buy (purchase) event. Configured via webhookStatusUrl in the Ramp widget.
   */
  router.post('/v1/service/ramp/webhook', (req, res) => {
    const server = getServer(req, res);
    if (!server) return;
    return handleWebhook(
      req, res, 'ramp',
      () => server.externalServices.ramp.rampHandleWebhook(req),
      event => server.storage.storeOnrampWebhookEvent({ event })
    ).catch(err => logger.error('[webhook:ramp] Unhandled error: %o', err));
  });

  /**
   * POST /v1/service/ramp/offramp-webhook
   * Ramp sell (offramp) event. Configured via offrampWebhookV3Url in the Ramp widget.
   */
  router.post('/v1/service/ramp/offramp-webhook', (req, res) => {
    const server = getServer(req, res);
    if (!server) return;
    return handleWebhook(
      req, res, 'ramp',
      () => server.externalServices.ramp.rampHandleWebhook(req),
      event => server.storage.storeOnrampWebhookEvent({ event })
    ).catch(err => logger.error('[webhook:ramp] Unhandled error: %o', err));
  });

  /**
   * POST /v1/service/transak/webhook
   * Transak order event. Payload data field is a HS256 JWT signed with the
   * Partner Access Token (rotates, cached per env in TransakService).
   */
  router.post('/v1/service/transak/webhook', (req, res) => {
    const server = getServer(req, res);
    if (!server) return;
    return handleWebhook(
      req, res, 'transak',
      () => server.externalServices.transak.transakHandleWebhook(req),
      event => server.storage.storeOnrampWebhookEvent({ event })
    ).catch(err => logger.error('[webhook:transak] Unhandled error: %o', err));
  });

  /**
   * POST /v1/service/banxa/webhook
   * Banxa order status event. Secured with HMAC-SHA256 in Authorization header.
   */
  router.post('/v1/service/banxa/webhook', (req, res) => {
    const server = getServer(req, res);
    if (!server) return;
    return handleWebhook(
      req, res, 'banxa',
      () => server.externalServices.banxa.banxaHandleWebhook(req)
    ).catch(err => logger.error('[webhook:banxa] Unhandled error: %o', err));
  });

  /**
   * POST /v1/service/sardine/webhook
   * Sardine order event.
   */
  router.post('/v1/service/sardine/webhook', (req, res) => {
    const server = getServer(req, res);
    if (!server) return;
    return handleWebhook(
      req, res, 'sardine',
      () => server.externalServices.sardine.sardineHandleWebhook(req),
      event => server.storage.storeOnrampWebhookEvent({ event })
    ).catch(err => logger.error('[webhook:sardine] Unhandled error: %o', err));
  });
}
