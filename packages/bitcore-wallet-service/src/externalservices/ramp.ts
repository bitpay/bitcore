import * as crypto from 'crypto';
import * as request from 'request';
import config from '../config';
import { Utils } from '../lib/common/utils';
import { ClientError } from '../lib/errors/clienterror';
import { logger } from '../lib/logger';
import { OnrampWebhookEvent } from '../lib/model/onrampWebhookEvent';
import { checkRequired } from '../lib/server';

export class RampService {
  request: any = request;

  private rampGetKeys(req) {
    if (!config.ramp) throw new Error('Ramp missing credentials');

    let env: 'sandbox' | 'production' | 'sandboxWeb' | 'productionWeb';
    env = req.body.env === 'production' ? 'production' : 'sandbox';
    if (req.body.context === 'web') {
      env += 'Web';
    }
    delete req.body.env;
    delete req.body.context;

    const keys: {
      API: string;
      WIDGET_API: string;
      API_KEY: string;
      SIGNING_KEY: string;
    } = {
      API: config.ramp[env].api,
      WIDGET_API: config.ramp[env].widgetApi,
      API_KEY: config.ramp[env].apiKey,
      SIGNING_KEY: config.ramp[env].signingKey,
    };

    return keys;
  }

  rampGetQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      if (!checkRequired(req.body, ['cryptoAssetSymbol', 'fiatValue', 'fiatCurrency'])) {
        return reject(new ClientError("Ramp's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      const URL: string = API + `/host-api/v3/onramp/quote/all?hostApiKey=${API_KEY}`;

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

  rampGetSellQuote(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      /*
        * Although fiatValue and cryptoAmount are not both required, you need to pass one of them.
        * cryptoAmount - should be passed in token wei - e.g. for 1ETH cryptoAmount: 1000000000000000000
        * cryptoAmount?: string;
        * fiatValue?: number;
      */
      if (!checkRequired(req.body, ['cryptoAssetSymbol', 'fiatCurrency']) || (!checkRequired(req.body, ['fiatValue']) && !checkRequired(req.body, ['cryptoAmount']))) {
        return reject(new ClientError("Ramp's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      const URL: string = API + `/host-api/v3/offramp/quote/all?hostApiKey=${API_KEY}`;

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

  rampGetSignedPaymentUrl(req): { urlWithSignature: string } {
    const webRequiredParams = [
      'selectedCountryCode',
    ];
    let appRequiredParams = [
      'enabledFlows',
      'defaultFlow',
      'selectedCountryCode',
    ];
    const extraRequiredParams = req.body.flow && req.body.flow === 'sell' ? [] : ['finalUrl', 'userAddress'];
    appRequiredParams = appRequiredParams.concat(extraRequiredParams);

    const requiredParams = req.body.context === 'web' ? webRequiredParams : appRequiredParams;
    const keys = this.rampGetKeys(req);
    const API_KEY = keys.API_KEY;
    const WIDGET_API = keys.WIDGET_API;
    const SIGNING_KEY = keys.SIGNING_KEY;

    if (
      !checkRequired(req.body, requiredParams)
    ) {
      throw new ClientError("Ramp's request missing arguments");
    }

    const qs: string[] = [];
    qs.push('hostApiKey=' + API_KEY);
    qs.push('selectedCountryCode=' + encodeURIComponent(req.body.selectedCountryCode));
    if (req.body.finalUrl) qs.push('finalUrl=' + encodeURIComponent(req.body.finalUrl));
    if (req.body.userAddress) qs.push('userAddress=' + encodeURIComponent(req.body.userAddress));
    if (req.body.enabledFlows) qs.push('enabledFlows=' + encodeURIComponent(req.body.enabledFlows));
    if (req.body.defaultFlow) qs.push('defaultFlow=' + encodeURIComponent(req.body.defaultFlow));
    if (req.body.hostLogoUrl) qs.push('hostLogoUrl=' + encodeURIComponent(req.body.hostLogoUrl));
    if (req.body.hostAppName) qs.push('hostAppName=' + encodeURIComponent(req.body.hostAppName));
    if (req.body.userEmailAddress) qs.push('userEmailAddress=' + encodeURIComponent(req.body.userEmailAddress));
    if (req.body.useSendCryptoCallback) qs.push('useSendCryptoCallback=' + encodeURIComponent(req.body.useSendCryptoCallback));
    if (req.body.paymentMethodType) qs.push('paymentMethodType=' + encodeURIComponent(req.body.paymentMethodType));
    if (req.body.hideExitButton) qs.push('hideExitButton=' + encodeURIComponent(req.body.hideExitButton));

    // Ramp deprecated the legacy per-flow search params in favor of a unified format.
    // Ref: https://docs.rampnetwork.com/search-params-migration
    // Older app versions still send the legacy fields, so we translate them into the new
    // unified params here to keep those requests working going forward.
    // `flow === 'sell'` => OFFRAMP; otherwise => ONRAMP.
    // If a newer client already sends the new params, those take precedence.
    const isOfframp = req.body.flow === 'sell';

    // enabledCryptoAssets <- swapAsset (onramp) / offrampAsset (offramp)
    const enabledCryptoAssets = req.body.enabledCryptoAssets ?? (isOfframp ? req.body.offrampAsset : req.body.swapAsset);
    if (enabledCryptoAssets) qs.push('enabledCryptoAssets=' + encodeURIComponent(enabledCryptoAssets));

    // inAsset (incoming, paid by the user) <- fiatCurrency (onramp) / defaultAsset (offramp)
    const inAsset = req.body.inAsset ?? (isOfframp ? req.body.defaultAsset : req.body.fiatCurrency);
    if (inAsset) qs.push('inAsset=' + encodeURIComponent(inAsset));

    // outAsset (outgoing, received by the user) <- defaultAsset (onramp) / fiatCurrency (offramp)
    const outAsset = req.body.outAsset ?? (isOfframp ? req.body.fiatCurrency : req.body.defaultAsset);
    if (outAsset) qs.push('outAsset=' + encodeURIComponent(outAsset));

    // inAssetValue (units, no decimals) <- fiatValue (onramp) / swapAmount (offramp)
    const inAssetValue = req.body.inAssetValue ?? (isOfframp ? req.body.swapAmount : req.body.fiatValue);
    if (inAssetValue) qs.push('inAssetValue=' + encodeURIComponent(inAssetValue));

    // outAssetValue (units, no decimals) <- swapAmount (onramp) / fiatValue (offramp)
    const outAssetValue = req.body.outAssetValue ?? (isOfframp ? req.body.fiatValue : req.body.swapAmount);
    if (outAssetValue) qs.push('outAssetValue=' + encodeURIComponent(outAssetValue));

    // Custom query param appended to the webhook
    // callback URL, which Ramp echoes back verbatim on the actual webhook call.
    // https://docs.rampnetwork.com/webhooks#passing-custom-parameters-to-webhooks
    const webhookCallbackBaseUrl: string | undefined = config.ramp.webhookCallbackBaseUrl;
    if (req.body.userId && webhookCallbackBaseUrl) {
      const userIdParam = 'userId=' + encodeURIComponent(req.body.userId);
      const webhookStatusUrl = `${webhookCallbackBaseUrl}/v1/service/ramp/webhook?${userIdParam}`;
      // TODO: We don't currently use the offrampWebhookV3Url, but we may want to in the future. If so, uncomment the lines below.
      // const offrampWebhookV3Url = `${webhookCallbackBaseUrl}/v1/service/ramp/offramp-webhook?${userIdParam}`;
      qs.push('webhookStatusUrl=' + encodeURIComponent(webhookStatusUrl));
      // qs.push('offrampWebhookV3Url=' + encodeURIComponent(offrampWebhookV3Url));
    }

    const queryString = qs.join('&');

    // Add timestamp and sign
    const timestamp = Math.floor(Date.now());
    const queryWithTimestamp = `${queryString}&timestamp=${timestamp}`;

    // Create signature using Ed25519
    const dataToSign = Buffer.from(queryWithTimestamp, 'utf8');
    let base64Signature: string;
    try {
      const privateDer = Buffer.from(SIGNING_KEY, 'base64');
      const signature = crypto.sign(null, dataToSign, { key: privateDer, format: 'der', type: 'pkcs8' });
      base64Signature = signature.toString('base64');
    } catch {
      throw new ClientError('Invalid Ramp signing key');
    }

    // Create final URL
    const URL_SEARCH: string = `?${queryWithTimestamp}&signature=${encodeURIComponent(
      base64Signature
    )}`;

    const urlWithSignature = `${WIDGET_API}${URL_SEARCH}`;

    return { urlWithSignature };
  }

  rampGetAssets(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;
      const API_KEY = keys.API_KEY;

      const headers = {
        'Content-Type': 'application/json'
      };

      const qs: string[] = [];
      // "Buy" and "Sell" features use the same properties. Use "flow" to target the correct endpoint
      qs.push('hostApiKey=' + API_KEY);
      if (req.body.currencyCode) qs.push('currencyCode=' + encodeURIComponent(req.body.currencyCode));
      if (req.body.withDisabled) qs.push('withDisabled=' + encodeURIComponent(req.body.withDisabled));
      if (req.body.withHidden) qs.push('withHidden=' + encodeURIComponent(req.body.withHidden));
      if (req.body.useIp) {
        const ip = Utils.getIpFromReq(req);
        qs.push('userIp=' + encodeURIComponent(ip));
      }

      const URL = API + `/host-api/v3${req.body.flow && req.body.flow === 'sell' ? '/offramp' : ''}/assets?${qs.join('&')}`;

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

  rampGetSellTransactionDetails(req): Promise<any> {
    return new Promise((resolve, reject) => {
      const keys = this.rampGetKeys(req);
      const API = keys.API;

      if (!checkRequired(req.body, ['id', 'saleViewToken'])) {
        return reject(new ClientError("Ramp's request missing arguments"));
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      const qs: string[] = [];
      qs.push('secret=' + req.body.saleViewToken);

      const URL = API + `/host-api/v3/offramp/sale/${req.body.id}?${qs.join('&')}`;

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
   * Handles incoming Ramp webhook events.
   * Ramp sends purchase/sale events via HTTP POST to webhookStatusUrl /
   * offrampWebhookV3Url. https://docs.rampnetwork.com/webhooks
   *
   * Ramp signs every webhook with an ECDSA (secp256k1) key + SHA-256 digest.
   * The message is the request body serialized deterministically (keys sorted
   * alphabetically, no whitespace - fast-json-stable-stringify), NOT the raw body.
   * The X-Body-Signature header is the base64 DER-encoded signature.
   * Environment is determined by which key verifies the signature.
   * Ramp's own published public keys: webhookSigningKey
   *
   * Buy payload:  { type: 'CREATED'|'RELEASED'|'RETURNED', purchase: RampPurchase }
   * Sell payload: { type: 'CREATED'|'RELEASED'|'EXPIRED', mode: 'OFFRAMP', payload: RampSale }
   */
  rampHandleWebhook(req): { event: OnrampWebhookEvent } {
    if (!config.ramp) throw new Error('Ramp missing credentials');

    const publicKeys: { key: string; env: string }[] = [
      { key: (config.ramp.production as any)?.webhookSigningKey, env: 'production' },
      { key: (config.ramp.sandbox as any)?.webhookSigningKey, env: 'sandbox' }
    ];

    const body = req.body || {};

    let env = 'production';
    const sigHeader = req.headers['x-body-signature'] as string;
    if (!sigHeader) {
      throw new Error('Ramp webhook missing X-Body-Signature header');
    }
    try {
      // The signed message is the stable-stringified JSON body (sorted keys, no whitespace)
      const message = Buffer.from(stableStringify(body), 'utf8');
      const sig = Buffer.from(sigHeader, 'base64');
      // Signature is DER-encoded (crypto.verify's default dsaEncoding)
      const matched = publicKeys.find(({ key }) => crypto.verify('sha256', message, key, sig));
      if (!matched) {
        throw new Error('Ramp webhook signature mismatch');
      }
      env = matched.env;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      logger.warn('Ramp webhook signature error: %s', errMsg);
      throw new Error('Ramp webhook signature verification failed');
    }

    // Buy events carry the tx in body.purchase; sell (offramp) events in body.payload
    const isSell = body.mode === 'OFFRAMP' || !!body.payload;
    const item = (isSell ? body.payload : body.purchase) || {};

    const event = OnrampWebhookEvent.create({
      partner: 'ramp',
      externalId: item.id,
      status: item.status || body.type || '',
      eventName: body.type,
      createdAt: item.createdAt,
      // RampPurchase/RampSale both document an updatedAt field, used as the
      // delivery version key for idempotency/out-of-order detection.
      updatedAt: item.updatedAt,
      deliveryVersion: item.updatedAt,
      fiatAmount: isSell
        ? (item.fiat?.amount != null ? Number(item.fiat.amount) : undefined)
        : (item.fiatValue != null ? Number(item.fiatValue) : undefined),
      fiatCurrency: isSell ? item.fiat?.currencySymbol : item.fiatCurrency,
      cryptoAmount: isSell
        ? (item.crypto?.amount != null ? Number(item.crypto.amount) : undefined)
        : (item.cryptoAmount != null ? Number(item.cryptoAmount) : undefined),
      cryptoCurrency: isSell ? item.crypto?.assetInfo?.symbol : item.asset?.symbol,
      paymentMethod: isSell ? item.fiat?.payoutMethod : item.paymentMethodType,
      walletAddress: item.receiverAddress,
      // NOTE: Ramp does not send user details in webhooks (privacy policy).
      // userId comes from the userId query param we
      // ourselves append to webhookStatusUrl/offrampWebhookV3Url when
      // requesting the signed widget URL (see rampGetSignedPaymentUrl) - Ramp
      // echoes it back verbatim on this call.
      userId: typeof req.query?.userId === 'string' ? req.query.userId : undefined,
      rawPayload: body,
      env
    });

    return { event };
  }
}

/**
 * Deterministic JSON serialization equivalent to fast-json-stable-stringify:
 * object keys sorted alphabetically (recursively), no whitespace.
 * Ramp signs webhook bodies over this representation.
 */
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(item => stableStringify(item === undefined ? null : item)).join(',')}]`;
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}