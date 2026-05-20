'use strict';

var crypto = require('crypto');
var utils = require('./utils');
var assert = utils.assert;

function HmacDRBG(options) {
  if (!(this instanceof HmacDRBG))
    return new HmacDRBG(options);
  this.hash = options.hash;

  this.outLen = 32; // sha256 output length in bytes
  this.minEntropy = options.minEntropy || 192;

  this._reseed = null;
  this.reseedInterval = null;
  this.K = null;
  this.V = null;

  var entropy = options.entropy;
  var nonce = options.nonce;
  var pers = options.pers || [];

  if (typeof entropy === 'string') {
    entropy = utils.toArray(entropy, options.entropyEnc || 'hex');
  } else {
    entropy = Array.prototype.slice.call(entropy);
  }
  if (typeof nonce === 'string') {
    nonce = utils.toArray(nonce, options.nonceEnc || 'hex');
  } else {
    nonce = Array.prototype.slice.call(nonce);
  }
  if (typeof pers === 'string') {
    pers = utils.toArray(pers, options.persEnc || 'hex');
  } else {
    pers = Array.prototype.slice.call(pers);
  }

  assert(entropy.length >= (this.minEntropy / 8),
         'Not enough entropy. Minimum is: ' + this.minEntropy + ' bits');
  this._init(entropy, nonce, pers);
}
module.exports = HmacDRBG;

HmacDRBG.prototype._init = function init(entropy, nonce, pers) {
  var seed = entropy.concat(nonce).concat(pers);

  this.K = new Array(this.outLen).fill(0x00);
  this.V = new Array(this.outLen).fill(0x01);

  this._update(seed);
  this._reseed = 1;
  this.reseedInterval = 0x1000000000000; // 2^48
};

HmacDRBG.prototype._hmac = function hmac(data) {
  var k = Buffer.from(this.K);
  var v = Buffer.from(this.V);
  var h = crypto.createHmac('sha256', k);
  h.update(v);
  if (data) {
    h.update(Buffer.from(data));
  }
  return h.digest();
};

HmacDRBG.prototype._update = function update(seed) {
  var kmac = this._hmac();
  // update with 0x00
  var kbuf = Buffer.from(kmac);
  kbuf = Buffer.concat([kbuf, Buffer.from([0x00])]);
  if (seed) {
    kbuf = Buffer.concat([kbuf, Buffer.from(seed)]);
  }
  var kh = crypto.createHmac('sha256', Buffer.from(this.K));
  kh.update(kbuf);
  this.K = Array.prototype.slice.call(kh.digest());

  var vh = crypto.createHmac('sha256', Buffer.from(this.K));
  vh.update(Buffer.from(this.V));
  this.V = Array.prototype.slice.call(vh.digest());

  if (!seed)
    return;

  // K = Hmac(K, V || 0x01 || seed)
  var k2 = Buffer.concat([Buffer.from(this.V), Buffer.from([0x01])]);
  if (seed) {
    k2 = Buffer.concat([k2, Buffer.from(seed)]);
  }
  var kh2 = crypto.createHmac('sha256', Buffer.from(this.K));
  kh2.update(k2);
  this.K = Array.prototype.slice.call(kh2.digest());

  var vh2 = crypto.createHmac('sha256', Buffer.from(this.K));
  vh2.update(Buffer.from(this.V));
  this.V = Array.prototype.slice.call(vh2.digest());
};

HmacDRBG.prototype.reseed = function reseed(entropy, entropyEnc, add, addEnc) {
  if (typeof entropyEnc !== 'string') {
    addEnc = add;
    add = entropyEnc;
    entropyEnc = null;
  }

  entropy = utils.toArray(entropy, entropyEnc);
  add = utils.toArray(add, addEnc);

  assert(entropy.length >= (this.minEntropy / 8),
         'Not enough entropy. Minimum is: ' + this.minEntropy + ' bits');

  this._update(entropy.concat(add || []));
  this._reseed = 1;
};

HmacDRBG.prototype.generate = function generate(len, enc, add, addEnc) {
  if (this._reseed > this.reseedInterval)
    throw new Error('Reseed is required');

  if (typeof enc !== 'string') {
    addEnc = add;
    add = enc;
    enc = null;
  }

  if (add) {
    add = utils.toArray(add, addEnc || 'hex');
    this._update(add);
  }

  var temp = [];
  while (temp.length < len) {
    var h = this._hmac();
    this.V = Array.prototype.slice.call(h);
    temp = temp.concat(this.V);
  }

  var res = temp.slice(0, len);
  this._update(add);
  this._reseed++;
  // Original elliptic: utils.encode(arr, enc) returns arr when enc !== 'hex',
  // or toHex(arr) when enc === 'hex'. The adapted utils.encode is incompatible.
  if (enc === 'hex') {
    return utils.toHex(res);
  }
  return res;
};
