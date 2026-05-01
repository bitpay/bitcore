'use strict';

var _ = require('lodash');
var $ = require('../util/preconditions');
var BN = require('../crypto/bn');
var buffer = require('buffer');
var BufferWriter = require('../encoding/bufferwriter');
var BufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');

var ZCProof = require('../zclassic/proof');

var ZC_NUM_JS_INPUTS = 2;
var ZC_NUM_JS_OUTPUTS = 2;

// leading + v + rho + r + memo + auth
var ZC_NOTECIPHERTEXT_SIZE = 1 + 8 + 32 + 32 + 512 + 16;

// ��_A + ��_B + ��_C
var GROTH_PROOF_SIZE = 48 + 96 + 48;

function JSDescription(params, version) {
  if (!(this instanceof JSDescription)) {
      return new JSDescription(params, version);
  }
  this.nullifiers = [];
  this.commitments = [];
  this.ciphertexts = [];
  this.macs = [];
  if (params) {
      return this._fromObject(params, version);
  }
}

Object.defineProperty(JSDescription.prototype, 'vpub_old', {
  configurable: false,
  enumerable: true,
  get: function() {
    return this._vpub_old;
  },
  set: function(num) {
    if (num instanceof BN) {
      this._vpub_oldBN = num;
      this._vpub_old = num.toNumber();
    } else if (_.isString(num)) {
      this._vpub_old = parseInt(num);
      this._vpub_oldBN = BN.fromNumber(this._vpub_old);
    } else {
      $.checkArgument(
        JSUtil.isNaturalNumber(num),
        'vpub_old is not a natural number'
      );
      this._vpub_oldBN = BN.fromNumber(num);
      this._vpub_old = num;
    }
    $.checkState(
      JSUtil.isNaturalNumber(this._vpub_old),
      'vpub_old is not a natural number'
    );
  }
});

Object.defineProperty(JSDescription.prototype, 'vpub_new', {
  configurable: false,
  enumerable: true,
  get: function() {
    return this._vpub_new;
  },
  set: function(num) {
    if (num instanceof BN) {
      this._vpub_newBN = num;
      this._vpub_new = num.toNumber();
    } else if (_.isString(num)) {
      this._vpub_new = parseInt(num);
      this._vpub_newBN = BN.fromNumber(this._vpub_new);
    } else {
      $.checkArgument(
        JSUtil.isNaturalNumber(num),
        'vpub_new is not a natural number'
      );
      this._vpub_newBN = BN.fromNumber(num);
      this._vpub_new = num;
    }
    $.checkState(
      JSUtil.isNaturalNumber(this._vpub_new),
      'vpub_new is not a natural number'
    );
  }
});

JSDescription.fromObject = function(obj, version) {
  $.checkArgument(_.isObject(obj));
  var jsdesc = new JSDescription();
    return jsdesc._fromObject(obj, version);
};

JSDescription.prototype._fromObject = function(params, version) {
  var nullifiers = [];
  _.each(params.nullifiers, function(nullifier) {
    nullifiers.push(BufferUtil.reverse(new buffer.Buffer(nullifier, 'hex')));
  });
  var commitments = [];
  _.each(params.commitments, function(commitment) {
    commitments.push(BufferUtil.reverse(new buffer.Buffer(commitment, 'hex')));
  });
  var ciphertexts = [];
  _.each(params.ciphertexts, function(ciphertext) {
    ciphertexts.push(new buffer.Buffer(ciphertext, 'hex'));
  });
  var macs = [];
  _.each(params.macs, function(mac) {
    macs.push(BufferUtil.reverse(new buffer.Buffer(mac, 'hex')));
  });
  this.vpub_old = params.vpub_old;
  this.vpub_new = params.vpub_new;
  this.anchor = BufferUtil.reverse(new buffer.Buffer(params.anchor, 'hex'));
  this.nullifiers = nullifiers;
  this.commitments = commitments;
  this.ephemeralKey = BufferUtil.reverse(new buffer.Buffer(params.ephemeralKey, 'hex'));
  this.ciphertexts = ciphertexts;
  this.randomSeed = BufferUtil.reverse(new buffer.Buffer(params.randomSeed, 'hex'));
  this.macs = macs;
  if (version >= 4) {
    this.proof = params.proof;
  } else {
    this.proof = ZCProof.fromObject(params.proof);
  }
  return this;
};

