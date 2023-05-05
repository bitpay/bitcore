import _ from 'lodash';

const Uuid = require('uuid');

export interface IAppreciation {
    id: number;
    createdOn: number;
    dateClaim: string;
    deviceId: string;
    claimCode: string;
    status: boolean;
    type: string;
}
export class Appreciation {
    id: number;
    createdOn: number;
    dateClaim: string;
    deviceId: string;
    claimCode: string;
    status: boolean;
    type: string;

  static create(opts) {
    opts = opts || {};

    const now = Math.floor(Date.now() / 1000);

    const x = new Appreciation();

    x.id = Uuid.v4();
    x.createdOn = now;
    x.dateClaim = 'null'
    x.deviceId = opts.deviceId;
    x.claimCode = opts.claimCode;
    x.status = false;
    x.type = opts.type

    return x;
  }

  static fromObj(obj) {
    const x = new Appreciation();

    x.id = obj.id;
    x.createdOn = obj.createdOn;
    x.dateClaim = obj.dateClaim;
    x.deviceId = obj.deviceId;
    x.claimCode = obj.claimCode;
    x.status = obj.status;
    x.type = obj.type;

    return x;
  }

  toObject() {
    return this;
  }

  active() {
    const status = this.status;
    if (!status) this.status = true;
  }
}
