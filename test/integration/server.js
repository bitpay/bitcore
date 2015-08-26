'use strict';

var _ = require('lodash');
var async = require('async');
var inspect = require('util').inspect;

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;

var fs = require('fs');
var tingodb = require('tingodb')({
  memStore: true
});

var Utils = require('../../lib/utils');
var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var Storage = require('../../lib/storage');

var Model = require('../../lib/model');

var WalletService = require('../../lib/server');
var EmailService = require('../../lib/emailservice');

var TestData = require('../testdata');
var CLIENT_VERSION = 'bwc-0.1.1';

var helpers = {};
helpers.getAuthServer = function(copayerId, cb) {
  var verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
  verifyStub.returns(true);
  WalletService.getInstanceWithAuth({
    copayerId: copayerId,
    message: 'dummy',
    signature: 'dummy',
    clientVersion: 'bwc-0.1.0',
  }, function(err, server) {
    verifyStub.restore();
    if (err || !server) throw new Error('Could not login as copayerId ' + copayerId);
    return cb(server);
  });
};

helpers._generateCopayersTestData = function(n) {
  console.log('var copayers = [');
  _.each(_.range(n), function(c) {
    var xpriv = new Bitcore.HDPrivateKey();
    var xpub = Bitcore.HDPublicKey(xpriv);

    var xpriv_45H = xpriv.derive(45, true);
    var xpub_45H = Bitcore.HDPublicKey(xpriv_45H);
    var id = WalletUtils.xPubToCopayerId(xpub_45H.toString());

    var xpriv_1H = xpriv.derive(1, true);
    var xpub_1H = Bitcore.HDPublicKey(xpriv_1H);
    var priv = xpriv_1H.derive(0).privateKey;
    var pub = xpub_1H.derive(0).publicKey;

    console.log('{id: ', "'" + id + "',");
    console.log('xPrivKey: ', "'" + xpriv.toString() + "',");
    console.log('xPubKey: ', "'" + xpub.toString() + "',");
    console.log('xPrivKey_45H: ', "'" + xpriv_45H.toString() + "',");
    console.log('xPubKey_45H: ', "'" + xpub_45H.toString() + "',");
    console.log('xPrivKey_1H: ', "'" + xpriv_1H.toString() + "',");
    console.log('xPubKey_1H: ', "'" + xpub_1H.toString() + "',");
    console.log('privKey_1H_0: ', "'" + priv.toString() + "',");
    console.log('pubKey_1H_0: ', "'" + pub.toString() + "'},");
  });
  console.log('];');
};

helpers.getSignedCopayerOpts = function(opts) {
  var hash = WalletUtils.getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
  opts.copayerSignature = WalletUtils.signMessage(hash, TestData.keyPair.priv);
  return opts;
};

helpers.createAndJoinWallet = function(m, n, opts, cb) {
  if (_.isFunction(opts)) {
    cb = opts;
    opts = {};
  }
  opts = opts || {};

  var server = new WalletService();
  var copayerIds = [];
  var offset = opts.offset || 0;

  var walletOpts = {
    name: 'a wallet',
    m: m,
    n: n,
    pubKey: TestData.keyPair.pub,
  };
  server.createWallet(walletOpts, function(err, walletId) {
    if (err) return cb(err);

    async.each(_.range(n), function(i, cb) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'copayer ' + (i + 1),
        xPubKey: TestData.copayers[i + offset].xPubKey_45H,
        requestPubKey: TestData.copayers[i + offset].pubKey_1H_0,
        customData: 'custom data ' + (i + 1),
      });

      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);
        copayerIds.push(result.copayerId);
        return cb(err);
      });
    }, function(err) {
      if (err) return new Error('Could not generate wallet');
      helpers.getAuthServer(copayerIds[0], function(s) {
        s.getWallet({}, function(err, w) {
          cb(s, w);
        });
      });
    });
  });
};

helpers.randomTXID = function() {
  return Bitcore.crypto.Hash.sha256(new Buffer(Math.random() * 100000)).toString('hex');;
};


helpers.toSatoshi = function(btc) {
  if (_.isArray(btc)) {
    return _.map(btc, helpers.toSatoshi);
  } else {
    return Utils.strip(btc * 1e8);
  }
};

helpers.stubUtxos = function(server, wallet, amounts, cb) {
  async.mapSeries(_.range(0, amounts.length > 2 ? 2 : 1), function(i, next) {
    server.createAddress({}, next);
  }, function(err, addresses) {
    should.not.exist(err);
    addresses.should.not.be.empty;
    var utxos = _.map([].concat(amounts), function(amount, i) {
      var address = addresses[i % addresses.length];
      var confirmations;
      if (_.isString(amount) && _.startsWith(amount, 'u')) {
        amount = parseFloat(amount.substring(1));
        confirmations = 0;
      } else {
        confirmations = Math.floor(Math.random() * 100 + 1);
      }
      return {
        txid: helpers.randomTXID(),
        vout: Math.floor(Math.random() * 10 + 1),
        satoshis: helpers.toSatoshi(amount).toString(),
        scriptPubKey: address.getScriptPubKey(wallet.m).toBuffer().toString('hex'),
        address: address.address,
        confirmations: confirmations,
      };
    });
    blockchainExplorer.getUnspentUtxos = function(addresses, cb) {
      var selected = _.filter(utxos, function(utxo) {
        return _.contains(addresses, utxo.address);
      });
      return cb(null, selected);
    };

    return cb(utxos);
  });
};

helpers.stubBroadcast = function(txid) {
  blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, null, txid);
};

helpers.stubHistory = function(txs) {
  blockchainExplorer.getTransactions = function(addresses, from, to, cb) {
    var MAX_BATCH_SIZE = 100;
    var nbTxs = txs.length;

    if (_.isUndefined(from) && _.isUndefined(to)) {
      from = 0;
      to = MAX_BATCH_SIZE;
    }
    if (!_.isUndefined(from) && _.isUndefined(to))
      to = from + MAX_BATCH_SIZE;

    if (!_.isUndefined(from) && !_.isUndefined(to) && to - from > MAX_BATCH_SIZE)
      to = from + MAX_BATCH_SIZE;

    if (from < 0) from = 0;
    if (to < 0) to = 0;
    if (from > nbTxs) from = nbTxs;
    if (to > nbTxs) to = nbTxs;

    var page = txs.slice(from, to);
    return cb(null, page);
  };
};

helpers.stubFeeLevels = function(levels) {
  blockchainExplorer.estimateFee = function(nbBlocks, cb) {
    var result = _.zipObject(_.map(_.pick(levels, nbBlocks), function(fee, n) {
      return [+n, fee > 0 ? fee / 1e8 : fee];
    }));
    return cb(null, result);
  };
};

helpers.stubAddressActivity = function(activeAddresses) {
  blockchainExplorer.getAddressActivity = function(addresses, cb) {
    return cb(null, _.intersection(activeAddresses, addresses).length > 0);
  };
};

helpers.clientSign = WalletUtils.signTxp;

helpers.createProposalOptsLegacy = function(toAddress, amount, message, signingKey, feePerKb) {
  var opts = {
    toAddress: toAddress,
    amount: helpers.toSatoshi(amount),
    message: message,
    proposalSignature: null,
  };
  if (feePerKb) opts.feePerKb = feePerKb;

  var hash = WalletUtils.getProposalHash(toAddress, opts.amount, message);

  try {
    opts.proposalSignature = WalletUtils.signMessage(hash, signingKey);
  } catch (ex) {}

  return opts;
};

helpers.createSimpleProposalOpts = function(toAddress, amount, message, signingKey, feePerKb) {
  var outputs = [{
    toAddress: toAddress,
    amount: amount,
  }];
  return helpers.createProposalOpts(Model.TxProposal.Types.SIMPLE, outputs, message, signingKey, feePerKb);
};

helpers.createProposalOpts = function(type, outputs, message, signingKey, feePerKb) {
  _.each(outputs, function(output) {
    output.amount = helpers.toSatoshi(output.amount);
  });
  var opts = {
    type: type,
    message: message,
    proposalSignature: null,
  };
  if (feePerKb) opts.feePerKb = feePerKb;

  var hash;
  if (type == Model.TxProposal.Types.SIMPLE) {
    opts.toAddress = outputs[0].toAddress;
    opts.amount = outputs[0].amount;
    hash = WalletUtils.getProposalHash(opts.toAddress, opts.amount,
      opts.message, opts.payProUrl);
  } else if (type == Model.TxProposal.Types.MULTIPLEOUTPUTS) {
    opts.outputs = outputs;
    var header = {
      outputs: outputs,
      message: opts.message,
      payProUrl: opts.payProUrl
    };
    hash = WalletUtils.getProposalHash(header);
  }

  try {
    opts.proposalSignature = WalletUtils.signMessage(hash, signingKey);
  } catch (ex) {}

  return opts;
};

helpers.createAddresses = function(server, wallet, main, change, cb) {
  async.map(_.range(main + change), function(i, next) {
    var address = wallet.createAddress(i >= main);
    server.storage.storeAddressAndWallet(wallet, address, function(err) {
      if (err) return next(err);
      next(null, address);
    });
  }, function(err, addresses) {
    if (err) throw new Error('Could not generate addresses');
    return cb(_.take(addresses, main), _.takeRight(addresses, change));
  });
};

var storage, blockchainExplorer;

var useMongoDb = !!process.env.USE_MONGO_DB;

function initStorage(cb) {
  function getDb(cb) {
    if (useMongoDb) {
      var mongodb = require('mongodb');
      mongodb.MongoClient.connect('mongodb://localhost:27017/bws_test', function(err, db) {
        if (err) throw err;
        return cb(db);
      });
    } else {
      var db = new tingodb.Db('./db/test', {});
      return cb(db);
    }
  }
  getDb(function(db) {
    storage = new Storage({
      db: db
    });
    return cb();
  });
};

function resetStorage(cb) {
  if (!storage.db) return cb();
  storage.db.dropDatabase(function(err) {
    return cb();
  });
};


