'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;

var { WalletService } = require('../../ts_build/lib/server');
var { BlockchainMonitor } = require('../../ts_build/lib/blockchainmonitor');

var helpers = require('./helpers');
var storage, blockchainExplorer;

var socket = {
  handlers: {},
};
socket.on = function(eventName, handler) {
  this.handlers[eventName] = handler;
};

describe('Blockchain monitor', function() {
  var server, wallet;

  before(function(done) {
    log.level = 'warn';
    helpers.before(function(res) {
      storage = res.storage;
      blockchainExplorer = res.blockchainExplorer;
      blockchainExplorer.initSocket = function(callbacks) {
        socket.handlers['coin']= function(data) {
          callbacks.onIncomingPayments(data);
        };
        socket.handlers['block'] =  callbacks.onBlock;
      }
      done();
    });
  });
  after(function(done) {
    helpers.after(done);
  });
  beforeEach(function(done) {
    blockchainExplorer.last = [];
    blockchainExplorer.lastTx = [];
    // TODO
    const collections = {
      WALLETS: 'wallets',
      TXS: 'txs',
      ADDRESSES: 'addresses',
      NOTIFICATIONS: 'notifications',
      COPAYERS_LOOKUP: 'copayers_lookup',
      PREFERENCES: 'preferences',
      EMAIL_QUEUE: 'email_queue',
      CACHE: 'cache',
      FIAT_RATES: 'fiat_rates',
      TX_NOTES: 'tx_notes',
      SESSIONS: 'sessions',
      PUSH_NOTIFICATION_SUBS: 'push_notification_subs',
      TX_CONFIRMATION_SUBS: 'tx_confirmation_subs',
      LOCKS: 'locks'
    };


    async.each(_.values(collections), (x, icb)=> {
      storage.db.collection(x).remove({}, icb);
    }, (err) => {
      should.not.exist(err);
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;

        var bcmonitor = new BlockchainMonitor();
        bcmonitor.start({
          lockOpts: {},
          messageBroker: server.messageBroker,
          storage: storage,
          blockchainExplorers: {
            'btc': {
              'testnet': blockchainExplorer,
              'livenet': blockchainExplorer
            }
          },
        }, function(err) {
          should.not.exist(err);
          done();
        });
      });
    });
  });

  it('should notify copayers of incoming txs', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);

      var incoming = {
        txid: '123',
        out: { 'address': address.address, amount: 1500 },
      };
      socket.handlers['coin'](incoming);

      setTimeout(function() {
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          var notification = _.find(notifications, {
            type: 'NewIncomingTx'
          });
          should.exist(notification);
          notification.walletId.should.equal(wallet.id);
          notification.data.txid.should.equal('123');
          notification.data.address.should.equal(address.address);
          notification.data.amount.should.equal(1500);
          done();
        });
      }, 100);
    });
  });

  it('should not notify copayers of incoming txs more than once', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);

      var incoming = {
        txid: '123',
      };
      incoming.out = {address : address.address, amount: 15000};
      socket.handlers['coin'](incoming);
      setTimeout(function() {
      socket.handlers['coin'](incoming);

      setTimeout(function() {
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          var notification = _.filter(notifications, {
            type: 'NewIncomingTx'
          });

          notification[0].data.amount.should.equal(15000);
          notification.length.should.equal(1);
          done();
        });
      }, 100);
    }, 200);
  });
});


it('should parse v8 amount ', function(done) {
  server.createAddress({}, function(err, address) {
    should.not.exist(err);

    var incoming = {
      txid: '123',
    };
    incoming.out = {address : address.address, amount: 1500};
    socket.handlers['coin'](incoming);
      setTimeout(function() {
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          var notification = _.filter(notifications, {
            type: 'NewIncomingTx'
          });
          notification[0].data.amount.should.equal(1500);
          notification.length.should.equal(1);
          done();
        });
      }, 100);
    });
  });



  it('should notify copayers of tx confirmation', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);

      var incoming = {
        txid: '123',
        vout: [{}],
      };
      incoming.vout[0][address.address] = 1500;

      server.txConfirmationSubscribe({
        txid: '123'
      }, function(err) {
        should.not.exist(err);

        blockchainExplorer.getTxidsInBlock = sinon.stub().callsArgWith(1, null, ['123', '456']);
        socket.handlers['block']('block1');

        setTimeout(function() {
          blockchainExplorer.getTxidsInBlock = sinon.stub().callsArgWith(1, null, ['123', '456']);
          socket.handlers['block']('block2');

          setTimeout(function() {
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var notifications = _.filter(notifications, {
                type: 'TxConfirmation'
              });
              notifications.length.should.equal(1);
              var n = notifications[0];
              n.walletId.should.equal(wallet.id);
              n.creatorId.should.equal(server.copayerId);
              n.data.txid.should.equal('123');
              done();
            });
          }, 50);
        }, 50);
      });
    });
  });
});
