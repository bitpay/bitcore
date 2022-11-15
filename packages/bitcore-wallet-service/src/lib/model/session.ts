import _ from 'lodash';

const Uuid = require('uuid');
const Defaults = require('../common/defaults');

export interface ISession {
  id: number;
  version: number;
  createdOn: number;
  updatedOn: number;
  copayerId: string;
  walletId: string;
}
export class Session {
  id: number;
  version: number;
  createdOn: number;
  updatedOn: number;
  copayerId: string;
  walletId: string;

  static create(opts) {
    opts = opts || {};

    const now = Math.floor(Date.now() / 1000);

    const x = new Session();

    x.id = Uuid.v4();
    x.version = 1;
    x.createdOn = now;
    x.updatedOn = now;
    x.copayerId = opts.copayerId;
    x.walletId = opts.walletId;

    return x;
  }

  static fromObj(obj) {
    const x = new Session();

    x.id = obj.id;
    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.updatedOn = obj.updatedOn;
    x.copayerId = obj.copayerId;
    x.walletId = obj.walletId;

    return x;
  }

  toObject() {
    return this;
  }

  isValid() {
    const now = Math.floor(Date.now() / 1000);
    return now - this.updatedOn <= Defaults.SESSION_EXPIRATION;
  }

  touch() {
    const now = Math.floor(Date.now() / 1000);
    this.updatedOn = now;
  }
}
