'use strict';

var _ = require('lodash');
var $ = require('./util/preconditions');
var JSUtil = require('./util/js');

var Script = require('./script');
var Address = require('./address');
var Unit = require('./unit');

function UTXO(data) {
  /* jshint maxcomplexity: 20 */
  /* jshint maxstatements: 20 */
  if (!(this instanceof UTXO)) {
    return new UTXO(data);
  }
  $.checkArgument(_.isObject(data), 'Must provide an object from where to extract data');
  var address = data.address ? new Address(data.address) : undefined;
  var txId = data.txid ? data.txid : data.txId;
  if (!txId || !JSUtil.isHexaString(txId) || txId.length > 64) {
    // TODO: Use the errors library
    throw new Error('Invalid TXID in object', data);
  }
  var outputIndex = _.isUndefined(data.vout) ? data.outputIndex : data.vout;
  if (!_.isNumber(outputIndex)) {
    throw new Error('Invalid outputIndex, received ' + outputIndex);
  }
  $.checkArgument(data.scriptPubKey || data.script, 'Must provide the scriptPubKey for that output!');
  var script = new Script(data.scriptPubKey || data.script);
  $.checkArgument(data.amount || data.satoshis, 'Must provide the scriptPubKey for that output!');
  var amount = data.amount ? new Unit.fromBTC(data.amount).toSatoshis() : data.satoshis;
  $.checkArgument(_.isNumber(amount), 'Amount must be a number');
  JSUtil.defineImmutable(this, {
    address: address,
    txId: txId,
    outputIndex: outputIndex,
    script: script,
    satoshis: amount
  });
}

UTXO.prototype.inspect = function() {
  return '<UTXO: ' + this.txId + ':' + this.outputIndex +
         ', satoshis: ' + this.satoshis + ', address: ' + this.address + '>';
};

UTXO.prototype.toString = function() {
  return this.txId + ':' + this.outputIndex;
};

UTXO.fromJSON = UTXO.fromObject = function(data) {
  if (_.isString(data)) {
    data = JSON.parse(data);
  }
  return new UTXO(data);
};

UTXO.prototype.toJSON = function() {
  return JSON.stringify(this.toObject());
};

UTXO.prototype.toObject = function() {
  return {
    address: this.address.toObject(),
    txid: this.txId,
    vout: this.outputIndex,
    scriptPubKey: this.script.toObject(),
    amount: Unit.fromSatoshis(this.satoshis).toBTC()
  };
};

module.exports = UTXO;
