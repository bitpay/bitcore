export interface IOnrampWebhookEvent {
  partner: string;       // 'simplex' | 'moonpay' | 'ramp' | 'transak' | 'banxa' | 'sardine'
  externalId: string;    // transaction/order/payment ID from partner
  status: string;        // raw status string from partner
  eventName?: string;    // event type/name if available (e.g. 'ORDER_COMPLETED', 'transaction_updated')
  createdAt?: string;    // ISO timestamp from partner payload
  updatedAt?: string;    // ISO timestamp of this transaction state at the partner
  // Tells two deliveries of the same transaction apart. Each partner documents
  // a different one (moonpay: updatedAt, simplex: event_id, banxa: status);
  // defaults to status when the handler sets none.
  deliveryVersion?: string;
  externalTransactionId?: string;
  fiatAmount?: number;
  fiatCurrency?: string;
  cryptoAmount?: number;   // amount of crypto (quoteCurrencyAmount)
  cryptoCurrency?: string;
  paymentMethod?: string;
  walletAddress?: string;
  walletAddressTag?: string;
  userId?: string;       // external customer/user ID from partner
  rawPayload: object;    // original payload available to the webhook processor
  receivedAt: number;    // epoch ms when received
  env: string;           // 'sandbox' | 'production'
  isEmbedded?: boolean;  // true if the event comes from the embedded flow (verified with the embedded webhook key)
}

export class OnrampWebhookEvent implements IOnrampWebhookEvent {
  partner: string;
  externalId: string;
  status: string;
  eventName?: string;
  createdAt?: string;
  updatedAt?: string;
  deliveryVersion?: string;
  externalTransactionId?: string;
  fiatAmount?: number;
  fiatCurrency?: string;
  cryptoAmount?: number;
  cryptoCurrency?: string;
  paymentMethod?: string;
  walletAddress?: string;
  walletAddressTag?: string;
  userId?: string;
  rawPayload: object;
  receivedAt: number;
  env: string;
  isEmbedded?: boolean;

  static create(opts: Partial<IOnrampWebhookEvent>): OnrampWebhookEvent {
    const x = new OnrampWebhookEvent();
    x.partner = opts.partner;
    x.externalId = opts.externalId;
    x.status = opts.status;
    x.eventName = opts.eventName;
    x.createdAt = opts.createdAt;
    x.updatedAt = opts.updatedAt;
    x.deliveryVersion = opts.deliveryVersion;
    x.externalTransactionId = opts.externalTransactionId;
    x.fiatAmount = opts.fiatAmount;
    x.fiatCurrency = opts.fiatCurrency;
    x.cryptoAmount = opts.cryptoAmount;
    x.cryptoCurrency = opts.cryptoCurrency;
    x.paymentMethod = opts.paymentMethod;
    x.walletAddress = opts.walletAddress;
    x.walletAddressTag = opts.walletAddressTag;
    x.userId = opts.userId;
    x.rawPayload = opts.rawPayload || {};
    x.receivedAt = opts.receivedAt || Date.now();
    x.env = opts.env || 'production';
    x.isEmbedded = opts.isEmbedded;
    return x;
  }

  static fromObj(obj: any): OnrampWebhookEvent {
    const x = new OnrampWebhookEvent();
    Object.assign(x, obj);
    return x;
  }
}

/** Shape persisted in the onramp_webhook_events collection. */
export interface IStoredOnrampWebhookEvent extends Omit<
  IOnrampWebhookEvent,
  'eventName' | 'rawPayload' | 'deliveryVersion'
> {
  _id: string;
  eventName: string;
  expiresAt: Date;      // TTL index anchor; the delivery log is not kept forever
}

export interface IStoreOnrampWebhookEventResult {
  inserted: boolean;
  id: string;
  event: IStoredOnrampWebhookEvent;
  isStale: boolean;
}
