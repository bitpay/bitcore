'use strict';

var _ = require('lodash');
var BN = require('../crypto/bn');
var buffer = require('buffer');
var bufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');
var BufferWriter = require('../encoding/bufferwriter');
var BufferReader = require('../encoding/bufferreader');
var Script = require('../script');
var $ = require('../util/preconditions');
var errors = require('../errors');

var MAX_SAFE_INTEGER = 0x1fffffffffffff;

function Output(args) {
  if (!(this instanceof Output)) {
    return new Output(args);
  }
  if (_.isObject(args)) {
    this.satoshis = args.satoshis;
    if (bufferUtil.isBuffer(args.script)) {
      this._scriptBuffer = args.script;
    } else {
      var script;
      if (_.isString(args.script) && JSUtil.isHexa(args.script)) {
        script = Buffer.from(args.script, 'hex');
      } else {
        script = args.script;
      }
      this.setScript(script);
    }
    this.tokenData = args.tokenData;
  } else {
    throw new TypeError('Unrecognized argument for Output');
  }
}

Object.defineProperty(Output.prototype, 'script', {
  configurable: false,
  enumerable: true,
  get: function() {
    if (this._script) {
      return this._script;
    } else {
      this.setScriptFromBuffer(this._scriptBuffer);
      return this._script;
    }

  }
});

Object.defineProperty(Output.prototype, 'satoshis', {
  configurable: false,
  enumerable: true,
  get: function() {
    return this._satoshis;
  },
  set: function(num) {
    if (num instanceof BN) {
      this._satoshisBN = num;
      this._satoshis = num.toNumber();
    } else if (_.isString(num)) {
      this._satoshis = parseInt(num);
      this._satoshisBN = BN.fromNumber(this._satoshis);
    } else {
      $.checkArgument(
        JSUtil.isNaturalNumber(num),
        'Output satoshis is not a natural number'
      );
      this._satoshisBN = BN.fromNumber(num);
      this._satoshis = num;
    }
    $.checkState(
      JSUtil.isNaturalNumber(this._satoshis),
      'Output satoshis is not a natural number'
    );
  }
});

const maximumAmount = new BN('9223372036854775807');
const nftCapabilityNumberToLabel = ['none', 'mutable', 'minting'];
const nftCapabilityLabelToNumber = {
  'none': 0,
  'mutable': 1,
  'minting': 2,
};

Object.defineProperty(Output.prototype, 'tokenData', {
  configurable: false,
  enumerable: true,
  get: function() {
    return this._tokenData;
  },
  set: function(tokenData) {
    if (typeof tokenData === "object") {
      $.checkState(typeof tokenData.category !== "undefined", 'tokenData must have a category (a hex-encoded string or buffer)');
      const categoryBuf = typeof tokenData.category === 'string' ? Buffer.from(tokenData.category, 'hex') : Buffer.from(tokenData.category);
      $.checkState(categoryBuf.length === 32, 'tokenData must have a 32-byte category');
      const category = categoryBuf.toString('hex');
      $.checkState(typeof tokenData.amount !== "undefined", 'tokenData must have an amount (from 0 to 9223372036854775807)');
      $.checkState(typeof tokenData.amount !== "number" || tokenData.amount <= Number.MAX_SAFE_INTEGER, 'to avoid precision loss, tokenData amount must provided as a string for values greater than 9007199254740991.');
      const amount = new BN(tokenData.amount);
      $.checkState(amount.gten(0), 'tokenData amount must be greater than or equal to 0');
      $.checkState(amount.lte(maximumAmount), 'tokenData amount must be less than or equal to 9223372036854775807.');
      if(typeof tokenData.nft === "object"){
        const nft = {};
        nft.capability = tokenData.nft.capability === undefined ? 'none' : String(tokenData.nft.capability);
        $.checkState(nftCapabilityNumberToLabel.includes(nft.capability), 'nft capability must be "none", "mutable", or "minting".');
        const commitment = tokenData.nft.commitment === undefined ? Buffer.of() : typeof tokenData.nft.commitment === 'string' ? Buffer.from(tokenData.nft.commitment, 'hex') : Buffer.from(tokenData.nft.commitment);
        $.checkState(commitment.length <= 40, 'nft commitment length must be less than or equal to 40 bytes.');
        nft.commitment = commitment.toString('hex');
        this._tokenData = { category, amount, nft };
      } else {
        $.checkState(amount.gtn(0), 'tokenData must encode at least one token');
        this._tokenData = { category, amount };
      }
    }
  }
});

