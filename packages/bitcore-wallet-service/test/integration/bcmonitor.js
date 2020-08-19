'use strict'; 
var _ = require('lodash');
var async = require('async');

const CWC = require('crypto-wallet-core');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();

var { WalletService } = require('../../ts_build/lib/server');
var { BlockchainMonitor } = require('../../ts_build/lib/blockchainmonitor');

var helpers = require('./helpers');
var storage, blockchainExplorer, blockchainExplorerETH;

var socket = {
  handlers: {},
};
socket.on = function(eventName, handler) {
  this.handlers[eventName] = handler;
};

describe('Blockchain monitor', function() {
  this.timeout(5000);
  var server, wallet;

  before(function(done) {
    helpers.before(function(res) {
      storage = res.storage;
      blockchainExplorer = res.blockchainExplorer;
      blockchainExplorerETH =  _.cloneDeep(blockchainExplorer);


      blockchainExplorer.initSocket = function(callbacks) {
        socket.handlers['coin']= function(data) {
          callbacks.onIncomingPayments(data);
        };
        socket.handlers['block'] =  callbacks.onBlock;
      }

      blockchainExplorerETH.initSocket = function(callbacks) {
       socket.handlers['tx']= function(data) {

          // copied from v8.tx
          const tx = data.tx;
          // script output, or similar.
          if (!tx || tx.chain !== 'ETH') return;
          let tokenAddress;
          let address;
          let amount;

          if (tx.abiType && tx.abiType.type === 'ERC20') {
            tokenAddress = tx.to;
            address = CWC.Web3.utils.toChecksumAddress(tx.abiType.params[0].value);
            amount = tx.abiType.params[1].value;
          } else {
            address = tx.to;
            amount = tx.value;
          }
          const out = {
            address,
            amount,
            tokenAddress
          };
          return callbacks.onIncomingPayments({ out, txid: tx.txid });
        };
        // no uses in eth, interferes with btc
        //socket.handlers['block'] =  callbacks.onBlock;
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
      storage.db.collection(x).deleteMany({}, icb);
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
              'livenet': blockchainExplorer
            },
            'eth': {
              'livenet': blockchainExplorerETH
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


  it('should not notify copayers of incoming txs btc, amount =0', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);

      var incoming = {
        txid: '123',
        out: { 'address': address.address, amount: 0 },
      };
      socket.handlers['coin'](incoming);

      setTimeout(function() {
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          var notification = _.find(notifications, {
            type: 'NewIncomingTx'
          });
          should.not.exist(notification);
          done();
        });
      }, 100);
    });
  });

  it('should notify copayers of incoming txs ETH, amount =0', function(done) {
    helpers.createAndJoinWallet(1, 1, {coin: 'eth'}, function(s, w) {
      s.createAddress({}, function(err, address) {
        should.not.exist(err);

        var incoming = {
          tx: {
            chain: 'ETH',
            network: 'mainnet',
            to:  address.address, 
            value: 0,
            txid: '123',
          },
        };
        socket.handlers['tx'](incoming);

        setTimeout(function() {
          s.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notification = _.find(notifications, {
              type: 'NewIncomingTx'
            });
          should.exist(notification);
          notification.data.txid.should.equal('123');
          notification.data.address.should.equal(address.address);
          notification.data.amount.should.equal(0);
            done();
          });
        }, 100);
      });
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

  it('should not notify copayers of incoming txs more than once', function(done) {
    helpers.createAndJoinWallet(1, 1, {coin:'eth'}, function(s, w) {
      s.createAddress({}, function(err, address) {
        should.not.exist(err);
        var incoming = {tx: {
          chain: 'ETH',
          network: 'mainnet',
          blockHeight: -1,
          blockHash: null,
          data: 'MHhhOTA1OWNiYjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDk4MmZhMTBhZDliOTc1NzQ5YzhmY2UxM2YyMmQ3ZWNlNGVhMjM5MjEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMTU1Y2Mw',
          txid: '0x2fb6db15ac76eea2118e04b5a93036eb75c3ea56652bf99bcb9798ae77019378',
          blockTime: '2019-12-04T19:19:25.504Z',
          blockTimeNormalized: '2019-12-04T19:19:25.504Z',
          fee: 198995000000000,
          transactionIndex: 0,
          value: 0,
          wallets: ['5d8b6c452522995f80c27bf5', '5d924a407eca6e5f89d2be5c'],
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          from: '0xC877cBCF020A8AA259A1Efab1559B2A3A7259086',
          gasLimit: 39799,
          gasPrice: 5000000000,
          nonce: 52,
          internal: [],
          abiType: { type: 'ERC20', name: 'transfer', params: [
            {value:  address.address},
            {value: 1e10},
          ] }
        }};
        socket.handlers['tx'](incoming);
        socket.handlers['tx'](incoming);
        setTimeout(function() {
          s.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notification = _.filter(notifications, {
              type: 'NewIncomingTx'
            });
            notification[0].data.amount.should.equal(1e10);
            notification.length.should.equal(1);
            done();
          });
        }, 100);
      });
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
