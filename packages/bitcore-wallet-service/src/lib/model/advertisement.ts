const $ = require('preconditions').singleton();

export interface IAdvertisement {
  advertisementId: string;
  title: string;
  body: string;
  imgUrl: string;
  linkUrl: string;
  isAdActive: boolean;
  isTesting: boolean;
}

export class Advertisement {
  advertisementId: string;
  title: string;
  body: string;
  imgUrl: string;
  linkUrl: string;
  isAdActive: boolean;
  isTesting: boolean;

  static create(opts) {
    opts = opts || {};
    const x = new Advertisement();
    x.title = opts.title;
    x.body = opts.body;
    x.imgUrl = opts.imgUrl;
    x.linkUrl = opts.linkUrl;
    x.isAdActive = opts.isAdActive;

    return x;
  }

  static fromObj(obj) {
    const x = new Advertisement();
    x.title = obj.title;
    x.body = obj.body;
    x.imgUrl = obj.imgUrl;
    x.linkUrl = obj.linkUrl;
    x.isAdActive = obj.isAdActive;

    return x;
  }
}