Output.prototype.invalidSatoshis = function() {
  if (this._satoshis > MAX_SAFE_INTEGER) {
    return 'transaction txout satoshis greater than max safe integer';
  }
  if (this._satoshis !== this._satoshisBN.toNumber()) {
    return 'transaction txout satoshis has corrupted value';
  }
  if (this._satoshis < 0) {
    return 'transaction txout negative';
  }
  return false;
};


Object.defineProperty(Output.prototype, 'satoshisBN', {
  configurable: false,
  enumerable: true,
  get: function() {
    return this._satoshisBN;
  },
  set: function(num) {
    this._satoshisBN = num;
    this._satoshis = num.toNumber();
    $.checkState(
      JSUtil.isNaturalNumber(this._satoshis),
      'Output satoshis is not a natural number'
    );
  }
});


Output.prototype.toObject = Output.prototype.toJSON = function toObject() {
  var obj = {
    satoshis: this.satoshis
  };
  obj.script = this._scriptBuffer.toString('hex');
  if(this._tokenData !== undefined) {
    obj.tokenData = this._tokenData;
    obj.tokenData.amount = obj.tokenData.amount.toString();
  }
  return obj;
};

Output.fromObject = function(data) {
  return new Output(data);
};

Output.prototype.setScriptFromBuffer = function(buffer) {
  this._scriptBuffer = buffer;
  try {
    this._script = Script.fromBuffer(this._scriptBuffer);
    this._script._isOutput = true;
  } catch(e) {
    if (e instanceof errors.Script.InvalidBuffer) {
      this._script = null;
    } else {
      throw e;
    }
  }
};

Output.prototype.setScript = function(script) {
  if (script instanceof Script) {
    this._scriptBuffer = script.toBuffer();
    this._script = script;
    this._script._isOutput = true;
  } else if (_.isString(script)) {
    this._script = Script.fromString(script);
    this._scriptBuffer = this._script.toBuffer();
    this._script._isOutput = true;
  } else if (bufferUtil.isBuffer(script)) {
    this.setScriptFromBuffer(script);
  } else {
    throw new TypeError('Invalid argument type: script');
  }
  $.checkState(this._scriptBuffer[0] !== PREFIX_TOKEN, 'Invalid output script: output script may not begin with PREFIX_TOKEN (239).');
  return this;
};

Output.prototype.inspect = function() {
  var scriptStr;
  if (this.script) {
    scriptStr = this.script.inspect();
  } else {
    scriptStr = this._scriptBuffer.toString('hex');
  }
  let tokenInfo = '';
  if(typeof this._tokenData !== "undefined") {
    const nftInfo = typeof this._tokenData.nft === "undefined" ?
    '' : `; nft [capability: ${this._tokenData.nft.capability}; commitment: ${this._tokenData.nft.commitment}]`;
    tokenInfo = `(token category: ${this._tokenData.category}; amount: ${this._tokenData.amount}${nftInfo} ) `
  }
  return '<Output (' + this.satoshis + ' sats) ' + tokenInfo + scriptStr + '>';
};

