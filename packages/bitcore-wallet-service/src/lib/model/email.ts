import _ from 'lodash';

const Uuid = require('uuid');

interface IEmail {
  version: number;
  createdOn: number;
  id: number;
  walletId: string;
  copayerId: string;
  from: string;
  to: string;
  subject: string;
  bodyPlain: string;
  bodyHtml: string;
  status: string;
  attempts: number;
  lastAttemptOn?: number;
  notificationId: string;
  language: string;
}
export class Email {
  version: number;
  createdOn: number;
  id: string | number;
  walletId: string;
  copayerId: string;
  from: string;
  to: string;
  subject: string;
  bodyPlain: string;
  bodyHtml: string;
  status: string;
  attempts: number;
  lastAttemptOn?: number;
  notificationId: string;
  language: string;

  static create(opts) {
    opts = opts || {};

    const x = new Email();

    x.version = 2;
    const now = Date.now();
    x.createdOn = Math.floor(now / 1000);
    x.id = _.padStart(now.toString(), 14, '0') + Uuid.v4();
    x.walletId = opts.walletId;
    x.copayerId = opts.copayerId;
    x.from = opts.from;
    x.to = opts.to;
    x.subject = opts.subject;
    x.bodyPlain = opts.bodyPlain;
    x.bodyHtml = opts.bodyHtml;
    x.status = 'pending';
    x.attempts = 0;
    x.lastAttemptOn = null;
    x.notificationId = opts.notificationId;
    x.language = opts.language || 'en';
    return x;
  }

  static fromObj(obj) {
    const x = new Email();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.id = obj.id;
    x.walletId = obj.walletId;
    x.copayerId = obj.copayerId;
    x.from = obj.from;
    x.to = obj.to;
    x.subject = obj.subject;
    if (parseInt(x.version.toString()) == 1) {
      x.bodyPlain = obj.body;
      x.version = 2;
    } else {
      x.bodyPlain = obj.bodyPlain;
    }
    x.bodyHtml = obj.bodyHtml;
    x.status = obj.status;
    x.attempts = obj.attempts;
    x.lastAttemptOn = obj.lastAttemptOn;
    x.notificationId = obj.notificationId;
    x.language = obj.language;
    return x;
  }

  _logAttempt(result) {
    this.attempts++;
    this.lastAttemptOn = Math.floor(Date.now() / 1000);
    this.status = result;
  }

  setSent() {
    this._logAttempt('sent');
  }

  setFail() {
    this._logAttempt('fail');
  }
}
