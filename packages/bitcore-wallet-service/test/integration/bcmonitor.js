'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;
log.level = 'info';

var WalletService = require('../../lib/server');
var BlockchainMonitor = require('../../lib/blockchainmonitor');

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
    helpers.before(done);
  });
  after(function(done) {
    helpers.after(done);
  });
  beforeEach(function(done) {
    helpers.beforeEach(function(res) {
      storage = res.storage;
      blockchainExplorer = res.blockchainExplorer;
      blockchainExplorer.initSocket = function(callbacks) {
        socket.handlers['tx']= function(data) {
          callbacks.onTx(data);
          callbacks.onIncomingPayments(data);
        };
        socket.handlers['coin']= function(data) {
          callbacks.onIncomingPayments(data);
        };
 
        socket.handlers['block'] =  callbacks.onBlock;
      }
      blockchainExplorer.getRawTransaction = function(txid, cb) {
        return cb();
      }

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
        vout: [{}],
      };
      incoming.vout[0][address.address] = 1500;
      socket.handlers['tx'](incoming);

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
        outs: [{}],
      };
      incoming.outs[0] = {address : address.address, amount: 0.0001500};
      socket.handlers['tx'](incoming);
      setTimeout(function() {
      socket.handlers['tx'](incoming);

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
      vout: [{}],
    };
    incoming.vout[0][address.address] = 1500;
    socket.handlers['tx'](incoming);
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



describe.only('Stealth address monitor 1-1', function() {
  var server, wallet;

  before(function(done) {
    helpers.before(done);
  });
  after(function(done) {
    helpers.after(done);
  });
  beforeEach(function(done) {
    helpers.beforeEach(function(res) {
      storage = res.storage;
      blockchainExplorer = res.blockchainExplorer;
      blockchainExplorer.initSocket = function(callbacks) {
        socket.handlers['tx']= function(data) {
          callbacks.onTx(data);
          callbacks.onIncomingPayments(data);
        };
        socket.handlers['coin']= function(data) {
          callbacks.onIncomingPayments(data);
        };
 
        socket.handlers['block'] =  callbacks.onBlock;
      }
      blockchainExplorer.getRawTransaction = function(txid, cb) {
        return cb();
      }

      helpers.createAndJoinWallet(1, 1, {coin: 'bch', network: 'testnet'}, function(s, w) {
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


  it.only('should notify copayers of incoming stealth payments', function(done) {
    server.getStealthAddress({}, function(err, address) {
console.log('[bcmonitor.js.202:address:]',address); //TODO
      should.not.exist(err);

      var tx = {"txid":"f0cd44e63dcbfd9bad5ee4f7674f8f15484efd54e493be2bf2a69b5f5ad7d697","version":1,"locktime":0,"vin":[{"txid":"8def0d3e3af6e21258291c0bf8d2925095db7cde17908287535d4675df1934e0","vout":2,"sequence":4294967295,"n":0,"scriptSig":{"hex":"473044022073c4f4b3d9ae7d76328a5d6a113f5f5b587d8e566bfd9a27d6effdedfb808a890220258f9197858b72c08200f2c7a08d37e9d780e90620e4360b8275861be4de87534121023141f3b549e1693f566a63621c766a3981ca21809f3daa2542dd86a438783da2","asm":"3044022073c4f4b3d9ae7d76328a5d6a113f5f5b587d8e566bfd9a27d6effdedfb808a890220258f9197858b72c08200f2c7a08d37e9d780e90620e4360b8275861be4de8753[ALL|FORKID] 023141f3b549e1693f566a63621c766a3981ca21809f3daa2542dd86a438783da2"},"addr":"mpBhFmG4SMfmqszf2B4b8fXwt2uQB42hPJ","valueSat":19139,"value":0.00019139,"doubleSpentTxID":null}],"vout":[{"value":"0.00000000","n":0,"scriptPubKey":{"hex":"6a26060000000003155abd9a87eaf193feffb0d57eb58985b34c4dc583451d1647e7afbef62187ee","asm":"OP_RETURN 060000000003155abd9a87eaf193feffb0d57eb58985b34c4dc583451d1647e7afbef62187ee"},"spentTxId":null,"spentIndex":null,"spentHeight":null},{"value":"0.00006000","n":1,"scriptPubKey":{"hex":"76a914ceec3dfd90d277de78158ce5c3313bf92cf990c888ac","asm":"OP_DUP OP_HASH160 ceec3dfd90d277de78158ce5c3313bf92cf990c8 OP_EQUALVERIFY OP_CHECKSIG","addresses":["mzP4VxqKqoAtfvByspKPEj4FEJFPRtJiur"],"type":"pubkeyhash"},"spentTxId":null,"spentIndex":null,"spentHeight":null},{"value":"0.00010709","n":2,"scriptPubKey":{"hex":"76a914063b39967ca0cc7757f1100b11ddd224221a943288ac","asm":"OP_DUP OP_HASH160 063b39967ca0cc7757f1100b11ddd224221a9432 OP_EQUALVERIFY OP_CHECKSIG","addresses":["mg5uJE7MgmQd9oMEdnawKM5iAk9ixaY99V"],"type":"pubkeyhash"},"spentTxId":null,"spentIndex":null,"spentHeight":null}],"blockhash":"00000000659671d70587225411df4c8c3bc8c1c33dd1fd81d6454dba4f84c23e","blockheight":1279853,"confirmations":31,"time":1547479248,"blocktime":1547479248,"valueOut":0.00016709,"size":274,"valueIn":0.00019139,"fees":0.0000243};
        
    blockchainExplorer.getRawTransaction = function(txid, cb) {
      return cb(null, tx);
    }

    var incoming = {
      txid: 'f0cd44e63dcbfd9bad5ee4f7674f8f15484efd54e493be2bf2a69b5f5ad7d697',
      outs: [{}],
    };
    incoming.outs[0] = {};
    incoming.outs[1]={address: 'mjdasrvw44ZgjxtJJvT5U9wdCFEsSVLvxG', amount: 6000};
    socket.handlers['tx'](incoming);

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
});
  

