'use strict';
var request = require('request');
var async = require('async');

var Rpc = function(){

};

Rpc.prototype.callMethod = function(method, params, callback){
  request({
    method: 'POST',
    url: 'http://bitcoin:bitcoin@127.0.0.1:8332',
    body: {
      jsonrpc: '1.0',
      id: Date.now(),
      method: method,
      params: params
    },
    json: true
  }, function(err, res, body){
    if (err) {
      return callback(err);
    }
    if (body && body.error) {
      return callback(body.error);
    }
    callback(null, body && body.result);
  });
};

Rpc.prototype.getChainTip = function(callback){
  this.callMethod('getchaintips', [], function(err, result){
    if (err){
      return callback(err);
    }
    callback(null, result[0]);
  });
};

Rpc.prototype.getBestBlockHash = function(callback){
  this.callMethod('getbestblockhash', [], callback);
};

Rpc.prototype.getBlockHeight = function(callback){
  this.callMethod('getblockcount', [], callback);
};

Rpc.prototype.getBlock = function(hash, callback){
  this.callMethod('getblock', [hash], callback);
};

Rpc.prototype.getBlockHash = function(height, callback){
  this.callMethod('getblockhash', [height], callback);
};

Rpc.prototype.getBlockByHeight = function(height, callback){
  var self = this;
  self.getBlockHash(height, function(err, hash){
    if (err){
      return callback(err);
    }
    self.getBlock(hash, callback);
  });
};


Rpc.prototype.getTransaction = function(txid, callback){
  var self = this;
  self.callMethod('getrawtransaction', [txid], function(err, result){
    if (err){
      return callback(err);
    }
    if (!result){
      return callback(new Error('No result for getrawtransaction'));
    }
    self.callMethod('decoderawtransaction', [result], function(err, result){
      if (err) {
        return callback(err);
      }
      if (!result) {
        return callback(new Error('No result for decoderawtransaction'));
      }
      callback(null, result);
    });
  });
};

Rpc.prototype.decodeScript = function(hex, callback){
  this.callMethod('decodescript', [hex], callback);
};

Rpc.prototype.getWalletAddresses = function(account, callback){
  this.callMethod('getaddressesbyaccount', [account], callback);
};

Rpc.prototype.getBlockTransactions = function(hash, callback){
  var self = this;
  self.getBlock(hash, function(err, block){
    if (err){
      return callback(err);
    }
    async.mapLimit(block.tx, 16, function (tx, cb) {
      self.getTransaction(tx, function (err, transaction) {
        if (block.height === 0) {
          return cb(null, {
            hash: tx,
            vout: [],
            vin: []
          });
        }
        if (err) {
          return cb(err);
        }
        transaction.blockHeight = block.height;
        transaction.blockHash = block.hash;
        cb(err, transaction);
      });
    }, function (err, transactions) {
      callback(err, transactions);
    });
  });
};

Rpc.prototype.getBlockTransactionsByHeight = function(height, callback){
  var self = this;
  self.getBlockByHeight(height, function(err, block){
    if (err){
      return callback(err);
    }
    self.getBlockTransactions(block.hash, callback);
  });
};

module.exports = new Rpc();
