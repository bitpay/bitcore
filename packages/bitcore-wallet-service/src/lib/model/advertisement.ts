const $ = require('preconditions').singleton();
var _ = require('lodash');

export interface IAdvertisement {
  name: string;
  advertisementId: string;
  type: string;
  title: string;
  body: string;
  imgUrl: string;
  linkText: string;
  linkUrl: string;
  app: string;
  dismissible: boolean;
  isAdActive: boolean;
  isTesting: boolean;
}

export class Advertisement {
  advertisementId: string;
  name: string;
  title: string;
  type: string;
  body: string;
  imgUrl: string;
  linkText: string;
  linkUrl: string;
  app: string;
  dismissible: boolean;
  isAdActive: boolean;
  isTesting: boolean;

  static create(opts) {
    opts = opts || {};
    const x = new Advertisement();
    x.name = opts.name;
    x.title = opts.title;
    x.type = opts.type;
    x.body = opts.body;
    x.imgUrl = opts.imgUrl;
    x.linkText = opts.linkText;
    x.linkUrl = opts.linkUrl;
    x.app = opts.app;
    x.dismissible = opts.dismissible;
    x.isAdActive = opts.isAdActive;
    x.isTesting = opts.isTesting;

    return x;
  }

  static fromObj(obj) {
    const x = new Advertisement();
    x.name = obj.name;
    x.advertisementId = obj.advertisementId;
    x.title = obj.title;
    x.type = obj.type;
    x.body = obj.body;
    x.imgUrl = obj.imgUrl;
    x.linkText = obj.linkText;
    x.linkUrl = obj.linkUrl;
    x.app = obj.app;
    x.dismissible = obj.dismissible;
    x.isAdActive = obj.isAdActive;
    x.isTesting = obj.isTesting;

    return x;
  }

  toObject() {
    const x: any = _.cloneDeep(this);
    return x;
  }
}
