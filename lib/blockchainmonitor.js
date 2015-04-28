'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;

var BlockchainExplorer = require('./blockchainexplorer');
var Storage = require('./storage');
var MessageBroker = require('./messagebroker');

<<<<<<< HEAD
var Notification = require('./model/notification');

function BlockchainMonitor() {};

BlockchainMonitor.prototype.start = function(opts, cb) {
=======
function BlockchainMonitor(opts) {
>>>>>>> refactor notification dispatching
  opts = opts || {};
  $.checkArgument(opts.blockchainExplorerOpts);
  $.checkArgument(opts.storageOpts);

  var self = this;

  async.parallel([

    function(done) {
      self.explorers = _.map(['livenet', 'testnet'], function(network) {
        var config = opts.blockchainExplorerOpts[network] || {};
        return self._initExplorer(config.provider, network, config.url);
      });
      done();
    },
    function(done) {
      self.storage = new Storage();
      self.storage.connect(opts.storageOpts, done);
    },
    function(done) {
      self.messageBroker = new MessageBroker(opts.messageBrokerOpts);
      done();
    },
  ], cb);

};

BlockchainMonitor.prototype._initExplorer = function(provider, network, url) {
  $.checkArgument(provider == 'insight', 'Blockchain monitor ' + provider + ' not supported');

  var self = this;

  var explorer = new BlockchainExplorer({
    provider: provider,
    network: network,
    url: url,
  });

  var socket = explorer.initSocket();

  var connectionInfo = provider + ' (' + network + ') @ ' + url;
  socket.on('connect', function() {
    log.info('Connected to ' + connectionInfo);
    socket.emit('subscribe', 'inv');
  });
  socket.on('connect_error', function() {
    log.error('Error connecting to ' + connectionInfo);
  });
  socket.on('tx', _.bind(self._handleIncommingTx, self));

<<<<<<< HEAD
  return explorer;
};
=======
BlockchainMonitor.prototype.subscribeAddresses = function(walletService, addresses) {
  $.checkArgument(walletService);
  $.checkArgument(walletService.walletId);
>>>>>>> refactor notification dispatching

BlockchainMonitor.prototype._handleIncommingTx = function(data) {
  var self = this;
  var walletId = walletService.walletId;

  if (!data || !data.vout) return;

<<<<<<< HEAD
  var outs = _.compact(_.map(data.vout, function(v) {
    var addr = _.keys(v)[0];
    var startingChar = addr.charAt(0);
    if (startingChar != '2' && startingChar != '3') return;
=======
  function handlerFor(address, txid) {
    var data = {
      walletId: this.walletId,
      address: address,
      txid: txid,
    };
    self.emit('NewIncomingTx', data, this);
  };
>>>>>>> refactor notification dispatching

    return {
      address: addr,
      amount: +v[addr]
    };
<<<<<<< HEAD
  }));
  if (_.isEmpty(outs)) return;

  async.each(outs, function(out, next) {
    self.storage.fetchAddress(out.address, function(err, address) {
      if (err) {
        log.error('Could not fetch addresses from the db');
        return next(err);
      }
      if (!address || address.isChange) return next();

      var walletId = address.walletId;
      log.info('Incoming tx for wallet ' + walletId + ' [' + out.amount + 'sat -> ' + out.address + ']');
      self._createNotification(walletId, data.txid, out.address, out.amount, next);
    });
  }, function(err) {
    return;
=======
  };

  var addresses = [].concat(addresses);
  var network = Bitcore.Address.fromString(addresses[0]).network.name;
  var subscriber = self.subscriber[network];
  _.each(addresses, function(address) {
    self.subscriptions[walletId].addresses.push(address);
    subscriber.subscribe(address, _.bind(handlerFor, walletService, address));
>>>>>>> refactor notification dispatching
  });
};

BlockchainMonitor.prototype._createNotification = function(walletId, txid, address, amount, cb) {
  var self = this;

<<<<<<< HEAD
  var n = Notification.create({
    type: 'NewIncomingTx',
    data: {
      txid: txid,
      address: address,
      amount: amount,
    },
    walletId: walletId,
  });
  self.storage.storeNotification(walletId, n, function() {
    self.messageBroker.send(n)
=======
  var walletId = walletService.walletId;
  if (self.subscriptions[walletId]) return;

  walletService.getMainAddresses({}, function(err, addresses) {
    if (err) {
      delete self.subscriptions[walletId];
      return cb(new Error('Could not subscribe to addresses for wallet ' + walletId));
    }
    self.subscribeAddresses(walletService, _.pluck(addresses, 'address'));
>>>>>>> refactor notification dispatching
    return cb();
  });
};

module.exports = BlockchainMonitor;
