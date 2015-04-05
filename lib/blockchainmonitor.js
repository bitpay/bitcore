'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var Uuid = require('uuid');
var inherits = require('inherits');
var events = require('events');
var nodeutil = require('util');

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var WalletService = require('./server');
var BlockchainExplorer = require('./blockchainexplorer');

var Notification = require('./model/notification');

function BlockchainMonitor(opts) {
  opts = opts || {};
  var self = this;
  this.subscriptions = {};
  this.subscriber = {};
  _.each(['livenet', 'testnet'], function(network) {
    opts[network] = opts[network] || {};
    self.subscriber[network] = self._getAddressSubscriber(
      opts[network].name, network, opts[network].url);
  });
};

nodeutil.inherits(BlockchainMonitor, events.EventEmitter);

BlockchainMonitor.prototype._getAddressSubscriber = function(provider, network) {
  $.checkArgument(provider == 'insight', 'Blockchain monitor ' + provider + ' not supported');

  var explorer = new BlockchainExplorer({
    provider: provider,
    network: network,
  });

  var socket = explorer.initSocket();

  // TODO: Extract on its own class once more providers are implemented
  return {
    subscribe: function(address, handler) {
      socket.emit('subscribe', address);
      socket.on(address, handler);
    },
  };
};

BlockchainMonitor.prototype.subscribeAddresses = function(walletId, addresses) {
  $.checkArgument(walletId);

  var self = this;

  if (!addresses || addresses.length == 0) return;

  function handlerFor(address, txid) {
    var notification = Notification.create({
      walletId: this,
      type: 'NewIncomingTx',
      data: {
        address: address,
        txid: txid,
      },
    });
    self.emit('notification', notification);
  };

  if (!self.subscriptions[walletId]) {
    self.subscriptions[walletId] = {
      addresses: [],
    };
  };

  var addresses = [].concat(addresses);
  var network = Bitcore.Address.fromString(addresses[0]).network.name;
  var subscriber = self.subscriber[network];
  _.each(addresses, function(address) {
    self.subscriptions[walletId].addresses.push(address);
    subscriber.subscribe(address, _.bind(handlerFor, walletId, address));
  });
};

BlockchainMonitor.prototype.subscribeWallet = function(walletService, cb) {
  var self = this;

  var walletId = walletService.walletId;
  if (self.subscriptions[walletId]) return;

  walletService.getMainAddresses({}, function(err, addresses) {
    if (err) {
      delete self.subscriptions[walletId];
      return cb(new Error('Could not subscribe to addresses for wallet ' + walletId));
    }
    self.subscribeAddresses(walletService.walletId, _.pluck(addresses, 'address'));
    return cb();
  });
};


module.exports = BlockchainMonitor;