describe('Wallet service', function() {
  before(function(done) {
    initStorage(done);
  });
  beforeEach(function(done) {
    resetStorage(function() {
      blockchainExplorer = sinon.stub();
      WalletService.initialize({
        storage: storage,
        blockchainExplorer: blockchainExplorer,
      }, done);
    });
  });
  after(function(done) {
    WalletService.shutDown(done);
  });

  describe('Email notifications', function() {
    var server, wallet, mailerStub, emailService;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;

        var i = 0;
        async.eachSeries(w.copayers, function(copayer, next) {
          helpers.getAuthServer(copayer.id, function(server) {
            server.savePreferences({
              email: 'copayer' + (++i) + '@domain.com',
              unit: 'bit',
            }, next);
          });
        }, function(err) {
          should.not.exist(err);

          mailerStub = sinon.stub();
          mailerStub.sendMail = sinon.stub();
          mailerStub.sendMail.yields();

          emailService = new EmailService();
          emailService.start({
            lockOpts: {},
            messageBroker: server.messageBroker,
            storage: storage,
            mailer: mailerStub,
            emailOpts: {
              from: 'bws@dummy.net',
              subjectPrefix: '[test wallet]',
              publicTxUrlTemplate: {
                livenet: 'https://insight.bitpay.com/tx/{{txid}}',
                testnet: 'https://test-insight.bitpay.com/tx/{{txid}}',
              },
            },
          }, function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should notify copayers a new tx proposal has been created', function(done) {
      var _readTemplateFile_old = emailService._readTemplateFile;
      emailService._readTemplateFile = function(language, filename, cb) {
        if (_.endsWith(filename, '.html')) {
          return cb(null, '<html><body>{{walletName}}</body></html>');
        } else {
          _readTemplateFile_old.call(emailService, language, filename, cb);
        }
      };
      helpers.stubUtxos(server, wallet, [1, 1], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          setTimeout(function() {
            var calls = mailerStub.sendMail.getCalls();
            calls.length.should.equal(2);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer2@domain.com', 'copayer3@domain.com'], _.pluck(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment proposal');
            one.text.should.contain(wallet.name);
            one.text.should.contain(wallet.copayers[0].name);
            should.exist(one.html);
            one.html.indexOf('<html>').should.equal(0);
            one.html.should.contain(wallet.name);
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              emailService._readTemplateFile = _readTemplateFile_old;
              done();
            });
          }, 100);
        });
      });
    });

    it('should not send email if unable to apply template to notification', function(done) {
      var _applyTemplate_old = emailService._applyTemplate;
      emailService._applyTemplate = function(template, data, cb) {
        _applyTemplate_old.call(emailService, template, undefined, cb);
      };
      helpers.stubUtxos(server, wallet, [1, 1], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          setTimeout(function() {
            var calls = mailerStub.sendMail.getCalls();
            calls.length.should.equal(0);
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              emailService._applyTemplate = _applyTemplate_old;
              done();
            });
          }, 100);
        });
      });
    });

    it('should notify copayers a new outgoing tx has been created', function(done) {
      var _readTemplateFile_old = emailService._readTemplateFile;
      emailService._readTemplateFile = function(language, filename, cb) {
        if (_.endsWith(filename, '.html')) {
          return cb(null, '<html>{{&urlForTx}}<html>');
        } else {
          _readTemplateFile_old.call(emailService, language, filename, cb);
        }
      };
      helpers.stubUtxos(server, wallet, [1, 1], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, 'some message', TestData.copayers[0].privKey_1H_0);

        var txpId;
        async.waterfall([

          function(next) {
            server.createTx(txOpts, next);
          },
          function(txp, next) {
            txpId = txp.id;
            async.eachSeries(_.range(2), function(i, next) {
              var copayer = TestData.copayers[i];
              helpers.getAuthServer(copayer.id, function(server) {
                var signatures = helpers.clientSign(txp, copayer.xPrivKey);
                server.signTx({
                  txProposalId: txp.id,
                  signatures: signatures,
                }, next);
              });
            }, next);
          },
          function(next) {
            helpers.stubBroadcast('999');
            server.broadcastTx({
              txProposalId: txpId,
            }, next);
          },
        ], function(err) {
          should.not.exist(err);

          setTimeout(function() {
            var calls = mailerStub.sendMail.getCalls();
            var emails = _.map(_.takeRight(calls, 3), function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], _.pluck(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('Payment sent');
            one.text.should.contain(wallet.name);
            one.text.should.contain('800,000');
            should.exist(one.html);
            one.html.should.contain('https://insight.bitpay.com/tx/999');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              emailService._readTemplateFile = _readTemplateFile_old;
              done();
            });
          }, 100);
        });
      });
    });

    it('should notify copayers a tx has been finally rejected', function(done) {
      helpers.stubUtxos(server, wallet, 1, function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, 'some message', TestData.copayers[0].privKey_1H_0);

        var txpId;
        async.waterfall([

          function(next) {
            server.createTx(txOpts, next);
          },
          function(txp, next) {
            txpId = txp.id;
            async.eachSeries(_.range(1, 3), function(i, next) {
              var copayer = TestData.copayers[i];
              helpers.getAuthServer(copayer.id, function(server) {
                server.rejectTx({
                  txProposalId: txp.id,
                }, next);
              });
            }, next);
          },
        ], function(err) {
          should.not.exist(err);

          setTimeout(function() {
            var calls = mailerStub.sendMail.getCalls();
            var emails = _.map(_.takeRight(calls, 2), function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com'], _.pluck(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('Payment proposal rejected');
            one.text.should.contain(wallet.name);
            one.text.should.contain('copayer 2, copayer 3');
            one.text.should.not.contain('copayer 1');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              done();
            });
          }, 100);
        });
      });
    });

    it('should notify copayers of incoming txs', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, function(err) {
          setTimeout(function() {
            var calls = mailerStub.sendMail.getCalls();
            calls.length.should.equal(3);
            var emails = _.map(calls, function(c) {
              return c.args[0];
            });
            _.difference(['copayer1@domain.com', 'copayer2@domain.com', 'copayer3@domain.com'], _.pluck(emails, 'to')).should.be.empty;
            var one = emails[0];
            one.from.should.equal('bws@dummy.net');
            one.subject.should.contain('New payment received');
            one.text.should.contain(wallet.name);
            one.text.should.contain('123,000');
            server.storage.fetchUnsentEmails(function(err, unsent) {
              should.not.exist(err);
              unsent.should.be.empty;
              done();
            });
          }, 100);
        });
      });
    });

    it('should notify each email address only once', function(done) {
      // Set same email address for copayer1 and copayer2
      server.savePreferences({
        email: 'copayer2@domain.com',
      }, function(err) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, function(err) {
            setTimeout(function() {
              var calls = mailerStub.sendMail.getCalls();
              calls.length.should.equal(2);
              var emails = _.map(calls, function(c) {
                return c.args[0];
              });
              _.difference(['copayer2@domain.com', 'copayer3@domain.com'], _.pluck(emails, 'to')).should.be.empty;
              var one = emails[0];
              one.from.should.equal('bws@dummy.net');
              one.subject.should.contain('New payment received');
              one.text.should.contain(wallet.name);
              one.text.should.contain('123,000');
              server.storage.fetchUnsentEmails(function(err, unsent) {
                should.not.exist(err);
                unsent.should.be.empty;
                done();
              });
            }, 100);
          });
        });
      });
    });

    it('should build each email using preferences of the copayers', function(done) {
      // Set same email address for copayer1 and copayer2
      server.savePreferences({
        email: 'copayer1@domain.com',
        language: 'es',
        unit: 'btc',
      }, function(err) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, function(err) {
            setTimeout(function() {
              var calls = mailerStub.sendMail.getCalls();
              calls.length.should.equal(3);
              var emails = _.map(calls, function(c) {
                return c.args[0];
              });
              var spanish = _.find(emails, {
                to: 'copayer1@domain.com'
              });
              spanish.from.should.equal('bws@dummy.net');
              spanish.subject.should.contain('Nuevo pago recibido');
              spanish.text.should.contain(wallet.name);
              spanish.text.should.contain('0.123 BTC');
              var english = _.find(emails, {
                to: 'copayer2@domain.com'
              });
              english.from.should.equal('bws@dummy.net');
              english.subject.should.contain('New payment received');
              english.text.should.contain(wallet.name);
              english.text.should.contain('123,000 bits');
              done();
            }, 100);
          });
        });
      });
    });

    it('should support multiple emailservice instances running concurrently', function(done) {
      var emailService2 = new EmailService();
      emailService2.start({
        lock: emailService.lock, // Use same locker service
        messageBroker: server.messageBroker,
        storage: storage,
        mailer: mailerStub,
        emailOpts: {
          from: 'bws2@dummy.net',
          subjectPrefix: '[test wallet 2]',
        },
      }, function(err) {
        helpers.stubUtxos(server, wallet, 1, function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            setTimeout(function() {
              var calls = mailerStub.sendMail.getCalls();
              calls.length.should.equal(2);
              server.storage.fetchUnsentEmails(function(err, unsent) {
                should.not.exist(err);
                unsent.should.be.empty;
                done();
              });
            }, 100);
          });
        });
      });
    });
  });

  describe('#getInstance', function() {
    it('should get server instance', function() {
      var server = WalletService.getInstance({
        clientVersion: 'bwc-0.0.1',
      });
      server.clientVersion.should.equal('bwc-0.0.1');
    });
  });

  describe('#getInstanceWithAuth', function() {
    it('should get server instance for existing copayer', function(done) {
      helpers.createAndJoinWallet(1, 2, function(s, wallet) {
        var xpriv = TestData.copayers[0].xPrivKey;
        var priv = TestData.copayers[0].privKey_1H_0;

        var sig = WalletUtils.signMessage('hello world', priv);

        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: 'hello world',
          signature: sig,
          clientVersion: 'bwc-0.0.1',
        }, function(err, server) {
          should.not.exist(err);
          server.walletId.should.equal(wallet.id);
          server.copayerId.should.equal(wallet.copayers[0].id);
          server.clientVersion.should.equal('bwc-0.0.1');
          done();
        });
      });
    });

    it('should fail when requesting for non-existent copayer', function(done) {
      WalletService.getInstanceWithAuth({
        copayerId: 'ads',
        message: TestData.message.text,
        signature: TestData.message.signature,
      }, function(err, server) {
        err.code.should.equal('NOT_AUTHORIZED');
        err.message.should.contain('Copayer not found');
        done();
      });
    });

    it('should fail when message signature cannot be verified', function(done) {
      helpers.createAndJoinWallet(1, 2, function(s, wallet) {
        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: 'dummy',
          signature: 'dummy',
        }, function(err, server) {
          err.code.should.equal('NOT_AUTHORIZED');
          err.message.should.contain('Invalid signature');
          done();
        });
      });
    });
  });

  describe('#createWallet', function() {
    var server;
    beforeEach(function() {
      server = new WalletService();
    });

    it('should create and store wallet', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet(walletId, function(err, wallet) {
          should.not.exist(err);
          wallet.id.should.equal(walletId);
          wallet.name.should.equal('my wallet');
          done();
        });
      });
    });


    it('should create  wallet with given id', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
        id: '1234',
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet('1234', function(err, wallet) {
          should.not.exist(err);
          wallet.id.should.equal(walletId);
          wallet.name.should.equal('my wallet');
          done();
        });
      });
    });

    it('should fail to create wallets with same id', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
        id: '1234',
      };
      server.createWallet(opts, function(err, walletId) {
        server.createWallet(opts, function(err, walletId) {
          err.message.should.contain('Wallet already exists');
          done();
        });
      });
    });


    it('should fail to create wallet with no name', function(done) {
      var opts = {
        name: '',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(walletId);
        should.exist(err);
        err.message.should.contain('name');
        done();
      });
    });

    it('should fail to create wallet with invalid copayer pairs', function(done) {
      var invalidPairs = [{
        m: 0,
        n: 0
      }, {
        m: 0,
        n: 2
      }, {
        m: 2,
        n: 1
      }, {
        m: 0,
        n: 10
      }, {
        m: 1,
        n: 20
      }, {
        m: 10,
        n: 10
      }, ];
      var opts = {
        id: '123',
        name: 'my wallet',
        pubKey: TestData.keyPair.pub,
      };
      async.each(invalidPairs, function(pair, cb) {
        opts.m = pair.m;
        opts.n = pair.n;
        server.createWallet(opts, function(err) {
          should.exist(err);
          err.message.should.equal('Invalid combination of required copayers / total copayers');
          return cb();
        });
      }, function(err) {
        done();
      });
    });

    it('should fail to create wallet with invalid pubKey argument', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: 'dummy',
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(walletId);
        should.exist(err);
        err.message.should.contain('Invalid public key');
        done();
      });
    });
  });

  describe('#joinWallet', function() {
    var server, walletId;
    beforeEach(function(done) {
      server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, wId) {
        should.not.exist(err);
        should.exist.walletId;
        walletId = wId;
        done();
      });
    });

    it('should join existing wallet', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
        customData: 'dummy custom data',
      });
      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);
        var copayerId = result.copayerId;
        helpers.getAuthServer(copayerId, function(server) {
          server.getWallet({}, function(err, wallet) {
            wallet.id.should.equal(walletId);
            wallet.copayers.length.should.equal(1);
            var copayer = wallet.copayers[0];
            copayer.name.should.equal('me');
            copayer.id.should.equal(copayerId);
            copayer.customData.should.equal('dummy custom data');
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var notif = _.find(notifications, {
                type: 'NewCopayer'
              });
              should.exist(notif);
              notif.data.walletId.should.equal(walletId);
              notif.data.copayerId.should.equal(copayerId);
              notif.data.copayerName.should.equal('me');

              notif = _.find(notifications, {
                type: 'WalletComplete'
              });
              should.not.exist(notif);
              done();
            });
          });
        });
      });
    });

    it('should fail to join with no name', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: '',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(result);
        should.exist(err);
        err.message.should.contain('name');
        done();
      });
    });

    it('should fail to join non-existent wallet', function(done) {
      var copayerOpts = {
        walletId: '123',
        name: 'me',
        xPubKey: 'dummy',
        requestPubKey: 'dummy',
        copayerSignature: 'dummy',
      };
      server.joinWallet(copayerOpts, function(err) {
        should.exist(err);
        done();
      });
    });

    it('should fail to join full wallet', function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, wallet) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: wallet.id,
          name: 'me',
          xPubKey: TestData.copayers[1].xPubKey_45H,
          requestPubKey: TestData.copayers[1].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          err.code.should.equal('WALLET_FULL');
          err.message.should.equal('Wallet full');
          done();
        });
      });
    });

    it('should fail to re-join wallet', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
      server.joinWallet(copayerOpts, function(err) {
        should.not.exist(err);
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          err.code.should.equal('COPAYER_IN_WALLET');
          err.message.should.equal('Copayer already in wallet');
          done();
        });
      });
    });

    it('should fail to join two wallets with same xPubKey', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
      server.joinWallet(copayerOpts, function(err) {
        should.not.exist(err);

        var walletOpts = {
          name: 'my other wallet',
          m: 1,
          n: 1,
          pubKey: TestData.keyPair.pub,
        };
        server.createWallet(walletOpts, function(err, walletId) {
          should.not.exist(err);
          copayerOpts = helpers.getSignedCopayerOpts({
            walletId: walletId,
            name: 'me',
            xPubKey: TestData.copayers[0].xPubKey_45H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0,
          });
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.code.should.equal('COPAYER_REGISTERED');
            err.message.should.equal('Copayer ID already registered on server');
            done();
          });
        });
      });
    });

    it('should fail to join with bad formated signature', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
        copayerSignature: 'bad sign',
      };
      server.joinWallet(copayerOpts, function(err) {
        err.message.should.equal('Bad request');
        done();
      });
    });

    it('should fail to join with null signature', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      };
      server.joinWallet(copayerOpts, function(err) {
        should.exist(err);
        err.message.should.contain('argument missing');
        done();
      });
    });

    it('should fail to join with wrong signature', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
      copayerOpts.name = 'me2';
      server.joinWallet(copayerOpts, function(err) {
        err.message.should.equal('Bad request');
        done();
      });
    });

    it('should set pkr and status = complete on last copayer joining (2-3)', function(done) {
      helpers.createAndJoinWallet(2, 3, function(server) {
        server.getWallet({}, function(err, wallet) {
          should.not.exist(err);
          wallet.status.should.equal('complete');
          wallet.publicKeyRing.length.should.equal(3);
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            var notif = _.find(notifications, {
              type: 'WalletComplete'
            });
            should.exist(notif);
            notif.data.walletId.should.equal(wallet.id);
            done();
          });
        });
      });
    });

    it('should not notify WalletComplete if 1-of-1', function(done) {
      helpers.createAndJoinWallet(1, 1, function(server) {
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          var notif = _.find(notifications, {
            type: 'WalletComplete'
          });
          should.not.exist(notif);
          done();
        });
      });
    });
  });

  describe('#getStatus', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get status', function(done) {
      server.getStatus({}, function(err, status) {
        should.not.exist(err);
        should.exist(status);
        should.exist(status.wallet);
        status.wallet.name.should.equal(wallet.name);
        should.exist(status.wallet.copayers);
        status.wallet.copayers.length.should.equal(1);
        should.exist(status.balance);
        status.balance.totalAmount.should.equal(0);
        should.exist(status.preferences);
        should.exist(status.pendingTxps);
        status.pendingTxps.should.be.empty;

        should.not.exist(status.wallet.publicKeyRing);
        should.not.exist(status.wallet.pubKey);
        should.not.exist(status.wallet.addressManager);
        _.each(status.wallet.copayers, function(copayer) {
          should.not.exist(copayer.xPubKey);
          should.not.exist(copayer.requestPubKey);
          should.not.exist(copayer.signature);
          should.not.exist(copayer.requestPubKey);
          should.not.exist(copayer.addressManager);
          should.not.exist(copayer.customData);
        });
        done();
      });
    });
    it('should get status including extended info', function(done) {
      server.getStatus({
        includeExtendedInfo: true
      }, function(err, status) {
        should.not.exist(err);
        should.exist(status);
        should.exist(status.wallet.publicKeyRing);
        should.exist(status.wallet.pubKey);
        should.exist(status.wallet.addressManager);
        should.exist(status.wallet.copayers[0].xPubKey);
        should.exist(status.wallet.copayers[0].requestPubKey);
        should.exist(status.wallet.copayers[0].signature);
        should.exist(status.wallet.copayers[0].requestPubKey);
        should.exist(status.wallet.copayers[0].addressManager);
        should.exist(status.wallet.copayers[0].customData);
        // Do not return other copayer's custom data
        _.each(_.rest(status.wallet.copayers), function(copayer) {
          should.not.exist(copayer.customData);
        });
        done();
      });
    });
    it('should get status after tx creation', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          server.getStatus({}, function(err, status) {
            should.not.exist(err);
            status.pendingTxps.length.should.equal(1);
            var balance = status.balance;
            balance.totalAmount.should.equal(helpers.toSatoshi(300));
            balance.lockedAmount.should.equal(tx.inputs[0].satoshis);
            balance.availableAmount.should.equal(balance.totalAmount - balance.lockedAmount);
            done();
          });
        });
      });
    });
  });

  describe('#verifyMessageSignature', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should successfully verify message signature', function(done) {
      var opts = {
        message: TestData.message.text,
        signature: TestData.message.signature,
      };
      server.verifyMessageSignature(opts, function(err, isValid) {
        should.not.exist(err);
        isValid.should.equal(true);
        done();
      });
    });

    it('should fail to verify message signature for different copayer', function(done) {
      var opts = {
        message: TestData.message.text,
        signature: TestData.message.signature,
      };
      helpers.getAuthServer(wallet.copayers[1].id, function(server) {
        server.verifyMessageSignature(opts, function(err, isValid) {
          should.not.exist(err);
          isValid.should.be.false;
          done();
        });
      });
    });
  });

  describe('#createAddress', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should create address', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        should.exist(address);
        address.walletId.should.equal(wallet.id);
        address.network.should.equal('livenet');
        address.address.should.equal('3KxttbKQQPWmpsnXZ3rB4mgJTuLnVR7frg');
        address.isChange.should.be.false;
        address.path.should.equal('m/2147483647/0/0');
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          var notif = _.find(notifications, {
            type: 'NewAddress'
          });
          should.exist(notif);
          notif.data.address.should.equal('3KxttbKQQPWmpsnXZ3rB4mgJTuLnVR7frg');
          done();
        });
      });
    });

    it('should create many addresses on simultaneous requests', function(done) {
      var N = 5;
      async.map(_.range(N), function(i, cb) {
        server.createAddress({}, cb);
      }, function(err, addresses) {
        addresses.length.should.equal(N);
        _.each(_.range(N), function(i) {
          addresses[i].path.should.equal('m/2147483647/0/' + i);
        });
        // No two identical addresses
        _.uniq(_.pluck(addresses, 'address')).length.should.equal(N);
        done();
      });
    });

    it('should not create address if unable to store it', function(done) {
      sinon.stub(server.storage, 'storeAddressAndWallet').yields('dummy error');
      server.createAddress({}, function(err, address) {
        should.exist(err);
        should.not.exist(address);

        server.getMainAddresses({}, function(err, addresses) {
          addresses.length.should.equal(0);

          server.storage.storeAddressAndWallet.restore();
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            should.exist(address);
            address.address.should.equal('3KxttbKQQPWmpsnXZ3rB4mgJTuLnVR7frg');
            address.path.should.equal('m/2147483647/0/0');
            done();
          });
        });
      });
    });
  });

  describe('Preferences', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should save & retrieve preferences', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com',
        language: 'es',
        unit: 'bit',
        dummy: 'ignored',
      }, function(err) {
        should.not.exist(err);
        server.getPreferences({}, function(err, preferences) {
          should.not.exist(err);
          should.exist(preferences);
          preferences.email.should.equal('dummy@dummy.com');
          preferences.language.should.equal('es');
          preferences.unit.should.equal('bit');
          should.not.exist(preferences.dummy);
          done();
        });
      });
    });
    it('should save preferences only for requesting copayer', function(done) {
      server.savePreferences({
        email: 'dummy@dummy.com'
      }, function(err) {
        should.not.exist(err);
        helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
          server2.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.not.exist(preferences.email);
            done();
          });
        });
      });
    });
    it('should save preferences incrementally', function(done) {
      async.series([

        function(next) {
          server.savePreferences({
            email: 'dummy@dummy.com',
          }, next);
        },
        function(next) {
          server.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.exist(preferences);
            preferences.email.should.equal('dummy@dummy.com');
            should.not.exist(preferences.language);
            next();
          });
        },
        function(next) {
          server.savePreferences({
            language: 'es',
          }, next);
        },
        function(next) {
          server.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.exist(preferences);
            preferences.language.should.equal('es');
            preferences.email.should.equal('dummy@dummy.com');
            next();
          });
        },
        function(next) {
          server.savePreferences({
            language: null,
            unit: 'bit',
          }, next);
        },
        function(next) {
          server.getPreferences({}, function(err, preferences) {
            should.not.exist(err);
            should.exist(preferences);
            preferences.unit.should.equal('bit');
            should.not.exist(preferences.language);
            preferences.email.should.equal('dummy@dummy.com');
            next();
          });
        },
      ], function(err) {
        should.not.exist(err);
        done();
      });
    });
    it.skip('should save preferences only for requesting wallet', function(done) {});
    it('should validate entries', function(done) {
      var invalid = [{
        preferences: {
          email: ' ',
        },
        expected: 'email'
      }, {
        preferences: {
          email: 'dummy@' + _.repeat('domain', 50),
        },
        expected: 'email'
      }, {
        preferences: {
          language: 'xxxxx',
        },
        expected: 'language'
      }, {
        preferences: {
          language: 123,
        },
        expected: 'language'
      }, {
        preferences: {
          unit: 'xxxxx',
        },
        expected: 'unit'
      }, ];
      async.each(invalid, function(item, next) {
        server.savePreferences(item.preferences, function(err) {
          should.exist(err);
          err.message.should.contain(item.expected);
          next();
        });
      }, done);
    });
  });

  describe('#getUtxos', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get UTXOs for wallet addresses', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2], function() {
        server.getUtxos({}, function(err, utxos) {
          should.not.exist(err);
          should.exist(utxos);
          utxos.length.should.equal(2);
          _.sum(utxos, 'satoshis').should.equal(3 * 1e8);
          server.getMainAddresses({}, function(err, addresses) {
            var utxo = utxos[0];
            var address = _.find(addresses, {
              address: utxo.address
            });
            should.exist(address);
            utxo.path.should.equal(address.path);
            utxo.publicKeys.should.deep.equal(address.publicKeys);
            done();
          });
        });
      });
    });
    it('should get UTXOs for specific addresses', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2, 3], function(utxos) {
        _.uniq(utxos, 'address').length.should.be.above(1);
        var address = utxos[0].address;
        var amount = _.sum(_.filter(utxos, {
          address: address
        }), 'satoshis');
        server.getUtxos({
          addresses: [address]
        }, function(err, utxos) {
          should.not.exist(err);
          should.exist(utxos);
          _.sum(utxos, 'satoshis').should.equal(amount);
          done();
        });
      });
    });
  });


  describe('Multiple request Pub Keys', function() {
    var server, wallet;
    var opts, reqPrivKey, ws;
    var getAuthServer = function(copayerId, privKey, cb) {
      var msg = 'dummy';
      var sig = WalletUtils.signMessage(msg, privKey);
      WalletService.getInstanceWithAuth({
        copayerId: copayerId,
        message: msg,
        signature: sig,
        clientVersion: CLIENT_VERSION,
      }, function(err, server) {
        return cb(err, server);
      });
    };

    beforeEach(function() {
      reqPrivKey = new Bitcore.PrivateKey();
      var requestPubKey = reqPrivKey.toPublicKey();

      var xPrivKey = TestData.copayers[0].xPrivKey_45H;
      var sig = WalletUtils.signRequestPubKey(requestPubKey, xPrivKey);

      var copayerId = WalletUtils.xPubToCopayerId(TestData.copayers[0].xPubKey_45H);
      opts = {
        copayerId: copayerId,
        requestPubKey: requestPubKey,
        signature: sig,
      };
      ws = new WalletService();
    });

    describe('#addAccess 1-1', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(1, 1, function(s, w) {
          server = s;
          wallet = w;

          helpers.stubUtxos(server, wallet, 1, function() {
            done();
          });
        });
      });

      it('should be able to re-gain access from  xPrivKey', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          res.wallet.copayers[0].requestPubKeys.length.should.equal(2);
          res.wallet.copayers[0].requestPubKeys[0].selfSigned.should.equal(true);

          server.getBalance(res.wallet.walletId, function(err, bal) {
            should.not.exist(err);
            bal.totalAmount.should.equal(1e8);
            getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {
              server2.getBalance(res.wallet.walletId, function(err, bal2) {
                should.not.exist(err);
                bal2.totalAmount.should.equal(1e8);
                done();
              });
            });
          });
        });
      });

      it('should fail to gain access with wrong xPrivKey', function(done) {
        opts.signature = 'xx';
        ws.addAccess(opts, function(err, res) {
          err.code.should.equal('NOT_AUTHORIZED');
          done();
        });
      });

      it('should fail to access with wrong privkey after gaining access', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          server.getBalance(res.wallet.walletId, function(err, bal) {
            should.not.exist(err);
            var privKey = new Bitcore.PrivateKey();
            (getAuthServer(opts.copayerId, privKey, function(err, server2) {
              err.code.should.equal('NOT_AUTHORIZED');
              done();
            }));
          });
        });
      });

      it('should be able to create TXs after regaining access', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {
            var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, null, reqPrivKey);
            server2.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    describe('#addAccess 2-2', function() {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(2, 2, function(s, w) {
          server = s;
          wallet = w;
          helpers.stubUtxos(server, wallet, 1, function() {
            done();
          });
        });
      });

      it('should be able to re-gain access from  xPrivKey', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          server.getBalance(res.wallet.walletId, function(err, bal) {
            should.not.exist(err);
            bal.totalAmount.should.equal(1e8);
            getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {
              server2.getBalance(res.wallet.walletId, function(err, bal2) {
                should.not.exist(err);
                bal2.totalAmount.should.equal(1e8);
                done();
              });
            });
          });
        });
      });

      it('TX proposals should include info to be verified', function(done) {
        ws.addAccess(opts, function(err, res) {
          should.not.exist(err);
          getAuthServer(opts.copayerId, reqPrivKey, function(err, server2) {
            var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.8, null, reqPrivKey);
            server2.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              server2.getPendingTxs({}, function(err, txs) {
                should.not.exist(err);
                should.exist(txs[0].proposalSignaturePubKey);
                should.exist(txs[0].proposalSignaturePubKeySig);
                done();
              });
            });
          });
        });
      });

    });
  });

  describe('#getBalance', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get balance', function(done) {
      helpers.stubUtxos(server, wallet, [1, 'u2', 3], function() {
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          should.exist(balance);
          balance.totalAmount.should.equal(helpers.toSatoshi(6));
          balance.lockedAmount.should.equal(0);
          balance.availableAmount.should.equal(helpers.toSatoshi(6));
          balance.totalBytesToSendMax.should.equal(578);

          balance.totalConfirmedAmount.should.equal(helpers.toSatoshi(4));
          balance.lockedConfirmedAmount.should.equal(0);
          balance.availableConfirmedAmount.should.equal(helpers.toSatoshi(4));

          should.exist(balance.byAddress);
          balance.byAddress.length.should.equal(2);
          balance.byAddress[0].amount.should.equal(helpers.toSatoshi(4));
          balance.byAddress[1].amount.should.equal(helpers.toSatoshi(2));
          server.getMainAddresses({}, function(err, addresses) {
            should.not.exist(err);
            var addresses = _.uniq(_.pluck(addresses, 'address'));
            _.intersection(addresses, _.pluck(balance.byAddress, 'address')).length.should.equal(2);
            done();
          });
        });
      });
    });
    it('should get balance when there are no addresses', function(done) {
      server.getBalance({}, function(err, balance) {
        should.not.exist(err);
        should.exist(balance);
        balance.totalAmount.should.equal(0);
        balance.lockedAmount.should.equal(0);
        balance.availableAmount.should.equal(0);
        balance.totalBytesToSendMax.should.equal(0);
        should.exist(balance.byAddress);
        balance.byAddress.length.should.equal(0);
        done();
      });
    });
    it('should get balance when there are no funds', function(done) {
      blockchainExplorer.getUnspentUtxos = sinon.stub().callsArgWith(1, null, []);
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          should.exist(balance);
          balance.totalAmount.should.equal(0);
          balance.lockedAmount.should.equal(0);
          balance.availableAmount.should.equal(0);
          balance.totalBytesToSendMax.should.equal(0);
          should.exist(balance.byAddress);
          balance.byAddress.length.should.equal(0);
          done();
        });
      });
    });
    it('should only include addresses with balance', function(done) {
      helpers.stubUtxos(server, wallet, 1, function(utxos) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          server.getBalance({}, function(err, balance) {
            should.not.exist(err);
            balance.byAddress.length.should.equal(1);
            balance.byAddress[0].amount.should.equal(helpers.toSatoshi(1));
            balance.byAddress[0].address.should.equal(utxos[0].address);
            done();
          });
        });
      });
    });
    it('should return correct kb to send max', function(done) {
      helpers.stubUtxos(server, wallet, _.range(1, 10, 0), function() {
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          should.exist(balance);
          balance.totalAmount.should.equal(helpers.toSatoshi(9));
          balance.lockedAmount.should.equal(0);
          balance.totalBytesToSendMax.should.equal(1535);
          done();
        });
      });
    });
    it('should fail gracefully when blockchain is unreachable', function(done) {
      blockchainExplorer.getUnspentUtxos = sinon.stub().callsArgWith(1, 'dummy error');
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        server.getBalance({}, function(err, balance) {
          should.exist(err);
          err.toString().should.equal('dummy error');
          done();
        });
      });
    });
  });

  describe('#getFeeLevels', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get current fee levels', function(done) {
      helpers.stubFeeLevels({
        1: 40000,
        2: 20000,
        6: 18000,
      });
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = _.zipObject(_.map(fees, function(item) {
          return [item.level, item];
        }));
        fees.priority.feePerKb.should.equal(40000);
        fees.priority.nbBlocks.should.equal(1);

        fees.normal.feePerKb.should.equal(20000);
        fees.normal.nbBlocks.should.equal(2);

        fees.economy.feePerKb.should.equal(18000);
        fees.economy.nbBlocks.should.equal(6);
        done();
      });
    });
    it('should get default fees if network cannot be accessed', function(done) {
      blockchainExplorer.estimateFee = sinon.stub().yields('dummy error');
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = _.zipObject(_.map(fees, function(item) {
          return [item.level, item.feePerKb];
        }));
        fees.priority.should.equal(50000);
        fees.normal.should.equal(20000);
        fees.economy.should.equal(10000);
        done();
      });
    });
    it('should get default fees if network cannot estimate (returns -1)', function(done) {
      helpers.stubFeeLevels({
        1: -1,
        2: 18000,
        6: 0,
      });
      server.getFeeLevels({}, function(err, fees) {
        should.not.exist(err);
        fees = _.zipObject(_.map(fees, function(item) {
          return [item.level, item];
        }));
        fees.priority.feePerKb.should.equal(50000);
        should.not.exist(fees.priority.nbBlocks);

        fees.normal.feePerKb.should.equal(18000);
        fees.normal.nbBlocks.should.equal(2);

        fees.economy.feePerKb.should.equal(0);
        fees.economy.nbBlocks.should.equal(6);
        done();
      });
    });
  });

  describe('Wallet not complete tests', function() {
    it('should fail to create address when wallet is not complete', function(done) {
      var server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_45H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server) {
            server.createAddress({}, function(err, address) {
              should.not.exist(address);
              should.exist(err);
              err.code.should.equal('WALLET_NOT_COMPLETE');
              err.message.should.equal('Wallet is not complete');
              done();
            });
          });
        });
      });
    });

    it('should fail to create tx when wallet is not complete', function(done) {
      var server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_45H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server, wallet) {
            var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[0].privKey);
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(tx);
              should.exist(err);
              err.code.should.equal('WALLET_NOT_COMPLETE');
              done();
            });
          });
        });
      });
    });
  });

  describe('#createTx', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should create a tx', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.walletId.should.equal(wallet.id);
          tx.network.should.equal('livenet');
          tx.creatorId.should.equal(wallet.copayers[0].id);
          tx.message.should.equal('some message');
          tx.isAccepted().should.equal.false;
          tx.isRejected().should.equal.false;
          tx.amount.should.equal(helpers.toSatoshi(80));
          var estimatedFee = WalletUtils.DEFAULT_FEE_PER_KB * 400 / 1000; // fully signed tx should have about 400 bytes
          tx.fee.should.be.within(0.9 * estimatedFee, 1.1 * estimatedFee);
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.length.should.equal(1);
            // creator
            txs[0].deleteLockTime.should.equal(0);
            server.getBalance({}, function(err, balance) {
              should.not.exist(err);
              balance.totalAmount.should.equal(helpers.toSatoshi(300));
              balance.lockedAmount.should.equal(tx.inputs[0].satoshis);
              balance.lockedAmount.should.be.below(balance.totalAmount);
              balance.availableAmount.should.equal(balance.totalAmount - balance.lockedAmount);
              server.storage.fetchAddresses(wallet.id, function(err, addresses) {
                should.not.exist(err);
                var change = _.filter(addresses, {
                  isChange: true
                });
                change.length.should.equal(1);
                done();
              });
            });
          });
        });
      });
    });

    it('should create a tx with legacy signature', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOptsLegacy('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          done();
        });
      });
    });

    it('should create a tx using confirmed utxos first', function(done) {
      helpers.stubUtxos(server, wallet, [1.3, 'u0.5', 'u0.1', 1.2], function(utxos) {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 1.5, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.inputs.length.should.equal(2);
          _.difference(_.pluck(tx.inputs, 'txid'), [utxos[0].txid, utxos[3].txid]).length.should.equal(0);
          done();
        });
      });
    });

    it('should use unconfirmed utxos only when no more confirmed utxos are available', function(done) {
      helpers.stubUtxos(server, wallet, [1.3, 'u0.5', 'u0.1', 1.2], function(utxos) {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 2.55, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.inputs.length.should.equal(3);
          var txids = _.pluck(tx.inputs, 'txid');
          txids.should.contain(utxos[0].txid);
          txids.should.contain(utxos[3].txid);
          done();
        });
      });
    });

    it('should exclude unconfirmed utxos if specified', function(done) {
      helpers.stubUtxos(server, wallet, [1.3, 'u2', 'u0.1', 1.2], function(utxos) {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 3, 'some message', TestData.copayers[0].privKey_1H_0);
        txOpts.excludeUnconfirmedUtxos = true;
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('INSUFFICIENT_FUNDS');
          err.message.should.equal('Insufficient funds');
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 2.5, 'some message', TestData.copayers[0].privKey_1H_0);
          txOpts.excludeUnconfirmedUtxos = true;
          server.createTx(txOpts, function(err, tx) {
            should.exist(err);
            err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
            err.message.should.equal('Insufficient funds for fee');
            done();
          });
        });
      });
    });

    it('should use non-locked confirmed utxos when specified', function(done) {
      helpers.stubUtxos(server, wallet, [1.3, 'u2', 'u0.1', 1.2], function(utxos) {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 1.4, 'some message', TestData.copayers[0].privKey_1H_0);
        txOpts.excludeUnconfirmedUtxos = true;
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.inputs.length.should.equal(2);
          server.getBalance({}, function(err, balance) {
            should.not.exist(err);
            balance.lockedConfirmedAmount.should.equal(helpers.toSatoshi(2.5));
            balance.availableConfirmedAmount.should.equal(0);
            var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.01, 'some message', TestData.copayers[0].privKey_1H_0);
            txOpts.excludeUnconfirmedUtxos = true;
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('LOCKED_FUNDS');
              done();
            });
          });
        });
      });
    });

    it('should fail gracefully if unable to reach the blockchain', function(done) {
      blockchainExplorer.getUnspentUtxos = sinon.stub().callsArgWith(1, 'dummy error');
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.toString().should.equal('dummy error');
          done();
        });
      });
    });

    it('should fail to create tx with invalid proposal signature', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, 'dummy');

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          should.exist(err);
          err.message.should.equal('Invalid proposal signature');
          done();
        });
      });
    });

    it('should fail to create tx with proposal signed by another copayer', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[1].privKey_1H_0);

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          should.exist(err);
          err.message.should.equal('Invalid proposal signature');
          done();
        });
      });
    });

    it('should fail to create tx for invalid address', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createSimpleProposalOpts('invalid address', 80, null, TestData.copayers[0].privKey_1H_0);

        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          should.not.exist(tx);
          // may fail due to Non-base58 character, or Checksum mismatch, or other
          done();
        });
      });
    });

    it('should fail to create tx for address of different network', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createSimpleProposalOpts('myE38JHdxmQcTJGP1ZiX4BiGhDxMJDvLJD', 80, null, TestData.copayers[0].privKey_1H_0);

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          should.exist(err);
          err.code.should.equal('INCORRECT_ADDRESS_NETWORK');
          err.message.should.equal('Incorrect address network');
          done();
        });
      });
    });

    it('should fail to create tx for invalid amount', function(done) {
      var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0, null, TestData.copayers[0].privKey_1H_0);
      server.createTx(txOpts, function(err, tx) {
        should.not.exist(tx);
        should.exist(err);
        err.message.should.equal('Invalid amount');
        done();
      });
    });

    it('should fail to create tx when insufficient funds', function(done) {
      helpers.stubUtxos(server, wallet, [100], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 120, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('INSUFFICIENT_FUNDS');
          err.message.should.equal('Insufficient funds');
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.length.should.equal(0);
            server.getBalance({}, function(err, balance) {
              should.not.exist(err);
              balance.lockedAmount.should.equal(0);
              balance.totalAmount.should.equal(10000000000);
              done();
            });
          });
        });
      });
    });

    it('should fail to create tx when insufficient funds for fee', function(done) {
      helpers.stubUtxos(server, wallet, 0.048222, function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.048200, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
          err.message.should.equal('Insufficient funds for fee');
          done();
        });
      });
    });

    it('should scale fees according to tx size', function(done) {
      helpers.stubUtxos(server, wallet, [1, 1, 1, 1], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 3.5, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          var estimatedFee = WalletUtils.DEFAULT_FEE_PER_KB * 1300 / 1000; // fully signed tx should have about 1300 bytes
          tx.fee.should.be.within(0.9 * estimatedFee, 1.1 * estimatedFee);
          done();
        });
      });
    });

    it('should be possible to use a smaller fee', function(done) {
      helpers.stubUtxos(server, wallet, 1, function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.99995, null, TestData.copayers[0].privKey_1H_0, 80000);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.99995, null, TestData.copayers[0].privKey_1H_0, 5000);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            var estimatedFee = 5000 * 400 / 1000; // fully signed tx should have about 400 bytes
            tx.fee.should.be.within(0.9 * estimatedFee, 1.1 * estimatedFee);

            // Sign it to make sure Bitcore doesn't complain about the fees
            var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
            server.signTx({
              txProposalId: tx.id,
              signatures: signatures,
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should fail to create tx for dust amount', function(done) {
      helpers.stubUtxos(server, wallet, [1], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.00000001, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('DUST_AMOUNT');
          err.message.should.equal('Amount below dust threshold');
          done();
        });
      });
    });

    it('should fail to create tx that would return change for dust amount', function(done) {
      helpers.stubUtxos(server, wallet, [1], function() {
        var fee = 4095 / 1e8; // The exact fee of the resulting tx
        var change = 100 / 1e8; // Below dust
        var amount = 1 - fee - change;

        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', amount, null, TestData.copayers[0].privKey_1H_0, 10000);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('DUST_AMOUNT');
          err.message.should.equal('Amount below dust threshold');
          done();
        });
      });
    });

    it('should fail with different error for insufficient funds and locked funds', function(done) {
      helpers.stubUtxos(server, wallet, [10, 10], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 11, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          server.getBalance({}, function(err, balance) {
            should.not.exist(err);
            balance.totalAmount.should.equal(helpers.toSatoshi(20));
            balance.lockedAmount.should.equal(helpers.toSatoshi(20));
            txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 8, null, TestData.copayers[0].privKey_1H_0);
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('LOCKED_FUNDS');
              err.message.should.equal('Funds are locked by pending transaction proposals');
              done();
            });
          });
        });
      });
    });

    it('should create tx with 0 change output', function(done) {
      helpers.stubUtxos(server, wallet, [1], function() {
        var fee = 4100 / 1e8; // The exact fee of the resulting tx
        var amount = 1 - fee;

        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', amount, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          var bitcoreTx = tx.getBitcoreTx();
          bitcoreTx.outputs.length.should.equal(1);
          bitcoreTx.outputs[0].satoshis.should.equal(tx.amount);
          done();
        });
      });
    });

    it('should fail gracefully when bitcore throws exception on raw tx creation', function(done) {
      helpers.stubUtxos(server, wallet, [10], function() {
        var bitcoreStub = sinon.stub(Bitcore, 'Transaction');
        bitcoreStub.throws({
          name: 'dummy',
          message: 'dummy exception'
        });
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 2, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.message.should.equal('dummy exception');
          bitcoreStub.restore();
          done();
        });
      });
    });

    it('should create tx when there is a pending tx and enough UTXOs', function(done) {
      helpers.stubUtxos(server, wallet, [10.1, 10.2, 10.3], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 12, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          var txOpts2 = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 8, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts2, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(2);
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.totalAmount.should.equal(3060000000);
                balance.lockedAmount.should.equal(3060000000);
                done();
              });
            });
          });
        });
      });
    });

    it('should fail to create tx when there is a pending tx and not enough UTXOs', function(done) {
      helpers.stubUtxos(server, wallet, [10.1, 10.2, 10.3], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 12, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          var txOpts2 = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 24, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts2, function(err, tx) {
            err.code.should.equal('LOCKED_FUNDS');
            should.not.exist(tx);
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(1);
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.totalAmount.should.equal(helpers.toSatoshi(30.6));
                var amountInputs = _.sum(txs[0].inputs, 'satoshis');
                balance.lockedAmount.should.equal(amountInputs);
                balance.lockedAmount.should.be.below(balance.totalAmount);
                balance.availableAmount.should.equal(balance.totalAmount - balance.lockedAmount);
                done();
              });
            });
          });
        });
      });
    });

    it('should create tx using different UTXOs for simultaneous requests', function(done) {
      var N = 5;
      helpers.stubUtxos(server, wallet, _.range(100, 100 + N, 0), function(utxos) {
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          balance.totalAmount.should.equal(helpers.toSatoshi(N * 100));
          balance.lockedAmount.should.equal(0);
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[0].privKey_1H_0);
          async.map(_.range(N), function(i, cb) {
            server.createTx(txOpts, function(err, tx) {
              cb(err, tx);
            });
          }, function(err) {
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(N);
              _.uniq(_.pluck(txs, 'changeAddress')).length.should.equal(N);
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.totalAmount.should.equal(helpers.toSatoshi(N * 100));
                balance.lockedAmount.should.equal(balance.totalAmount);
                done();
              });
            });
          });
        });
      });
    });

    it('should create tx for type multiple_outputs', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var outputs = [{
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 75,
          message: 'message #1'
        }, {
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 75,
          message: 'message #2'
        }];
        var txOpts = helpers.createProposalOpts(Model.TxProposal.Types.MULTIPLEOUTPUTS, outputs, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          done();
        });
      });
    });

    it('should fail to create tx for type multiple_outputs with missing output argument', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var outputs = [{
          amount: 80,
          message: 'message #1',
        }, {
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: 90,
          message: 'message #2'
        }];
        var txOpts = helpers.createProposalOpts(Model.TxProposal.Types.MULTIPLEOUTPUTS, outputs, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.message.should.contain('outputs argument missing');
          done();
        });
      });
    });

    it('should fail to create tx for unsupported proposal type', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
        txOpts.type = 'bogus';
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.message.should.contain('Invalid proposal type');
          done();
        });
      });
    });

    it('should be able to send max amount', function(done) {
      helpers.stubUtxos(server, wallet, _.range(1, 10, 0), function() {
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          balance.totalAmount.should.equal(helpers.toSatoshi(9));
          balance.lockedAmount.should.equal(0);
          balance.availableAmount.should.equal(helpers.toSatoshi(9));
          balance.totalBytesToSendMax.should.equal(2896);
          var fee = parseInt((balance.totalBytesToSendMax * 10000 / 1000).toFixed(0));
          var max = balance.availableAmount - fee;
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', max / 1e8, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            tx.amount.should.equal(max);
            var estimatedFee = 2896 * 10000 / 1000;
            tx.fee.should.be.within(0.9 * estimatedFee, 1.1 * estimatedFee);
            server.getBalance({}, function(err, balance) {
              should.not.exist(err);
              balance.lockedAmount.should.equal(helpers.toSatoshi(9));
              balance.availableAmount.should.equal(0);
              done();
            });
          });
        });
      });
    });
    it('should be able to send max non-locked amount', function(done) {
      helpers.stubUtxos(server, wallet, _.range(1, 10, 0), function() {
        var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 3.5, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          server.getBalance({}, function(err, balance) {
            should.not.exist(err);
            balance.totalAmount.should.equal(helpers.toSatoshi(9));
            balance.lockedAmount.should.equal(helpers.toSatoshi(4));
            balance.availableAmount.should.equal(helpers.toSatoshi(5));
            balance.totalBytesToSendMax.should.equal(1653);
            var fee = parseInt((balance.totalBytesToSendMax * 2000 / 1000).toFixed(0));
            var max = balance.availableAmount - fee;
            var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', max / 1e8, null, TestData.copayers[0].privKey_1H_0, 2000);
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              tx.amount.should.equal(max);
              var estimatedFee = 1653 * 2000 / 1000;
              tx.fee.should.be.within(0.9 * estimatedFee, 1.1 * estimatedFee);
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.lockedAmount.should.equal(helpers.toSatoshi(9));
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('#createTx backoff time', function(done) {
    var server, wallet, txid;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(2, 6), function() {
          done();
        });
      });
    });

    it('should follow backoff time after consecutive rejections', function(done) {
      async.series([

        function(next) {
          async.each(_.range(3), function(i, next) {
              var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 1, null, TestData.copayers[0].privKey_1H_0);
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                server.rejectTx({
                  txProposalId: tx.id,
                  reason: 'some reason',
                }, next);
              });
            },
            next);
        },
        function(next) {
          // Allow a 4th tx
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 1, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            server.rejectTx({
              txProposalId: tx.id,
              reason: 'some reason',
            }, next);
          });
        },
        function(next) {
          // Do not allow before backoff time
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 1, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.exist(err);
            err.code.should.equal('TX_CANNOT_CREATE');
            next();
          });
        },
        function(next) {
          var clock = sinon.useFakeTimers(Date.now() + (WalletService.BACKOFF_TIME + 2) * 60 * 1000, 'Date');
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 1, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            clock.restore();
            server.rejectTx({
              txProposalId: tx.id,
              reason: 'some reason',
            }, next);
          });
        },
        function(next) {
          // Do not allow a 5th tx before backoff time
          var clock = sinon.useFakeTimers(Date.now() + (WalletService.BACKOFF_TIME + 2) * 60 * 1000 + 1, 'Date');
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 1, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            clock.restore();
            should.exist(err);
            err.code.should.equal('TX_CANNOT_CREATE');
            next();
          });
        },
      ], function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('#rejectTx', function() {
    var server, wallet, txid;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            txid = tx.id;
            done();
          });
        });
      });
    });

    it('should reject a TX', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        server.rejectTx({
          txProposalId: txid,
          reason: 'some reason',
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            server.getTx({
              txProposalId: txid
            }, function(err, tx) {
              var actors = tx.getActors();
              actors.length.should.equal(1);
              actors[0].should.equal(wallet.copayers[0].id);
              var action = tx.getActionBy(wallet.copayers[0].id);
              action.type.should.equal('reject');
              action.comment.should.equal('some reason');
              done();
            });
          });
        });
      });
    });

    it('should fail to reject non-pending TX', function(done) {
      async.waterfall([

        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            var tx = txs[0];
            tx.id.should.equal(txid);
            next();
          });
        },
        function(next) {
          server.rejectTx({
            txProposalId: txid,
            reason: 'some reason',
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.rejectTx({
              txProposalId: txid,
              reason: 'some other reason',
            }, function(err) {
              should.exist(err);
              err.code.should.equal('TX_NOT_PENDING');
              done();
            });
          });
        },
      ]);
    });
  });

  describe('#signTx', function() {
    var server, wallet, txid;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 20, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            txid = tx.id;
            done();
          });
        });
      });
    });

    it('should sign a TX with multiple inputs, different paths', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            var tx = txs[0];
            tx.id.should.equal(txid);

            var actors = tx.getActors();
            actors.length.should.equal(1);
            actors[0].should.equal(wallet.copayers[0].id);
            tx.getActionBy(wallet.copayers[0].id).type.should.equal('accept');

            done();
          });
        });
      });
    });


    it('should fail to sign with a xpriv from other copayer', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);
        var signatures = helpers.clientSign(tx, TestData.copayers[1].xPrivKey);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          err.code.should.equal('BAD_SIGNATURES');
          done();
        });
      });
    });

    it('should fail if one signature is broken', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        signatures[0] = 1;

        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          err.message.should.contain('signatures');
          done();
        });
      });
    });

    it('should fail on invalid signature', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = ['11', '22', '33', '44', '55'];
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          should.exist(err);
          err.message.should.contain('Bad signatures');
          done();
        });
      });
    });

    it('should fail on wrong number of invalid signatures', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = _.take(helpers.clientSign(tx, TestData.copayers[0].xPrivKey), tx.inputs.length - 1);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          should.exist(err);
          err.message.should.contain('Bad signatures');
          done();
        });
      });
    });

    it('should fail when signing a TX previously rejected', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          server.rejectTx({
            txProposalId: txid,
          }, function(err) {
            err.code.should.contain('COPAYER_VOTED');
            done();
          });
        });
      });
    });

    it('should fail when rejected a previously signed TX', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        server.rejectTx({
          txProposalId: txid,
        }, function(err) {
          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            err.code.should.contain('COPAYER_VOTED');
            done();
          });
        });
      });
    });

    it('should fail to sign a non-pending TX', function(done) {
      async.waterfall([

        function(next) {
          server.rejectTx({
            txProposalId: txid,
            reason: 'some reason',
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.rejectTx({
              txProposalId: txid,
              reason: 'some reason',
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[2].id, function(server) {
            server.getTx({
              txProposalId: txid
            }, function(err, tx) {
              should.not.exist(err);
              var signatures = helpers.clientSign(tx, TestData.copayers[2].xPrivKey);
              server.signTx({
                txProposalId: txid,
                signatures: signatures,
              }, function(err) {
                should.exist(err);
                err.code.should.equal('TX_NOT_PENDING');
                done();
              });
            });
          });
        },
      ]);
    });
  });

  describe('#broadcastTx & #braodcastRawTx', function() {
    var server, wallet, txpid;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, [10, 10], function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 9, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
            server.signTx({
              txProposalId: txp.id,
              signatures: signatures,
            }, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.isAccepted().should.be.true;
              txp.isBroadcasted().should.be.false;
              txpid = txp.id;
              done();
            });
          });
        });
      });
    });

    it('should broadcast a tx', function(done) {
      var clock = sinon.useFakeTimers(1234000, 'Date');
      helpers.stubBroadcast('999');
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          txp.txid.should.equal('999');
          txp.isBroadcasted().should.be.true;
          txp.broadcastedOn.should.equal(1234);
          clock.restore();
          done();
        });
      });
    });

    it('should broadcast a raw tx', function(done) {
      helpers.stubBroadcast('999');
      server.broadcastRawTx({
        network: 'testnet',
        rawTx: 'raw tx',
      }, function(err, txid) {
        should.not.exist(err);
        txid.should.equal('999');
        done();
      });
    });

    it('should fail to brodcast a tx already marked as broadcasted', function(done) {
      helpers.stubBroadcast('999');
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.broadcastTx({
          txProposalId: txpid
        }, function(err) {
          should.exist(err);
          err.code.should.equal('TX_ALREADY_BROADCASTED');
          done();
        });
      });
    });

    it('should fail to brodcast a not yet accepted tx', function(done) {
      helpers.stubBroadcast('999');
      var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 9, 'some other message', TestData.copayers[0].privKey_1H_0);
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        should.exist(txp);
        server.broadcastTx({
          txProposalId: txp.id
        }, function(err) {
          should.exist(err);
          err.code.should.equal('TX_NOT_ACCEPTED');
          done();
        });
      });
    });

    it('should keep tx as accepted if unable to broadcast it', function(done) {
      blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
      blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.exist(err);
        err.toString().should.equal('broadcast error');
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.not.exist(txp.txid);
          txp.isBroadcasted().should.be.false;
          should.not.exist(txp.broadcastedOn);
          txp.isAccepted().should.be.true;
          done();
        });
      });
    });

    it('should mark tx as broadcasted if accepted but already in blockchain', function(done) {
      blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
      blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, {
        txid: '999'
      });
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.exist(txp.txid);
          txp.txid.should.equal('999');
          txp.isBroadcasted().should.be.true;
          should.exist(txp.broadcastedOn);
          done();
        });
      });
    });

    it('should keep tx as accepted if broadcast fails and cannot check tx in blockchain', function(done) {
      blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
      blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, 'bc check error');
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.exist(err);
        err.toString().should.equal('bc check error');
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.not.exist(txp.txid);
          txp.isBroadcasted().should.be.false;
          should.not.exist(txp.broadcastedOn);
          txp.isAccepted().should.be.true;
          done();
        });
      });
    });
  });

  describe('Tx proposal workflow', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
          helpers.stubBroadcast('999');
          done();
        });
      });
    });

    it('other copayers should see pending proposal created by one copayer', function(done) {
      var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey_1H_0);
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        should.exist(txp);
        helpers.getAuthServer(wallet.copayers[1].id, function(server2, wallet) {
          server2.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            txps[0].id.should.equal(txp.id);
            txps[0].message.should.equal('some message');
            done();
          });
        });
      });
    });

    it('tx proposals should not be finally accepted until quorum is reached', function(done) {
      var txpId;
      async.waterfall([

        function(next) {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, txp) {
            txpId = txp.id;
            should.not.exist(err);
            should.exist(txp);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.actions.should.be.empty;
            next(null, txp);
          });
        },
        function(txp, next) {
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
          server.signTx({
            txProposalId: txpId,
            signatures: signatures,
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isAccepted().should.be.false;
            txp.isRejected().should.be.false;
            txp.isBroadcasted().should.be.false;
            txp.actions.length.should.equal(1);
            var action = txp.getActionBy(wallet.copayers[0].id);
            action.type.should.equal('accept');
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var last = _.last(notifications);
              last.type.should.not.equal('TxProposalFinallyAccepted');
              next(null, txp);
            });
          });
        },
        function(txp, next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server, wallet) {
            var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey);
            server.signTx({
              txProposalId: txpId,
              signatures: signatures,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isAccepted().should.be.true;
            txp.isBroadcasted().should.be.false;
            should.not.exist(txp.txid);
            txp.actions.length.should.equal(2);
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var last = _.last(notifications);
              last.type.should.equal('TxProposalFinallyAccepted');
              last.walletId.should.equal(wallet.id);
              last.creatorId.should.equal(wallet.copayers[1].id);
              last.data.txProposalId.should.equal(txp.id);
              done();
            });
          });
        },
      ]);
    });

    it('tx proposals should accept as many rejections as possible without finally rejecting', function(done) {
      var txpId;
      async.waterfall([

        function(next) {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, txp) {
            txpId = txp.id;
            should.not.exist(err);
            should.exist(txp);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.actions.should.be.empty;
            next();
          });
        },
        function(next) {
          server.rejectTx({
            txProposalId: txpId,
            reason: 'just because'
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isRejected().should.be.false;
            txp.isAccepted().should.be.false;
            txp.actions.length.should.equal(1);
            var action = txp.getActionBy(wallet.copayers[0].id);
            action.type.should.equal('reject');
            action.comment.should.equal('just because');
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server, wallet) {
            server.rejectTx({
              txProposalId: txpId,
              reason: 'some other reason'
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(0);
            next();
          });
        },
        function(next) {
          server.getTx({
            txProposalId: txpId
          }, function(err, txp) {
            should.not.exist(err);
            txp.isPending().should.be.false;
            txp.isRejected().should.be.true;
            txp.isAccepted().should.be.false;
            txp.actions.length.should.equal(2);
            done();
          });
        },
      ]);
    });
  });

  describe('#getTx', function() {
    var server, wallet, txpid;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, 10, function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 9, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txpid = txp.id;
            done();
          });
        });
      });
    });

    it('should get own transaction proposal', function(done) {
      server.getTx({
        txProposalId: txpid
      }, function(err, txp) {
        should.not.exist(err);
        should.exist(txp);
        txp.id.should.equal(txpid);
        done();
      });
    });
    it('should get someone elses transaction proposal', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2, wallet) {
        server2.getTx({
          txProposalId: txpid
        }, function(err, res) {
          should.not.exist(err);
          res.id.should.equal(txpid);
          done();
        });
      });

    });
    it('should fail to get non-existent transaction proposal', function(done) {
      server.getTx({
        txProposalId: 'dummy'
      }, function(err, txp) {
        should.exist(err);
        should.not.exist(txp);
        err.code.should.equal('TX_NOT_FOUND')
        err.message.should.equal('Transaction proposal not found');
        done();
      });
    });
    it.skip('should get accepted/rejected transaction proposal', function(done) {});
    it.skip('should get broadcasted transaction proposal', function(done) {});
  });

  describe('#getTxs', function() {
    var server, wallet, clock;

    beforeEach(function(done) {
      this.timeout(5000);
      clock = sinon.useFakeTimers('Date');
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 11), function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.1, null, TestData.copayers[0].privKey_1H_0);
          async.eachSeries(_.range(10), function(i, next) {
            clock.tick(10 * 1000);
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              next();
            });
          }, function(err) {
            clock.restore();
            return done(err);
          });
        });
      });
    });
    afterEach(function() {
      clock.restore();
    });

    it('should pull 4 txs, down to to time 60', function(done) {
      server.getTxs({
        minTs: 60,
        limit: 8
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([100, 90, 80, 70, 60]);
        done();
      });
    });

    it('should pull the first 5 txs', function(done) {
      server.getTxs({
        maxTs: 50,
        limit: 5
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([50, 40, 30, 20, 10]);
        done();
      });
    });

    it('should pull the last 4 txs', function(done) {
      server.getTxs({
        limit: 4
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([100, 90, 80, 70]);
        done();
      });
    });

    it('should pull all txs', function(done) {
      server.getTxs({}, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
        done();
      });
    });


    it('should txs from times 50 to 70',
      function(done) {
        server.getTxs({
          minTs: 50,
          maxTs: 70,
        }, function(err, txps) {
          should.not.exist(err);
          var times = _.pluck(txps, 'createdOn');
          times.should.deep.equal([70, 60, 50]);
          done();
        });
      });
  });

  describe('Notifications', function() {
    var server, wallet;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(4), function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.01, null, TestData.copayers[0].privKey_1H_0);
          async.eachSeries(_.range(3), function(i, next) {
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              next();
            });
          }, function(err) {
            return done(err);
          });
        });
      });
    });

    it('should pull the last 4 notifications after 3 TXs', function(done) {
      server.getNotifications({
        limit: 4,
        reverse: true,
      }, function(err, notifications) {
        should.not.exist(err);
        var types = _.pluck(notifications, 'type');
        types.should.deep.equal(['NewTxProposal', 'NewTxProposal', 'NewTxProposal', 'NewAddress']);
        var walletIds = _.uniq(_.pluck(notifications, 'walletId'));
        walletIds.length.should.equal(1);
        walletIds[0].should.equal(wallet.id);
        var creators = _.uniq(_.pluck(notifications, 'creatorId'));
        creators.length.should.equal(1);
        creators[0].should.equal(wallet.copayers[0].id);
        done();
      });
    });

    it('should pull the last 4 notifications, using now', function(done) {
      server.getNotifications({
        limit: 4,
        reverse: true,
        maxTs: Date.now() / 1000,
        minTs: Date.now() / 1000 - 1000,
      }, function(err, notifications) {
        should.not.exist(err);
        var types = _.pluck(notifications, 'type');
        types.should.deep.equal(['NewTxProposal', 'NewTxProposal', 'NewTxProposal', 'NewAddress']);
        done();
      });
    });

    it('should pull all notifications after wallet creation', function(done) {
      server.getNotifications({
        minTs: 0,
      }, function(err, notifications) {
        should.not.exist(err);
        var types = _.pluck(notifications, 'type');
        types[0].should.equal('NewCopayer');
        types[types.length - 1].should.equal('NewTxProposal');
        done();
      });
    });

    it('should contain walletId & creatorId on NewCopayer', function(done) {
      server.getNotifications({
        minTs: 0,
      }, function(err, notifications) {
        should.not.exist(err);
        var newCopayer = notifications[0];
        newCopayer.type.should.equal('NewCopayer');
        newCopayer.walletId.should.equal(wallet.id);
        newCopayer.creatorId.should.equal(wallet.copayers[0].id);
        done();
      });
    });

    it('should notify sign and acceptance', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
        var tx = txs[0];
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          server.getNotifications({
            limit: 3,
            reverse: true,
          }, function(err, notifications) {
            should.not.exist(err);
            var types = _.pluck(notifications, 'type');
            types.should.deep.equal(['TxProposalFinallyAccepted', 'TxProposalAcceptedBy', 'NewTxProposal']);
            done();
          });
        });
      });
    });

    it('should notify rejection', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[1];
        server.rejectTx({
          txProposalId: tx.id,
        }, function(err) {
          should.not.exist(err);
          server.getNotifications({
            limit: 2,
            reverse: true,
          }, function(err, notifications) {
            should.not.exist(err);
            var types = _.pluck(notifications, 'type');
            types.should.deep.equal(['TxProposalFinallyRejected', 'TxProposalRejectedBy']);
            done();
          });
        });
      });
    });


    it('should notify sign, acceptance, and broadcast, and emit', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[2];
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          helpers.stubBroadcast('1122334455');
          server.broadcastTx({
            txProposalId: tx.id
          }, function(err, txp) {
            should.not.exist(err);
            server.getNotifications({
              limit: 3,
              reverse: true,
            }, function(err, notifications) {
              should.not.exist(err);
              var types = _.pluck(notifications, 'type');
              types.should.deep.equal(['NewOutgoingTx', 'TxProposalFinallyAccepted', 'TxProposalAcceptedBy']);
              done();
            });
          });
        });
      });
    });
  });

  describe('#removeWallet', function() {
    var server, wallet, clock;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;

        helpers.stubUtxos(server, wallet, _.range(2), function() {
          var txOpts = {
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: helpers.toSatoshi(0.1),
          };
          async.eachSeries(_.range(2), function(i, next) {
            server.createTx(txOpts, function(err, tx) {
              next();
            });
          }, done);
        });
      });
    });

    it('should delete a wallet', function(done) {
      server.removeWallet({}, function(err) {
        should.not.exist(err);
        server.getWallet({}, function(err, w) {
          should.exist(err);
          err.code.should.equal('WALLET_NOT_FOUND');
          should.not.exist(w);
          async.parallel([

            function(next) {
              server.storage.fetchAddresses(wallet.id, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
            function(next) {
              server.storage.fetchTxs(wallet.id, {}, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
            function(next) {
              server.storage.fetchNotifications(wallet.id, {}, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
          ], function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    // creates 2 wallet, and deletes only 1.
    it('should delete a wallet, and only that wallet', function(done) {
      var server2, wallet2;
      async.series([

        function(next) {
          helpers.createAndJoinWallet(1, 1, {
            offset: 1
          }, function(s, w) {
            server2 = s;
            wallet2 = w;

            helpers.stubUtxos(server2, wallet2, _.range(1, 3), function() {
              var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.1, 'some message', TestData.copayers[1].privKey_1H_0);
              async.eachSeries(_.range(2), function(i, next) {
                server2.createTx(txOpts, function(err, tx) {
                  should.not.exist(err);
                  next(err);
                });
              }, next);
            });
          });
        },
        function(next) {
          server.removeWallet({}, next);
        },
        function(next) {
          server.getWallet({}, function(err, wallet) {
            should.exist(err);
            err.code.should.equal('WALLET_NOT_FOUND');
            next();
          });
        },
        function(next) {
          server2.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            should.exist(wallet);
            wallet.id.should.equal(wallet2.id);
            next();
          });
        },
        function(next) {
          server2.getMainAddresses({}, function(err, addresses) {
            should.not.exist(err);
            should.exist(addresses);
            addresses.length.should.above(0);
            next();
          });
        },
        function(next) {
          server2.getTxs({}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(2);
            next();
          });
        },
        function(next) {
          server2.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            should.exist(notifications);
            notifications.length.should.above(0);
            next();
          });
        },
      ], function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('#removePendingTx', function() {
    var server, wallet, txp;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, [100, 200], function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            server.getPendingTxs({}, function(err, txs) {
              txp = txs[0];
              done();
            });
          });
        });
      });
    });


    it('should allow creator to remove an unsigned TX', function(done) {
      server.removePendingTx({
        txProposalId: txp.id
      }, function(err) {
        should.not.exist(err);
        server.getPendingTxs({}, function(err, txs) {
          txs.length.should.equal(0);
          done();
        });
      });
    });

    it('should allow creator to remove a signed TX by himself', function(done) {
      var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
      server.signTx({
        txProposalId: txp.id,
        signatures: signatures,
      }, function(err) {
        should.not.exist(err);
        server.removePendingTx({
          txProposalId: txp.id
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            txs.length.should.equal(0);
            done();
          });
        });
      });
    });

    it('should fail to remove non-pending TX', function(done) {
      async.waterfall([

        function(next) {
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
          server.signTx({
            txProposalId: txp.id,
            signatures: signatures,
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.rejectTx({
              txProposalId: txp.id,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[2].id, function(server) {
            server.rejectTx({
              txProposalId: txp.id,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            next();
          });
        },
        function(next) {
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            should.exist(err);
            err.code.should.equal('TX_NOT_PENDING');
            done();
          });
        },
      ]);
    });

    it('should not allow non-creator copayer to remove an unsigned TX ', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        server2.removePendingTx({
          txProposalId: txp.id
        }, function(err) {
          should.exist(err);
          err.code.should.contain('TX_CANNOT_REMOVE');
          server2.getPendingTxs({}, function(err, txs) {
            txs.length.should.equal(1);
            done();
          });
        });
      });
    });

    it('should not allow creator copayer to remove a TX signed by other copayer, in less than 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            err.code.should.equal('TX_CANNOT_REMOVE');
            err.message.should.contain('Cannot remove');
            done();
          });
        });
      });
    });

    it('should allow creator copayer to remove a TX rejected by other copayer, in less than 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey);
        server2.rejectTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });



    it('should allow creator copayer to remove a TX signed by other copayer, after 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);

          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs[0].deleteLockTime.should.be.above(WalletService.DELETE_LOCKTIME - 10);

            var clock = sinon.useFakeTimers(Date.now() + 1 + 24 * 3600 * 1000, 'Date');
            server.removePendingTx({
              txProposalId: txp.id
            }, function(err) {
              should.not.exist(err);
              clock.restore();
              done();
            });
          });
        });
      });
    });


    it('should allow other copayer to remove a TX signed, after 24hrs', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);

          var clock = sinon.useFakeTimers(Date.now() + 2000 + WalletService.DELETE_LOCKTIME * 1000, 'Date');
          server2.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            should.not.exist(err);
            clock.restore();
            done();
          });
        });
      });
    });
  });

  describe('#getTxHistory', function() {
    var server, wallet, mainAddresses, changeAddresses;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.createAddresses(server, wallet, 1, 1, function(main, change) {
          mainAddresses = main;
          changeAddresses = change;
          done();
        });
      });
    });

    it('should get tx history from insight', function(done) {
      helpers.stubHistory(TestData.history);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(2);
        done();
      });
    });
    it('should get tx history for incoming txs', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('received');
        tx.amount.should.equal(200);
        tx.fees.should.equal(100);
        tx.time.should.equal(20);
        done();
      });
    });
    it('should get tx history for outgoing txs', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        time: 1,
        inputs: [{
          address: mainAddresses[0].address,
          amount: 500,
        }],
        outputs: [{
          address: 'external',
          amount: 400,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('sent');
        tx.amount.should.equal(400);
        tx.fees.should.equal(100);
        tx.time.should.equal(1);
        done();
      });
    });
    it('should get tx history for outgoing txs + change', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        time: 1,
        inputs: [{
          address: mainAddresses[0].address,
          amount: 500,
        }],
        outputs: [{
          address: 'external',
          amount: 300,
        }, {
          address: changeAddresses[0].address,
          amount: 100,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('sent');
        tx.amount.should.equal(300);
        tx.fees.should.equal(100);
        tx.outputs[0].address.should.equal('external');
        tx.outputs[0].amount.should.equal(300);
        done();
      });
    });
    it('should get tx history with accepted proposal', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var external = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';

      helpers.stubUtxos(server, wallet, [100, 200], function(utxos) {
        var outputs = [{
          toAddress: external,
          amount: 50,
          message: undefined // no message
        }, {
          toAddress: external,
          amount: 30,
          message: 'message #2'
        }];
        var txOpts = helpers.createProposalOpts(Model.TxProposal.Types.MULTIPLEOUTPUTS, outputs, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);

          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
          server.signTx({
            txProposalId: tx.id,
            signatures: signatures,
          }, function(err, tx) {
            should.not.exist(err);

            helpers.stubBroadcast('1122334455');
            server.broadcastTx({
              txProposalId: tx.id
            }, function(err, txp) {
              should.not.exist(err);
              var txs = [{
                txid: '1122334455',
                confirmations: 1,
                fees: 5460,
                time: 1,
                inputs: [{
                  address: tx.inputs[0].address,
                  amount: utxos[0].satoshis,
                }],
                outputs: [{
                  address: changeAddresses[0].address,
                  amount: helpers.toSatoshi(20) - 5460,
                }, {
                  address: external,
                  amount: helpers.toSatoshi(50)
                }, {
                  address: external,
                  amount: helpers.toSatoshi(30)
                }]
              }];
              helpers.stubHistory(txs);

              server.getTxHistory({}, function(err, txs) {
                should.not.exist(err);
                should.exist(txs);
                txs.length.should.equal(1);
                var tx = txs[0];
                tx.action.should.equal('sent');
                tx.amount.should.equal(helpers.toSatoshi(80));
                tx.message.should.equal('some message');
                tx.addressTo.should.equal(external);
                tx.actions.length.should.equal(1);
                tx.actions[0].type.should.equal('accept');
                tx.actions[0].copayerName.should.equal('copayer 1');
                tx.proposalType.should.equal(Model.TxProposal.Types.MULTIPLEOUTPUTS);
                tx.outputs[0].address.should.equal(external);
                tx.outputs[0].amount.should.equal(helpers.toSatoshi(50));
                should.not.exist(tx.outputs[0].message);
                should.not.exist(tx.outputs[0]['isMine']);
                should.not.exist(tx.outputs[0]['isChange']);
                tx.outputs[1].address.should.equal(external);
                tx.outputs[1].amount.should.equal(helpers.toSatoshi(30));
                should.exist(tx.outputs[1].message);
                tx.outputs[1].message.should.equal('message #2');
                done();
              });
            });
          });
        });
      });
    });
    it('should get various paginated tx history', function(done) {
      var testCases = [{
        opts: {},
        expected: [50, 40, 30, 20, 10],
      }, {
        opts: {
          skip: 1,
          limit: 3,
        },
        expected: [40, 30, 20],
      }, {
        opts: {
          skip: 1,
          limit: 2,
        },
        expected: [40, 30],
      }, {
        opts: {
          skip: 2,
        },
        expected: [30, 20, 10],
      }, {
        opts: {
          limit: 4,
        },
        expected: [50, 40, 30, 20],
      }, {
        opts: {
          skip: 0,
          limit: 3,
        },
        expected: [50, 40, 30],
      }, {
        opts: {
          skip: 0,
          limit: 0,
        },
        expected: [],
      }, {
        opts: {
          skip: 4,
          limit: 20,
        },
        expected: [10],
      }, {
        opts: {
          skip: 20,
          limit: 1,
        },
        expected: [],
      }];

      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var timestamps = [50, 40, 30, 20, 10];
      var txs = _.map(timestamps, function(ts, idx) {
        return {
          txid: (idx + 1).toString(),
          confirmations: ts / 10,
          fees: 100,
          time: ts,
          inputs: [{
            address: 'external',
            amount: 500,
          }],
          outputs: [{
            address: mainAddresses[0].address,
            amount: 200,
          }],
        };
      });
      helpers.stubHistory(txs);

      async.each(testCases, function(testCase, next) {
        server.getTxHistory(testCase.opts, function(err, txs) {
          should.not.exist(err);
          should.exist(txs);
          _.pluck(txs, 'time').should.deep.equal(testCase.expected);
          next();
        });
      }, done);
    });
    it('should fail gracefully if unable to reach the blockchain', function(done) {
      blockchainExplorer.getTransactions = sinon.stub().callsArgWith(3, 'dummy error');
      server.getTxHistory({}, function(err, txs) {
        should.exist(err);
        err.toString().should.equal('dummy error');
        done();
      });
    });
    it('should handle invalid tx in  history ', function(done) {
      var h = _.clone(TestData.history);
      h.push({
        txid: 'xx'
      })
      helpers.stubHistory(h);

      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(3);
        txs[2].action.should.equal('invalid');
        done();
      });
    });
  });

  describe('#scan', function() {
    var server, wallet;
    var scanConfigOld = WalletService.SCAN_CONFIG;
    beforeEach(function(done) {
      this.timeout(5000);
      WalletService.SCAN_CONFIG.scanWindow = 2;
      WalletService.SCAN_CONFIG.derivationDelay = 0;

      helpers.createAndJoinWallet(1, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });
    afterEach(function() {
      WalletService.SCAN_CONFIG = scanConfigOld;
    });

    it('should scan main addresses', function(done) {
      helpers.stubAddressActivity(
        ['3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A', // m/2147483647/0/0
          '3NezgtNbuDzL2sFhnfxyVy8bHp4v6ud252', // m/2147483647/0/2
          '3CQ2hCMUu1SCPVPMpfCCuT3nAfHGiHV1o7', // m/2147483647/1/0
        ]);
      var expectedPaths = [
        'm/2147483647/0/0',
        'm/2147483647/0/1',
        'm/2147483647/0/2',
        'm/2147483647/0/3',
        'm/2147483647/1/0',
        'm/2147483647/1/1',
      ];
      server.scan({}, function(err) {
        should.not.exist(err);
        server.getWallet({}, function(err, wallet) {
          should.not.exist(err);
          wallet.scanStatus.should.equal('success');
          server.storage.fetchAddresses(wallet.id, function(err, addresses) {
            should.exist(addresses);
            addresses.length.should.equal(expectedPaths.length);
            var paths = _.pluck(addresses, 'path');
            _.difference(paths, expectedPaths).length.should.equal(0);
            server.createAddress({}, function(err, address) {
              should.not.exist(err);
              address.path.should.equal('m/2147483647/0/4');
              done();
            });
          });
        });
      });
    });
    it('should scan main addresses & copayer addresses', function(done) {
      helpers.stubAddressActivity(
        ['3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A', // m/2147483647/0/0
          '3CQ2hCMUu1SCPVPMpfCCuT3nAfHGiHV1o7', // m/2147483647/1/0
          '3BYHznBmosYxUj1NWcjdFKX2tdsH7UT1YG', // m/0/0/1
          '3Eg1uPkGnwyU42bRiaDuo6Cu9bjjhoG7Sh', // m/1/1/0
          '3AYmZ63tMd2AHN8QLfu5D2nfRzCH66psWx', // m/1/0/0
        ]);
      var expectedPaths = [
        'm/2147483647/0/0',
        'm/2147483647/0/1',
        'm/2147483647/1/0',
        'm/2147483647/1/1',
        'm/0/0/0',
        'm/0/0/1',
        'm/1/0/0',
        'm/1/0/1',
        'm/1/1/0',
        'm/1/1/1',
      ];
      server.scan({
        includeCopayerBranches: true
      }, function(err) {
        should.not.exist(err);
        server.storage.fetchAddresses(wallet.id, function(err, addresses) {
          should.exist(addresses);
          addresses.length.should.equal(expectedPaths.length);
          var paths = _.pluck(addresses, 'path');
          _.difference(paths, expectedPaths).length.should.equal(0);
          done();
        })
      });
    });
    it('should restore wallet balance', function(done) {
      async.waterfall([

        function(next) {
          helpers.stubUtxos(server, wallet, [1, 2, 3], function(utxos) {
            should.exist(utxos);
            helpers.stubAddressActivity(_.pluck(utxos, 'address'));
            server.getBalance({}, function(err, balance) {
              balance.totalAmount.should.equal(helpers.toSatoshi(6));
              next(null, server, wallet);
            });
          });
        },
        function(server, wallet, next) {
          server.removeWallet({}, function(err) {
            next(err);
          });
        },
        function(next) {
          // NOTE: this works because it creates the exact same wallet!
          helpers.createAndJoinWallet(1, 2, function(server, wallet) {
            server.getBalance({}, function(err, balance) {
              balance.totalAmount.should.equal(0);
              next(null, server, wallet);
            });
          });
        },
        function(server, wallet, next) {
          server.scan({}, function(err) {
            should.not.exist(err);
            server.getBalance(wallet.id, function(err, balance) {
              balance.totalAmount.should.equal(helpers.toSatoshi(6));
              next();
            })
          });
        },
      ], function(err) {
        should.not.exist(err);
        done();
      });
    });
    it('should abort scan if there is an error checking address activity', function(done) {
      blockchainExplorer.getAddressActivity = sinon.stub().callsArgWith(1, 'dummy error');
      server.scan({}, function(err) {
        should.exist(err);
        err.toString().should.equal('dummy error');
        server.getWallet({}, function(err, wallet) {
          should.not.exist(err);
          wallet.scanStatus.should.equal('error');
          server.storage.fetchAddresses(wallet.id, function(err, addresses) {
            should.not.exist(err);
            addresses.should.be.empty;
            done();
          });
        });
      });
    });
  });

  describe('#startScan', function() {
    var server, wallet;
    var scanConfigOld = WalletService.SCAN_CONFIG;
    beforeEach(function(done) {
      this.timeout(5000);
      WalletService.SCAN_CONFIG.scanWindow = 2;
      WalletService.SCAN_CONFIG.derivationDelay = 0;

      helpers.createAndJoinWallet(1, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });
    afterEach(function() {
      WalletService.SCAN_CONFIG = scanConfigOld;
      server.messageBroker.removeAllListeners();
    });

    it('should start an asynchronous scan', function(done) {
      helpers.stubAddressActivity([
        '3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A', // m/2147483647/0/0
        '3NezgtNbuDzL2sFhnfxyVy8bHp4v6ud252', // m/2147483647/0/2
        '3CQ2hCMUu1SCPVPMpfCCuT3nAfHGiHV1o7', // m/2147483647/1/1
      ]);
      var expectedPaths = [
        'm/2147483647/0/0',
        'm/2147483647/0/1',
        'm/2147483647/0/2',
        'm/2147483647/0/3',
        'm/2147483647/1/0',
        'm/2147483647/1/1',
      ];
      server.messageBroker.onMessage(function(n) {
        if (n.type == 'ScanFinished') {
          server.getWallet({}, function(err, wallet) {
            should.exist(wallet.scanStatus);
            wallet.scanStatus.should.equal('success');
            should.not.exist(n.creatorId);
            server.storage.fetchAddresses(wallet.id, function(err, addresses) {
              should.exist(addresses);
              addresses.length.should.equal(expectedPaths.length);
              var paths = _.pluck(addresses, 'path');
              _.difference(paths, expectedPaths).length.should.equal(0);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                address.path.should.equal('m/2147483647/0/4');
                done();
              });
            })
          });
        }
      });
      server.startScan({}, function(err) {
        should.not.exist(err);
      });
    });
    it('should set scan status error when unable to reach blockchain', function(done) {
      blockchainExplorer.getAddressActivity = sinon.stub().yields('dummy error');
      server.messageBroker.onMessage(function(n) {
        if (n.type == 'ScanFinished') {
          should.exist(n.data.error);
          server.getWallet({}, function(err, wallet) {
            should.exist(wallet.scanStatus);
            wallet.scanStatus.should.equal('error');
            done();
          });
        }
      });
      server.startScan({}, function(err) {
        should.not.exist(err);
      });
    });
    it('should start multiple asynchronous scans for different wallets', function(done) {
      helpers.stubAddressActivity(['3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A']);
      WalletService.SCAN_CONFIG.scanWindow = 1;

      var scans = 0;
      server.messageBroker.onMessage(function(n) {
        if (n.type == 'ScanFinished') {
          scans++;
          if (scans == 2) done();
        }
      });

      // Create a second wallet
      var server2 = new WalletService();
      var opts = {
        name: 'second wallet',
        m: 1,
        n: 1,
        pubKey: TestData.keyPair.pub,
      };
      server2.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'copayer 1',
          xPubKey: TestData.copayers[3].xPubKey_45H,
          requestPubKey: TestData.copayers[3].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server2) {
            server.startScan({}, function(err) {
              should.not.exist(err);
              scans.should.equal(0);
            });
            server2.startScan({}, function(err) {
              should.not.exist(err);
              scans.should.equal(0);
            });
            scans.should.equal(0);
          });
        });
      });
    });
  });

  describe('Legacy', function() {
    describe('Fees', function() {
      var server, wallet;
      beforeEach(function(done) {
        helpers.createAndJoinWallet(2, 3, function(s, w) {
          server = s;
          wallet = w;
          done();
        });
      });

      it('should create a tx from legacy (bwc-0.0.*) client', function(done) {
        helpers.stubUtxos(server, wallet, [100, 200], function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);

          var verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
          verifyStub.returns(true);
          WalletService.getInstanceWithAuth({
            copayerId: wallet.copayers[0].id,
            message: 'dummy',
            signature: 'dummy',
            clientVersion: 'bwc-0.0.40',
          }, function(err, server) {
            should.not.exist(err);
            should.exist(server);
            verifyStub.restore();
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              tx.amount.should.equal(helpers.toSatoshi(80));
              tx.fee.should.equal(WalletUtils.DEFAULT_FEE_PER_KB);
              done();
            });
          });
        });
      });

      it('should not return error when fetching new txps from legacy (bwc-0.0.*) client', function(done) {
        helpers.stubUtxos(server, wallet, [100, 200], function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);

            var verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
            verifyStub.returns(true);
            WalletService.getInstanceWithAuth({
              copayerId: wallet.copayers[0].id,
              message: 'dummy',
              signature: 'dummy',
              clientVersion: 'bwc-0.0.40',
            }, function(err, server) {
              verifyStub.restore();
              should.not.exist(err);
              should.exist(server);
              server.getPendingTxs({}, function(err, txps) {
                should.not.exist(err);
                should.exist(txps);
                done();
              });
            });
          });
        });
      });
      it('should fail to sign tx from legacy (bwc-0.0.*) client', function(done) {
        helpers.stubUtxos(server, wallet, [100, 200], function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            _.startsWith(tx.version, '1.').should.be.false;

            var verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
            verifyStub.returns(true);
            WalletService.getInstanceWithAuth({
              copayerId: wallet.copayers[0].id,
              message: 'dummy',
              signature: 'dummy',
              clientVersion: 'bwc-0.0.40',
            }, function(err, server) {
              var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
              server.signTx({
                txProposalId: tx.id,
                signatures: signatures,
              }, function(err) {
                verifyStub.restore();
                should.exist(err);
                err.code.should.equal('UPGRADE_NEEDED');
                err.message.should.contain('sign this spend proposal');
                done();
              });
            });
          });
        });
      });
      it('should create a tx from legacy (bwc-0.0.*) client and sign it from newer client', function(done) {
        helpers.stubUtxos(server, wallet, [100, 200], function() {
          var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);

          var verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
          verifyStub.returns(true);
          WalletService.getInstanceWithAuth({
            copayerId: wallet.copayers[0].id,
            message: 'dummy',
            signature: 'dummy',
            clientVersion: 'bwc-0.0.40',
          }, function(err, server) {
            should.not.exist(err);
            should.exist(server);
            verifyStub.restore();
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
              tx.amount.should.equal(helpers.toSatoshi(80));
              tx.fee.should.equal(WalletUtils.DEFAULT_FEE_PER_KB);
              helpers.getAuthServer(wallet.copayers[0].id, function(server) {
                var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
                server.signTx({
                  txProposalId: tx.id,
                  signatures: signatures,
                }, function(err) {
                  should.not.exist(err);
                  done();
                });
              });
            });
          });
        });
      });
      it('should fail with insufficient fee when invoked from legacy (bwc-0.0.*) client', function(done) {
        helpers.stubUtxos(server, wallet, 1, function() {
          var verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
          verifyStub.returns(true);
          WalletService.getInstanceWithAuth({
            copayerId: wallet.copayers[0].id,
            message: 'dummy',
            signature: 'dummy',
            clientVersion: 'bwc-0.0.40',
          }, function(err, server) {
            should.not.exist(err);
            should.exist(server);
            verifyStub.restore();
            var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.99995, null, TestData.copayers[0].privKey_1H_0);

            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('INSUFFICIENT_FUNDS_FOR_FEE');
              var txOpts = helpers.createSimpleProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.99995, null, TestData.copayers[0].privKey_1H_0, 5000);
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                tx.fee.should.equal(5000);

                // Sign it to make sure Bitcore doesn't complain about the fees
                var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
                server.signTx({
                  txProposalId: tx.id,
                  signatures: signatures,
                }, function(err) {
                  should.not.exist(err);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });
});