const PREFIX_TOKEN = 0xef;
const HAS_AMOUNT = 0b00010000;
const HAS_NFT = 0b00100000;
const HAS_COMMITMENT_LENGTH = 0b01000000;
const RESERVED_BIT = 0b10000000;
const categoryLength = 32;
const tokenFormatMask = 0xf0;
const nftCapabilityMask = 0x0f;
const maximumCapability = 2;
Output.fromBufferReader = function(br) {
  var obj = {};
  obj.satoshis = br.readUInt64LEBN();
  var size = br.readVarintNum();
  if (size !== 0) {
    var scriptSlot = br.read(size);
    if(scriptSlot[0] === PREFIX_TOKEN) {
      $.checkState(scriptSlot.length >= 34, 'Invalid token prefix: insufficient length.');
      const tokenDataAndBytecode = BufferReader(scriptSlot.slice(1));
      obj.tokenData = {};
      obj.tokenData.category = tokenDataAndBytecode.read(categoryLength).reverse();
      const tokenBitfield = tokenDataAndBytecode.readUInt8();
      const prefixStructure = tokenBitfield & tokenFormatMask;
      $.checkState((prefixStructure & RESERVED_BIT) === 0, 'Invalid token prefix: reserved bit is set.');
      const nftCapabilityInt = tokenBitfield & nftCapabilityMask;
      $.checkState(nftCapabilityInt <= maximumCapability, `Invalid token prefix: capability must be none (0), mutable (1), or minting (2). Capability value: ${nftCapabilityInt}`);
      const hasNft = (prefixStructure & HAS_NFT) !== 0;
      const hasCommitmentLength = (prefixStructure & HAS_COMMITMENT_LENGTH) !== 0;
      if (hasCommitmentLength && !hasNft) $.checkState(false, 'Invalid token prefix: commitment requires an NFT.');
      const hasAmount = (prefixStructure & HAS_AMOUNT) !== 0;
      if(hasNft) {
        obj.tokenData.nft = {};
        obj.tokenData.nft.capability = nftCapabilityNumberToLabel[nftCapabilityInt];
        if(hasCommitmentLength) {
          const length = tokenDataAndBytecode.readVarintNum();
          $.checkState(length > 0, 'Invalid token prefix: if encoded, commitment length must be greater than 0.');
          obj.tokenData.nft.commitment = tokenDataAndBytecode.read(length);
        } else {
          obj.tokenData.nft.commitment = Buffer.of();
        }
      } else {
        $.checkState(nftCapabilityInt === 0, 'Invalid token prefix: capability requires an NFT.');
        $.checkState(hasAmount, 'Invalid token prefix: must encode at least one token.');
      }
      obj.tokenData.amount = hasAmount? tokenDataAndBytecode.readVarintBN() : new BN(0);
      obj.script = tokenDataAndBytecode.readAll();
    } else {
      obj.script = scriptSlot;
    }
  } else {
    obj.script = Buffer.from([]);
  }
  return new Output(obj);
};

Output.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeUInt64LEBN(this._satoshisBN);
  var script = this._scriptBuffer;
  if(typeof this._tokenData !== "undefined") {
    const tokenPrefix = new BufferWriter();
    tokenPrefix.writeUInt8(PREFIX_TOKEN);
    tokenPrefix.write(Buffer.from(this._tokenData.category, 'hex').reverse());
    const hasNft = this._tokenData.nft === undefined ? 0 : HAS_NFT;
    const capabilityInt = this._tokenData.nft === undefined ?
      0 : nftCapabilityLabelToNumber[this._tokenData.nft.capability];
    const hasCommitmentLength = this._tokenData.nft !== undefined &&
      this._tokenData.nft.commitment.length > 0 ? HAS_COMMITMENT_LENGTH : 0;
    const amount = new BN(this._tokenData.amount);
    const hasAmount = amount.gtn(0) ? HAS_AMOUNT : 0;
    const tokenBitfield =
      hasNft | capabilityInt | hasCommitmentLength | hasAmount;
    tokenPrefix.writeUInt8(tokenBitfield);
    if(hasCommitmentLength) {
      const commitment = Buffer.from(this._tokenData.nft.commitment, 'hex');
      tokenPrefix.writeVarintNum(commitment.length);
      tokenPrefix.write(commitment);
    }
    if(hasAmount) {
      tokenPrefix.writeVarintBN(amount);
    }
    const tokenPrefixBuffer = tokenPrefix.toBuffer();
    const totalLength = tokenPrefixBuffer.length + script.length;
    writer.writeVarintNum(totalLength);
    writer.write(tokenPrefixBuffer);
    writer.write(script);
    return writer;
  }
  writer.writeVarintNum(script.length);
  writer.write(script);
  return writer;
};

module.exports = Output;
