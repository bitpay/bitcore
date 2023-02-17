export interface IOrderInfoNoti {
  orderId: string;
  receivedTxId?: string;
  pendingReason?: string;
  error?: string;
}

export class OrderInfoNoti implements IOrderInfoNoti {
  orderId: string;
  receivedTxId?: string;
  isNotifiedReceivingFundToTelegram?: boolean;
  pendingReason?: string;
  error?: string;
  isNotifiedErrorToTelegram?: boolean;
  static create(opts) {
    const x = new OrderInfoNoti();
    x.orderId = opts.orderId;
    x.receivedTxId = opts.receivedTxId || null;
    x.pendingReason = opts.pendingReason || null;
    x.error = opts.error || null;
    return x;
  }
}
