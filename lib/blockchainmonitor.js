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
var BlockExplorer = require('./blockexplorer');

var Notification = require('./model/notification');

function BlockchainMonitor() {
  this.subscriptions = {};
  this.sockets = {};

  this._initBlockExplorerSocket('insight', 'livenet');
  this._initBlockExplorerSocket('insight', 'testnet');
};

nodeutil.inherits(BlockchainMonitor, events.EventEmitter);

BlockchainMonitor.prototype._initBlockExplorerSocket = function(provider, network) {
  var explorer = new BlockExplorer({
    provider: provider,
    network: network,
  });

  this.sockets[network] = explorer.initSocket();
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
  var socket = self.sockets[network];
  _.each(addresses, function(address) {
    self.subscriptions[walletId].addresses.push(address);
    socket.emit('subscribe', address);
    socket.on(address, _.bind(handlerFor, walletId, address));
  });
};

BlockchainMonitor.prototype.subscribeWallet = function(walletService) {
  var self = this;

  var walletId = walletService.walletId;
  if (self.subscriptions[walletId]) return;

  walletService.getMainAddresses({}, function(err, addresses) {
    if (err) {
      delete self.subscriptions[walletId];
      log.warn('Could not subscribe to addresses for wallet ' + walletId);
      return;
    }
    self.subscribeAddresses(walletService.walletId, _.pluck(addresses, 'address'));
  });
};


module.exports = BlockchainMonitor;
