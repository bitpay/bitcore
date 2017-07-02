'use strict';
var request = require('request');

var Rpc = function(){

};

Rpc.prototype.callMethod = function(method, params, callback){
  request({
    method: 'POST',
    url: 'http://bitcoin:local321@127.0.0.1:8332',
    body: {
      jsonrpc: '1.0',
      id: Date.now(),
      method: method,
      params: params
    },
    json: true
  }, function(err, res, body){
    callback(err || (body && body.error), body && body.result);
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

module.exports = new Rpc();
