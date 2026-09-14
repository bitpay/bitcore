import { TxNote } from '../model';
import { checkRequired } from './shared';
import type { WalletService } from '../server';

export function editTxNote(service: WalletService, opts, cb) {
  if (!checkRequired(opts, 'txid', cb)) return;

  service._runLocked(cb, cb => {
    service.storage.fetchTxNote(service.walletId, opts.txid, (err, note) => {
      if (err) return cb(err);

      if (!note) {
        note = TxNote.create({
          walletId: service.walletId,
          txid: opts.txid,
          copayerId: service.copayerId,
          body: opts.body
        });
      } else {
        note.edit(opts.body, service.copayerId);
      }

      service.storage.storeTxNote(note, err => {
        if (err) return cb(err);
        service.storage.fetchTxNote(service.walletId, opts.txid, cb);
      });
    });
  });
}

export function getTxNote(service: WalletService, opts, cb) {
  if (!checkRequired(opts, 'txid', cb)) return;
  service.storage.fetchTxNote(service.walletId, opts.txid, cb);
}

export function getTxNotes(service: WalletService, opts, cb) {
  opts = opts || {};
  service.storage.fetchTxNotes(service.walletId, opts, cb);
}