JSDescription.prototype.toObject = JSDescription.prototype.toJSON = function toObject(version) {
  var nullifiers = [];
  _.each(this.nullifiers, function(nullifier) {
    nullifiers.push(BufferUtil.reverse(nullifier).toString('hex'));
  });
  var commitments = [];
  _.each(this.commitments, function(commitment) {
    commitments.push(BufferUtil.reverse(commitment).toString('hex'));
  });
  var ciphertexts = [];
  _.each(this.ciphertexts, function(ciphertext) {
    ciphertexts.push(ciphertext.toString('hex'));
  });
  var macs = [];
  _.each(this.macs, function(mac) {
    macs.push(BufferUtil.reverse(mac).toString('hex'));
  });
  var proof;
  if (version >= 4) {
    proof = this.proof;
  } else {
    proof = this.proof.toObject();
  }
  var obj = {
    vpub_old: this.vpub_old,
    vpub_new: this.vpub_new,
    anchor: BufferUtil.reverse(this.anchor).toString('hex'),
    nullifiers: nullifiers,
    commitments: commitments,
    ephemeralKey: BufferUtil.reverse(this.ephemeralKey).toString('hex'),
    ciphertexts: ciphertexts,
    randomSeed: BufferUtil.reverse(this.randomSeed).toString('hex'),
    macs: macs,
    proof: proof,
  };
  return obj;
};

JSDescription.fromBufferReader = function(br, version) {
  var i;
  var jsdesc = new JSDescription();
  jsdesc.vpub_old = br.readUInt64LEBN();
  jsdesc.vpub_new = br.readUInt64LEBN();
  jsdesc.anchor = br.read(32);
  for (i = 0; i < ZC_NUM_JS_INPUTS; i++) {
    jsdesc.nullifiers.push(br.read(32));
  }
  for (i = 0; i < ZC_NUM_JS_OUTPUTS; i++) {
    jsdesc.commitments.push(br.read(32));
  }
  jsdesc.ephemeralKey = br.read(32);
  jsdesc.randomSeed = br.read(32);
  for (i = 0; i < ZC_NUM_JS_INPUTS; i++) {
    jsdesc.macs.push(br.read(32));
  }
  if (version >= 4) {
    jsdesc.proof = br.read(GROTH_PROOF_SIZE);
  } else {
    jsdesc.proof = ZCProof.fromBufferReader(br);
  }
  for (i = 0; i < ZC_NUM_JS_OUTPUTS; i++) {
    jsdesc.ciphertexts.push(br.read(ZC_NOTECIPHERTEXT_SIZE));
  }
  return jsdesc;
};

JSDescription.prototype.toBufferWriter = function(writer, version) {
  var i;
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeUInt64LEBN(this._vpub_oldBN);
  writer.writeUInt64LEBN(this._vpub_newBN);
  writer.write(this.anchor);
  for (i = 0; i < ZC_NUM_JS_INPUTS; i++) {
    writer.write(this.nullifiers[i]);
  }
  for (i = 0; i < ZC_NUM_JS_OUTPUTS; i++) {
    writer.write(this.commitments[i]);
  }
  writer.write(this.ephemeralKey);
  writer.write(this.randomSeed);
  for (i = 0; i < ZC_NUM_JS_INPUTS; i++) {
    writer.write(this.macs[i]);
  }
  if (version >= 4) {
    writer.write(this.proof);
  } else {
    this.proof.toBufferWriter(writer);
  }
  for (i = 0; i < ZC_NUM_JS_OUTPUTS; i++) {
    writer.write(this.ciphertexts[i]);
  }
  return writer;
};

module.exports = JSDescription;
