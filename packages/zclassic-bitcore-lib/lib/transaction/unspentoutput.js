'use strict';

var _ = require('lodash');
var $ = require('../util/preconditions');
var JSUtil = require('../util/js');

var Script = require('../script');
var Address = require('../address');
var Unit = require('../unit');

/**
 * Represents an unspent output information: its script, associated amount and address,
 * transaction id and output index.
 *
 * @constructor
 * @param {object} data
 * @param {string} data.txid the previous transaction id
 * @param {string=} data.txId alias for `txid`
 * @param {number} data.vout the index in the transaction
 * @param {number=} data.outputIndex alias for `vout`
 * @param {string|Script} data.scriptPubKey the script that must be resolved to release the funds
 * @param {string|Script=} data.script alias for `scriptPubKey`
 * @param {number} data.amount amount of bitcoins associated
 * @param {number=} data.satoshis alias for `amount`, but expressed in satoshis (1 BTC = 1e8 satoshis)
 * @param {string|Address=} data.address the associated address to the script, if provided
 */
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
  $.checkArgument(!_.isUndefined(data.scriptPubKey) || !_.isUndefined(data.script),
                  'Must provide the scriptPubKey for that output!');
  var script = new Script(data.scriptPubKey || data.script);
  $.checkArgument(!_.isUndefined(data.amount) || !_.isUndefined(data.satoshis),
                  'Must provide an amount for the output');
  var amount = !_.isUndefined(data.amount) ? new Unit.fromBTC(data.amount).toSatoshis() : data.satoshis;
  $.checkArgument(_.isNumber(amount), 'Amount must be a number');
  JSUtil.defineImmutable(this, {
    address: address,
    txId: txId,
    outputIndex: outputIndex,
    script: script,
    satoshis: amount
  });
}

/**
 * Provide an informative output when displaying this object in the console
 * @returns string
 */
UnspentOutput.prototype.inspect = function() {
  return '<UnspentOutput: ' + this.txId + ':' + this.outputIndex +
         ', satoshis: ' + this.satoshis + ', address: ' + this.address + '>';
};

/**
 * String representation: just "txid:index"
 * @returns string
 */
UnspentOutput.prototype.toString = function() {
  return this.txId + ':' + this.outputIndex;
};

/**
 * Deserialize an UnspentOutput from an object
 * @param {object|string} data
 * @return UnspentOutput
 */
UnspentOutput.fromObject = function(data) {
  return new UnspentOutput(data);
};

/**
 * Returns a plain object (no prototype or methods) with the associated info for this output
 * @return {object}
 */
UnspentOutput.prototype.toObject = UnspentOutput.prototype.toJSON = function toObject() {
  return {
    address: this.address ? this.address.toString() : undefined,
    txid: this.txId,
    vout: this.outputIndex,
    scriptPubKey: this.script.toBuffer().toString('hex'),
    amount: Unit.fromSatoshis(this.satoshis).toBTC()
  };
};

module.exports = UnspentOutput;
