export interface IPreferences {
  version: string;
  createdOn: number;
  walletId: string;
  copayerId: string;
  email: string;
  language: string;
  unit: number;
}
export class Preferences {
  version: string;
  createdOn: number;
  walletId: string;
  copayerId: string;
  email: string;
  language: string;
  unit: number;

  static create(opts) {
    opts = opts || {};

    const x = new Preferences();

    x.version = '1.0.0';
    x.createdOn = Math.floor(Date.now() / 1000);
    x.walletId = opts.walletId;
    x.copayerId = opts.copayerId;
    x.email = opts.email;
    x.language = opts.language;
    x.unit = opts.unit;
    return x;
  }

  static fromObj(obj) {
    const x = new Preferences();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.walletId = obj.walletId;
    x.copayerId = obj.copayerId;
    x.email = obj.email;
    x.language = obj.language;
    x.unit = obj.unit;
    return x;
  }
}
