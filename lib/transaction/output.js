'use strict';

var _ = require('lodash');
var BN = require('../crypto/bn');
var buffer = require('buffer');
var bufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');
var BufferWriter = require('../encoding/bufferwriter');
var Script = require('../script');

function Output(params) {
  if (!(this instanceof Output)) {
    return new Output(params);
  }
  if (params) {
    if (JSUtil.isValidJSON(params)) {
      return Output.fromJSON(params);
    }
    return this._fromObject(params);
  }
}

Object.defineProperty(Output.prototype, 'script', {
  configurable: false,
  writeable: false,
  enumerable: true,
  get: function() {
    if (!this._script) {
      this._script = new Script(this._scriptBuffer);
    }
    return this._script;
  }
});

Object.defineProperty(Output.prototype, 'satoshis', {
  configurable: false,
  writeable: true,
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
      this._satoshisBN = BN.fromNumber(num);
      this._satoshis = num;
    }
  }
});

Output.prototype._fromObject = function(param) {
  this.satoshis = param.satoshis;
  if (param.script || param.scriptBuffer) {
    this.setScript(param.script || param.scriptBuffer);
  }
  return this;
};

Output.prototype.toObject = function toObject() {
  return {
    satoshis: this.satoshis,
    script: this.script.toString()
  };
};

Output.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

Output.fromJSON = function(json) {
  if (JSUtil.isValidJSON(json)) {
    json = JSON.parse(json);
  }
  return new Output({
    satoshis: json.satoshis || -(-json.valuebn),
    script: new Script(json.script)
  });
};

Output.prototype.setScript = function(script) {
  if (script instanceof Script) {
    this._scriptBuffer = script.toBuffer();
    this._script = script;
  } else if (_.isString(script)) {
    this._script = new Script(script);
    this._scriptBuffer = this._script.toBuffer();
  } else if (bufferUtil.isBuffer(script)) {
    this._scriptBuffer = script;
    this._script = null;
  } else {
    throw new TypeError('Unrecognized Argument');
  }
  return this;
};

Output.prototype.inspect = function() {
  return '<Output (' + this.satoshis + ' sats) ' + this.script.inspect() + '>';
};

Output.fromBufferReader = function(br) {
  var output = new Output();
  output.satoshis = br.readUInt64LEBN();
  var size = br.readVarintNum();
  if (size !== 0) {
    output._scriptBuffer = br.read(size);
  } else {
    output._scriptBuffer = new buffer.Buffer([]);
  }
  return output;
};

Output.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeUInt64LEBN(this._satoshisBN);
  var script = this._scriptBuffer;
  writer.writeVarintNum(script.length);
  writer.write(script);
  return writer;
};

module.exports = Output;
