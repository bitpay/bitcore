'use strict';

require('classtool');


function spec() {
  var util            = require('util');
  var RpcClient       = require('bitcore/RpcClient').class();
  var networks        = require('bitcore/networks');
  var async           = require('async');
  var Transaction     = require('./Transaction');
  var TransactionItem = require('./TransactionItem');
  var config          = require('../../config/config');

  function Address(addrStr,cb) {
    this.addrStr        = addrStr;
    this.balanceSat        = 0;
    this.totalReceivedSat  = 0;
    this.totalSentSat      = 0;
    this.txApperances   = 0;

    // TODO store only txids? +index? +all?
    this.transactions   = [];
  }

  Address.prototype.update = function(next) {

    var that = this;
    async.series([
      // TODO TXout!
      //T
      function (cb) {
      TransactionItem.find({addr:that.addrStr}, function(err,txItems){
        if (err) return cb(err);

        txItems.forEach(function(txItem){

console.log(txItem.txid + ' : ' + txItem.value_sat);
          that.txApperances +=1;
          that.balanceSat += txItem.value_sat;

          that.transactions.push(txItem.txid);

          if (txItem.value_sat > 0)
            that.totalSentSat += txItem.value_sat;
          else 
            that.totalReceivedSat += Math.abs(txItem.value_sat);
        });
        return cb();
      })
    }
    ], function (err) {
      return next(err);
    });
  }

  return Address;
}
module.defineClass(spec);


/**
 * Addr Schema Idea for moogose. Not used now.
 *
var AddressSchema = new Schema({

  // For now we keep this as short as possible
  // More fields will be propably added as we move
  // forward with the UX
  addr: {
    type: String,
    index: true,
    unique: true,
  },
  inputs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionItem' //Edit: I'd put the schema. Silly me.
  }],
  output: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionItem' //Edit: I'd put the schema. Silly me.
  }],
});


AddressSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


AddressSchema.statics.fromAddr = function(hash, cb) {
  this.findOne({
    hash: hash,
  }).exec(cb);
};


AddressSchema.statics.fromAddrWithInfo = function(hash, cb) {
  this.fromHash(hash, function(err, addr) {
    if (err) return cb(err);
    if (!addr) { return cb(new Error('Addr not found')); }
// TODO
//    addr.getInfo(function(err) { return cb(err,addr); } );
  });
};

module.exports = mongoose.model('Address', AddressSchema);
*/

