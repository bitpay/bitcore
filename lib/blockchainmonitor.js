'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;

var BlockchainExplorer = require('./blockchainexplorer');
var Storage = require('./storage');
var MessageBroker = require('./messagebroker');

var Notification = require('./model/notification');

var storage, messageBroker;

function BlockchainMonitor() {};

BlockchainMonitor.start = function(opts, cb) {
  opts = opts || {};
  $.checkArgument(opts.blockchainExplorerOpts);
  $.checkArgument(opts.storageOpts);

  async.parallel([

    function(done) {
      _.each(['livenet', 'testnet'], function(network) {
        var config = opts.blockchainExplorerOpts[network] || {};
        BlockchainMonitor._initExplorer(config.provider, network, config.url);
      });
      done();
    },
    function(done) {
      storage = new Storage();
      storage.connect(opts.storageOpts, done);
    },
    function(done) {
      messageBroker = new MessageBroker(opts.messageBrokerOpts);
      done();
    },
  ], cb);

};

BlockchainMonitor._initExplorer = function(provider, network, url) {
  $.checkArgument(provider == 'insight', 'Blockchain monitor ' + provider + ' not supported');

  var explorer = new BlockchainExplorer({
    provider: provider,
    network: network,
    url: url,
  });

  var socket = explorer.initSocket();
  socket.emit('subscribe', 'inv');
  socket.on('tx', BlockchainMonitor._handleIncommingTx);
};

BlockchainMonitor._handleIncommingTx = function(data) {
  if (!data || !data.vout) return;

  var outs = _.compact(_.map(data.vout, function(v) {
    var addr = _.keys(v)[0];
    if (addr.indexOf('3') != 0 && addr.indexOf('2') != 0) return;

    return {
      address: addr,
      amount: +v[addr]
    };
  }));
  if (_.isEmpty(outs)) return;

  async.each(outs, function(out, next) {
    storage.fetchAddress(out.address, function(err, address) {
      if (err || !address) return next(err);
      if (address.isChange) return next();

      var walletId = address.walletId;
      log.info('Incoming tx for wallet ' + walletId + ' (' + out.address + ' -> ' + out.amount + ')');
      BlockchainMonitor._createNotification(walletId, data.txid, out.address, out.amount, next);
    });
  }, function(err) {
    return;
  });
};

BlockchainMonitor._createNotification = function(walletId, txid, address, amount, cb) {
  var n = Notification.create({
    type: 'NewIncomingTx',
    data: {
      txid: txid,
      address: address,
      amount: amount,
    },
    walletId: walletId,
  });
  storage.storeNotification(walletId, n, function() {
    messageBroker.send(n)
    return cb();
  });
};

module.exports = BlockchainMonitor;
