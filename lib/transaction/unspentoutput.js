'use strict';

var _ = require('lodash');
var $ = require('../util/preconditions');
var JSUtil = require('../util/js');

var Script = require('../script');
var Address = require('../address');
var Unit = require('../unit');

function UnspentOutput(data) {
  /* jshint maxcomplexity: 20 */
  /* jshint maxstatements: 20 */
  if (!(this instanceof UnspentOutput)) {
    return new UnspentOutput(data);
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

UnspentOutput.prototype.inspect = function() {
  return '<UnspentOutput: ' + this.txId + ':' + this.outputIndex +
         ', satoshis: ' + this.satoshis + ', address: ' + this.address + '>';
};

UnspentOutput.prototype.toString = function() {
  return this.txId + ':' + this.outputIndex;
};

UnspentOutput.fromJSON = UnspentOutput.fromObject = function(data) {
  if (JSUtil.isValidJSON(data)) {
    data = JSON.parse(data);
  }
  return new UnspentOutput(data);
};

UnspentOutput.prototype.toJSON = function() {
  return JSON.stringify(this.toObject());
};

UnspentOutput.prototype.toObject = function() {
  return {
    address: this.address.toString(),
    txid: this.txId,
    vout: this.outputIndex,
    scriptPubKey: this.script.toBuffer().toString('hex'),
    amount: Unit.fromSatoshis(this.satoshis).toBTC()
  };
};

module.exports = UnspentOutput;
