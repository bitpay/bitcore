var request = require('request');

var Rpc = function(username, password, host, port) {
  this.username = username;
  this.password = password;
  this.host = host;
  this.port = port;
};

Rpc.prototype.callMethod = function(method, params, callback) {
  request({
    method: 'POST',
    url: `http://${this.username}:${this.password}@${this.host}:${this.port}`,
    body: {
      jsonrpc: '1.0',
      id: Date.now(),
      method: method,
      params: params
    },
    json: true
  }, function(err, res, body) {
    if(err) {
      return callback(err);
    }
    if(body && body.error) {
      return callback(body.error);
    }
    callback(null, body && body.result);
  });
};

Rpc.prototype.getChainTip = function(callback) {
  this.callMethod('getchaintips', [], function(err, result) {
    if(err) {
      return callback(err);
    }
    callback(null, result[0]);
  });
};

Rpc.prototype.getBestBlockHash = function(callback) {
  this.callMethod('getbestblockhash', [], callback);
};

Rpc.prototype.getBlockHeight = function(callback) {
  this.callMethod('getblockcount', [], callback);
};

Rpc.prototype.getBlock = function(hash, verbose, callback) {
  this.callMethod('getblock', [hash, verbose], callback);
};

Rpc.prototype.getBlockHash = function(height, callback) {
  this.callMethod('getblockhash', [height], callback);
};

Rpc.prototype.getBlockByHeight = function(height, callback) {
  var self = this;
  self.getBlockHash(height, function(err, hash) {
    if(err) {
      return callback(err);
    }
    self.getBlock(hash, false, callback);
  });
};

Rpc.prototype.getTransaction = function(txid, callback) {
  var self = this;
  self.callMethod('getrawtransaction', [txid, true], function(err, result) {
    if(err) {
      return callback(err);
    }
    callback(null, result);
  });
};

Rpc.prototype.sendTransaction = function(rawTx, callback) {
  var self = this;
  self.callMethod('sendrawtransaction', [rawTx], callback);
};


Rpc.prototype.decodeScript = function(hex, callback) {
  this.callMethod('decodescript', [hex], callback);
};

Rpc.prototype.getWalletAddresses = function(account, callback) {
  this.callMethod('getaddressesbyaccount', [account], callback);
};

module.exports = Rpc;
