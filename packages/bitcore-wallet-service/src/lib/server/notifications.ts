import * as async from 'async';
import { singleton } from 'preconditions';
import { INotification, Notification, PushNotificationSub, TxConfirmationSub } from '../model';
import { checkRequired } from './shared';
import type { WalletService } from '../server';

const $ = singleton();

type Callback = (err?: any, data?: any) => void;

export function notify(service: WalletService, type, data, opts, cb?: Callback) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  opts = opts || {};
  cb = cb || function() { };

  const walletId = service.walletId || data.walletId;
  const copayerId = service.copayerId || data.copayerId;

  $.checkState(walletId, 'Failed state: walletId undefined at <_notify()>');

  const notification = Notification.create({
    type,
    data,
    ticker: service.notifyTicker++,
    creatorId: opts.isGlobal ? null : copayerId,
    walletId
  });

  service.storage.storeNotification(walletId, notification, () => {
    service.messageBroker.send(notification);
    return cb();
  });
}

export function notifyTxProposalAction(service: WalletService, type, txp, extraArgs, cb?: Callback) {
  if (typeof extraArgs === 'function') {
    cb = extraArgs;
    extraArgs = {};
  }

  const data = Object.assign(
    {
      txProposalId: txp.id,
      creatorId: txp.creatorId,
      amount: txp.getTotalAmount(),
      message: txp.message,
      tokenAddress: txp.tokenAddress,
      multisigContractAddress: txp.multisigContractAddress
    },
    extraArgs
  );

  service._notify(type, data, {}, cb);
}

export function getNotifications(service: WalletService, opts, cb: Callback) {
  opts = opts || {};

  service.getWallet({}, (err, wallet) => {
    if (err) return cb(err);

    async.map(
      [`${wallet.chain}:${wallet.network}`, service.walletId],
      (walletId, next) => {
        service.storage.fetchNotifications(walletId, opts.notificationId, opts.minTs || 0, next);
      },
      (err, res) => {
        if (err) return cb(err);

        const notifications = res
          .flat()
          .map((notification: INotification) => ({ ...notification, walletId: service.walletId }))
          .sort((a, b) => a.id - b.id);

        return cb(null, notifications);
      }
    );
  });
}

export function pushNotificationsSubscribe(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['token'], cb)) return;

  const sub = PushNotificationSub.create({
    copayerId: service.copayerId,
    token: opts.token,
    packageName: opts.packageName,
    platform: opts.platform,
    walletId: opts.walletId
  });

  service.storage.storePushNotificationSub(sub, cb);
}

export function pushNotificationsBrazeSubscribe(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['externalUserId'], cb)) return;

  const sub = PushNotificationSub.create({
    copayerId: service.copayerId,
    externalUserId: opts.externalUserId,
    packageName: opts.packageName,
    platform: opts.platform,
    walletId: opts.walletId
  });

  service.storage.storePushNotificationBrazeSub(sub, cb);
}

export function pushNotificationsUnsubscribe(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['token'], cb)) return;

  service.storage.removePushNotificationSub(service.copayerId, opts.token, cb);
}

export function pushNotificationsBrazeUnsubscribe(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['externalUserId'], cb)) return;

  service.storage.removePushNotificationBrazeSub(service.copayerId, opts.externalUserId, cb);
}

export function txConfirmationSubscribe(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['txid'], cb)) return;

  const txids = Array.isArray(opts.txid) ? opts.txid : [opts.txid];
  for (const txid of txids) {
    const sub = TxConfirmationSub.create({
      copayerId: service.copayerId,
      walletId: service.walletId,
      txid,
      amount: opts.amount,
      isCreator: true
    });

    service.storage.storeTxConfirmationSub(sub, cb);
  }
}

export function txConfirmationUnsubscribe(service: WalletService, opts, cb: Callback) {
  if (!checkRequired(opts, ['txid'], cb)) return;

  service.storage.removeTxConfirmationSub(service.copayerId, opts.txid, cb);
}
