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

      var tx = {"txid":"96d01f44fc7f8c57308aaa3f7327626f1bf7c562cc6a3ec5bca6b8672b60cc9e","version":1,"locktime":0,"vin":[{"txid":"3ac3d5b58c5728f0afc6fd77786f9b44b440e85377df5b67c5742e31809f1d09","vout":0,"sequence":4294967295,"n":0,"scriptSig":{"hex":"483045022100dbfb8a9ad1777594b5d3bea9f993bb7cf11c25c994288758040b9dcb224f3cf702204e2cacfa9c344e8e89e7c7418a0b60eb875ddb81025a0711d6d69f05889e4bfc412103701f4ed2dc0e2065ddadbe9ee633500a7a2422885e16f4f105a8478388d85060","asm":"3045022100dbfb8a9ad1777594b5d3bea9f993bb7cf11c25c994288758040b9dcb224f3cf702204e2cacfa9c344e8e89e7c7418a0b60eb875ddb81025a0711d6d69f05889e4bfc[ALL|FORKID] 03701f4ed2dc0e2065ddadbe9ee633500a7a2422885e16f4f105a8478388d85060"},"addr":"mzfcQeknf9kUnMgL9WVvyc98vWEHQTJrUF","valueSat":32000,"value":0.00032,"doubleSpentTxID":null}],"vout":[{"value":"0.00000000","n":0,"scriptPubKey":{"hex":"6a26060000000002c714e12429463d3bc4b21a11adc2e414b1ac12754b27cb939fe1d9d044704c9b","asm":"OP_RETURN 060000000002c714e12429463d3bc4b21a11adc2e414b1ac12754b27cb939fe1d9d044704c9b"},"spentTxId":null,"spentIndex":null,"spentHeight":null},{"value":"0.00006000","n":1,"scriptPubKey":{"hex":"76a914498399bdf705f37b018e36838559310f16e98a2d88ac","asm":"OP_DUP OP_HASH160 498399bdf705f37b018e36838559310f16e98a2d OP_EQUALVERIFY OP_CHECKSIG","addresses":["mnDfGpmrjg9RQ58UZxmWqDSr4MFLAF9eo7"],"type":"pubkeyhash"},"spentTxId":null,"spentIndex":null,"spentHeight":null},{"value":"0.00023570","n":2,"scriptPubKey":{"hex":"76a9140a518c19a2020691a61b18c8947207bea75066b288ac","asm":"OP_DUP OP_HASH160 0a518c19a2020691a61b18c8947207bea75066b2 OP_EQUALVERIFY OP_CHECKSIG","addresses":["mgTWjyYXsxFv7DUizYWEdESPyX42zSdh7o"],"type":"pubkeyhash"},"spentTxId":null,"spentIndex":null,"spentHeight":null}],"blockheight":-1,"confirmations":0,"time":1547497053,"valueOut":0.0002957,"size":275,"valueIn":0.00032,"fees":0.0000243};
        
    blockchainExplorer.getRawTransaction = function(txid, cb) {
      return cb(null, tx);
    }

    var incoming = {
      txid: '96d01f44fc7f8c57308aaa3f7327626f1bf7c562cc6a3ec5bca6b8672b60cc9e',
      outs: [{}],
    };
    incoming.outs[0] = {};
    incoming.outs[1]={address: 'qr8wc00ajrf80hnczkxwtse380uje7vseqcx2kwpvn', amount: 6000};
    socket.handlers['tx'](incoming);

    setTimeout(function() {
      server.getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        var notification = _.find(notifications, {
          type: 'NewIncomingTx'
        });
        should.exist(notification);
        notification.walletId.should.equal(wallet.id);
        notification.data.txid.should.equal('96d01f44fc7f8c57308aaa3f7327626f1bf7c562cc6a3ec5bca6b8672b60cc9e');
        notification.data.saddress.should.equal('9VQQ80NEX6CALLF0SRMGRSMFVXMKD30354S0UKMFT5C2HJHTDAFTH7WEQYPYRTTWFJ3ES6XUFS3FQDWLZ4LQNF9WR6LDWV38FDNPH4RHU34TCLGPQQ');
        notification.data.address.should.equal('bchtest:qpyc8xda7uzlx7cp3cmg8p2exy83d6v295sg3rldcl');
        notification.data.amount.should.equal(6000);
        done();
      });
    }, 100);
    });
  });
});
  

