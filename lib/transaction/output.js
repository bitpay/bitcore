'use strict';

var _ = require('lodash');
var BN = require('../crypto/bn');
var buffer = require('buffer');
var bufferUtil = require('../util/buffer');
var BufferWriter = require('../encoding/bufferwriter');
var Script = require('../script');

function Output(params) {
  if (!(this instanceof Output)) {
    return new Output(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

Object.defineProperty(Output.prototype, 'script', {
  configurable: false,
  writeable: false,
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
  get: function() {
    if (this._satoshis.lt(1e52)) {
      return this._satoshis.toNumber();
    }
    return this._satoshis;
  },
  set: function(num) {
    if (num instanceof BN) {
      this._satoshis = num;
    } else if (_.isNumber(num)) {
      this._satoshis = BN().fromNumber(num);
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

Output.prototype.toJSON = function() {
  return {
    satoshis: this.satoshis,
    script: this._scriptBuffer.toString('hex')
  };
};

Output.fromJSON = function(json) {
  return new Output({
    satoshis: json.satoshis || -(-json.valuebn),
    script: new Script(json.script)
  });
};

Output.prototype.setScript = function(script) {
  if (script instanceof Script) {
    this._scriptBuffer = script.toBuffer();
    this._script = script;
  } else if (bufferUtil.isBuffer(script)) {
    this._scriptBuffer = script;
    this._script = null;
  } else {
    throw new TypeError('Unrecognized Argument');
  }
  return this;
};

Output.fromBufferReader = function(br) {
  var output = new Output();
  output._satoshis = br.readUInt64LEBN();
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
  writer.writeUInt64LEBN(this._satoshis);
  var script = this._scriptBuffer;
  writer.writeVarintNum(script.length);
  writer.write(script);
  return writer;
};

module.exports = Output;
