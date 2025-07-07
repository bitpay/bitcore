'use strict';

import chai from 'chai';
import 'chai/register-should';
chai.config.includeStack = true;
import sinon from 'sinon';
import async from 'async';
import * as Uuid from 'uuid';
import log from '../src/lib/log';
import oldCredentials from './data/legacyCredentialsExports';
import * as CWC from 'crypto-wallet-core';
import BWS from 'bitcore-wallet-service';
import Client, { Credentials } from '../src';
import { Request } from '../src/lib/request';
import { Utils } from '../src/lib/common';
import * as TestData from './data/testdata';
import { Errors } from '../src/lib/errors';
import { helpers, blockchainExplorerMock } from './helpers';

const should = chai.should();

const Key = Client.Key;
const ExpressApp = BWS.ExpressApp;
const Storage = BWS.Storage;
const Bitcore = CWC.BitcoreLib;
const Bitcore_ = {
  btc: Bitcore,
  bch: CWC.BitcoreLibCash
};

function createTxsV8(nr, bcHeight, txs?) {
  txs = txs || [];
  // Will generate
  // order / confirmations  / height / txid
  //  0.  => -1     / -1            /   txid0   / id0  <=  LAST ONE!
  //  1.  => 1      / bcHeight      /   txid1
  //  2.  => 2      / bcHeight - 1  /   txid2
  //  3.  => 3...   / bcHeight - 2  /   txid3

  let i = 0;
  if (!txs.length) {
    while (i < nr) {
      txs.push({
        id: 'id' + i,
        txid: 'txid' + i,
        size: 226,
        category: 'receive',
        satoshis: 30001,
        // this is translated on V8.prototype.getTransactions
        amount: 30001 / 1e8,
        height: i == 0 ? -1 : bcHeight - i + 1,
        address: 'muFJi3ZPfR5nhxyD7dfpx2nYZA8Wmwzgck',
        blockTime: '2018-09-21T18:08:31.000Z'
      });
      i++;
    }
  }
  return txs;
};

describe('client API', function() {
  // DONT USE LAMBAS HERE!!! https://stackoverflow.com/questions/23492043/change-default-timeout-for-mocha, or this.timeout() will BREAK!
  //
  let clients: Client[], app, sandbox, storage, keys, i;
  let dbConnection;
  let db;
  this.timeout(8000);

  before(function(done) {
    i = 0;
    clients = [];
    helpers.newDb('', (err, database, connection) => {
      dbConnection = connection;
      db = database;
      storage = new Storage({
        db: db
      });
      Storage.createIndexes(db);
      return done(err);
    });
  });

  after(function(done) {
    dbConnection.close(done);
  });

  beforeEach(function(done) {
    keys = [];
    let expressApp = new ExpressApp();
    expressApp.start(
      {
        ignoreRateLimiter: true,
        storage: storage,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
        doNotCheckV8: true
      },
      () => {
        app = expressApp.app;

        // Generates 5 clients
        const range0to4 = Array.from({ length: 5 }, (_,i) => i);
        clients = range0to4.map(i => helpers.newClient(app));
        blockchainExplorerMock.reset();
        sandbox = sinon.createSandbox();

        if (!process.env.BWC_SHOW_LOGS) {
          sandbox.stub(log, 'warn');
          sandbox.stub(log, 'info');
          sandbox.stub(log, 'error');
        }
        done();
      }
    );
  });
  afterEach(function(done) {
    sandbox.restore();
    sinon.restore();
    done();
  });

  describe('constructor', () => {
    it('should set the log level based on the logLevel option', () => {
      var originalLogLevel = log.level;
      var client = new Client({
        logLevel: 'info'
      });
      client.logLevel.should.equal('info');
      log.level.should.equal('info');

      var client = new Client({
        logLevel: 'debug'
      });
      client.logLevel.should.equal('debug');
      log.level.should.equal('debug');

      log.level = originalLogLevel; //restore since log is a singleton
    });

    it('should use silent for the log level if no logLevel is specified', () => {
      var originalLogLevel = log.level;

      log.level = 'foo;';

      var client = new Client();
      client.logLevel.should.equal('silent');
      log.level.should.equal('silent');

      log.level = originalLogLevel; //restore since log is a singleton
    });
  });

  describe('Client Internals', () => {
    it('should expose bitcore', () => {
      should.exist(Bitcore);
      should.exist(Bitcore.HDPublicKey);
    });
  });
  // todo
  describe('Server internals', () => {
    var k;

    before(() => {
      k = new Key({ seedType: 'new' });
    });

    it('should allow cors', function(done) {
      clients[0].credentials = {} as Credentials;
      clients[0].request.doRequest('options', '/', {}, false, (err, x, headers) => {
        headers['access-control-allow-origin'].should.equal('*');
        should.exist(headers['access-control-allow-methods']);
        should.exist(headers['access-control-allow-headers']);
        done();
      });
    });

    it('should request set credentials before creating/joining', function(done) {
      var s = sandbox.stub();
      s.storeWallet = sandbox.stub().yields('bigerror');
      s.fetchWallet = sandbox.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start(
        {
          storage: s,
          blockchainExplorer: blockchainExplorerMock,
          disableLogs: true
        },
        () => {
          var client = helpers.newClient(app);
          client.createWallet(
            '1',
            '2',
            1,
            1,
            {
              network: 'testnet'
            },
            err => {
              should.exist(err);
              err.toString().should.contain('credentials');
              done();
            }
          );
        }
      );
    });

    it('should handle critical errors', function(done) {
      var s = sandbox.stub();
      s.storeWallet = sandbox.stub().yields('bigerror');
      s.fetchWallet = sandbox.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start(
        {
          storage: s,
          blockchainExplorer: blockchainExplorerMock,
          disableLogs: true
        },
        () => {
          var client = helpers.newClient(app);
          client.fromString(k.createCredentials(null, { coin: 'btc', n: 1, network: 'testnet', account: 0 }));
          client.createWallet(
            '1',
            '2',
            1,
            1,
            {
              network: 'testnet'
            },
            err => {
              err.should.be.an.instanceOf(Error);
              err.message.should.equal('bigerror');
              done();
            }
          );
        }
      );
    });

    it('should handle critical errors (Case2)', function(done) {
      var s = sandbox.stub();
      s.storeWallet = sandbox.stub().yields({
        code: 501,
        message: 'wow'
      });
      s.fetchWallet = sandbox.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start(
        {
          storage: s,
          blockchainExplorer: blockchainExplorerMock,
          disableLogs: true
        },
        () => {
          var client = helpers.newClient(app);
          client.fromString(k.createCredentials(null, { coin: 'btc', n: 1, network: 'testnet', account: 0 }));

          client.createWallet(
            '1',
            '2',
            1,
            1,
            {
              network: 'testnet'
            },
            err => {
              err.should.be.an.instanceOf(Error);
              err.message.should.equal('wow');
              done();
            }
          );
        }
      );
    });

    it('should handle critical errors (Case3)', function(done) {
      var s = sandbox.stub();
      s.storeWallet = sandbox.stub().yields({
        code: 404,
        message: 'wow'
      });
      s.fetchWallet = sandbox.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start(
        {
          storage: s,
          blockchainExplorer: blockchainExplorerMock,
          disableLogs: true
        },
        () => {
          var client = helpers.newClient(app);
          client.fromString(k.createCredentials(null, { coin: 'btc', n: 1, network: 'testnet', account: 0 }));

          client.createWallet(
            '1',
            '2',
            1,
            1,
            {
              network: 'testnet'
            },
            err => {
              err.should.be.an.instanceOf(Errors.NOT_FOUND);
              done();
            }
          );
        }
      );
    });

    it('should handle critical errors (Case4)', function(done) {
      var body = {
        code: 999,
        message: 'unexpected body'
      };
      var ret = Request._parseError(body);
      ret.should.be.an.instanceOf(Error);
      ret.message.should.equal('999: unexpected body');
      done();
    });

    it('should handle critical errors (Case5)', function(done) {
      clients[0].request.r = helpers.stubRequest('some error');
      clients[0].fromString(k.createCredentials(null, { coin: 'btc', n: 1, network: 'testnet', account: 0 }));

      clients[0].createWallet(
        'mywallet',
        'creator',
        1,
        2,
        {
          network: 'testnet'
        },
        (err, secret) => {
          should.exist(err);
          err.should.be.an.instanceOf(Errors.CONNECTION_ERROR);
          done();
        }
      );
    });

    it('should correctly use remote message', function(done) {
      var body = {
        code: 'INSUFFICIENT_FUNDS',
        message: undefined
      };
      var ret = Request._parseError(body);
      ret.should.be.an.instanceOf(Error);
      ret.message.should.equal('Insufficient funds.');

      body = {
        code: 'INSUFFICIENT_FUNDS',
        message: 'remote message'
      };
      var ret2 = Request._parseError(body);
      ret2.should.be.an.instanceOf(Error);
      ret2.message.should.equal('remote message');

      body = {
        code: 'MADE_UP_ERROR',
        message: 'remote message'
      };
      var ret3 = Request._parseError(body);
      ret3.should.be.an.instanceOf(Error);
      ret3.message.should.equal('MADE_UP_ERROR: remote message');
      done();
    });
  });

  describe('Build & sign txs', () => {
    var masterPrivateKey =
      'tprv8ZgxMBicQKsPd8U9aBBJ5J2v8XMwKwZvf8qcu2gLK5FRrsrPeSgkEcNHqKx4zwv6cP536m68q2UD7wVM24zdSCpaJRmpowaeJTeVMXL5v5k';
    var derivedPrivateKey = {
      BIP44: new Bitcore.HDPrivateKey(masterPrivateKey).deriveChild("m/44'/1'/0'").toString(),
      BIP45: new Bitcore.HDPrivateKey(masterPrivateKey).deriveChild("m/45'").toString(),
      BIP48: new Bitcore.HDPrivateKey(masterPrivateKey).deriveChild("m/48'/1'/0'").toString()
    };

    describe('#buildTx', () => {
      it('Raw tx roundtrip', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: '2.0.0',
          inputs: utxos,
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10050,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var t = Client.getRawTx(txp);
        should.exist(t);
        (typeof t === 'string').should.be.true;
        /^[\da-f]+$/.test(t).should.be.true;

        var t2 = new Bitcore.Transaction(t);
        t2.inputs.length.should.equal(2);
        t2.outputs.length.should.equal(2);
        t2.outputs[0].satoshis.should.equal(1200);
      });
      it('should build a tx correctly (BIP44)', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: '2.0.0',
          inputs: utxos,
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10050,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
          disableSmallFees: true,
          disableLargeFees: true
        });

        should.not.exist(bitcoreError);
        t.getFee().should.equal(10050);
      });
      it('should build a P2WPKH tx correctly (BIP44)', () => {
        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        const toAddress = Utils.deriveAddress('P2WPKH', publicKeyRing, 'm/0/0', 1, 'livenet', 'btc');
        const changeAddress = Utils.deriveAddress('P2WPKH', publicKeyRing, 'm/0/1', 1, 'livenet', 'btc');

        toAddress.address.should.equal('bc1qrshu7r9z9y22y3wrrghfmjrvn0xxasfl7qrmvf');
        changeAddress.address.should.equal('bc1quhzpvcmllzm3kkf7jwsxdemgaec3dz2j0uuan0');

        var utxos = helpers.generateUtxos('P2WPKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: '2.0.0',
          inputs: utxos,
          toAddress: toAddress.address,
          amount: 1200,
          changeAddress: {
            address: changeAddress.address
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10050,
          derivationStrategy: 'BIP44',
          addressType: 'P2WPKH'
        };
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
          disableSmallFees: true,
          disableLargeFees: true
        });

        should.not.exist(bitcoreError);
        t.getFee().should.equal(10050);
      });
      it('should build a P2WSH tx correctly (BIP48)', () => {
        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP48'])
          }
        ];

        const toAddress = Utils.deriveAddress('P2WSH', publicKeyRing, 'm/0/0', 1, 'livenet', 'btc');
        const changeAddress = Utils.deriveAddress('P2WSH', publicKeyRing, 'm/0/1', 1, 'livenet', 'btc');

        toAddress.address.should.equal('bc1qxq4tyr7uhwprj4w8ayc8manv4t64g0hc74ka9w4qka0uygr7gplqqnlu24');
        changeAddress.address.should.equal('bc1qk8q74mfp7mcldhvfu4azjyqnu7rnd0d9ghdnxkxye34utvp0fgvq50jl0v');

        var utxos = helpers.generateUtxos('P2WSH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: '2.0.0',
          inputs: utxos,
          toAddress: toAddress.address,
          amount: 1200,
          changeAddress: {
            address: changeAddress.address
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10050,
          derivationStrategy: 'BIP44',
          addressType: 'P2WSH'
        };
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
          disableSmallFees: true,
          disableLargeFees: true
        });

        should.not.exist(bitcoreError);
        t.getFee().should.equal(10050);
      });
      it('should build a tx correctly (BIP48)', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP48'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: '2.0.0',
          inputs: utxos,
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10050,
          derivationStrategy: 'BIP48',
          addressType: 'P2PKH'
        };
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
          disableSmallFees: true,
          disableLargeFees: true
        });

        should.not.exist(bitcoreError);
        t.getFee().should.equal(10050);
      });
      it('should build an eth txp correctly', () => {
        const toAddress = '0xa062a07a0a56beb2872b12f388f511d694626730';
        const key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        const path = "m/44'/60'/0'";
        const publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPrivateKey(masterPrivateKey).deriveChild(path).toString()
          }
        ];

        const from = Utils.deriveAddress('P2PKH', publicKeyRing, 'm/0/0', 1, 'livenet', 'eth');

        const txp = {
          version: 3,
          from: from.address,
          coin: 'eth',
          outputs: [
            {
              toAddress: toAddress,
              amount: 3896000000000000,
              gasLimit: 21000,
              message: 'first output'
            }
          ],
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 420000000000000,
          nonce: 6,
          gasPrice: 20000000000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
          amount: 3896000000000000
        };
        var t = Utils.buildTx(txp);
        const rawTxp = t.uncheckedSerialize();
        rawTxp.should.deep.equal([
          '0xeb068504a817c80082520894a062a07a0a56beb2872b12f388f511d694626730870dd764300b800080018080'
        ]);
      });
      it('should build a matic txp correctly', () => {
        const toAddress = '0xa062a07a0a56beb2872b12f388f511d694626730';
        const key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        const path = "m/44'/60'/0'";
        const publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPrivateKey(masterPrivateKey).deriveChild(path).toString()
          }
        ];

        const from = Utils.deriveAddress('P2PKH', publicKeyRing, 'm/0/0', 1, 'livenet', 'matic');

        const txp = {
          version: 3,
          from: from.address,
          coin: 'matic',
          chain: 'matic',
          outputs: [
            {
              toAddress: toAddress,
              amount: 3896000000000000,
              gasLimit: 21000,
              message: 'first output'
            }
          ],
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 420000000000000,
          nonce: 6,
          gasPrice: 20000000000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
          amount: 3896000000000000
        };
        var t = Utils.buildTx(txp);
        const rawTxp = t.uncheckedSerialize();
        rawTxp.should.deep.equal([
          '0xec068504a817c80082520894a062a07a0a56beb2872b12f388f511d694626730870dd764300b80008081898080'
        ]);
      });
      it('should build a sol txp correctly', () => {
        const toAddress = 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY';
        const from = '8WyoNvKsmfdG6zrbzNBVN8DETyLra3ond61saU9C52YR';
        const txp = {
          version: 3,
          from: from,
          coin: 'sol',
          chain: 'sol',
          outputs: [
            {
              toAddress: toAddress,
              amount: 3896000000000000,
            }
          ],
          fee: 5000,
          blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
          blockHeight: 18446744,
          amount: 389600000
        };
        var t = Utils.buildTx(txp);
        const rawTxp = t.uncheckedSerialize();
        rawTxp.should.deep.equal([
          'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDb6/gH5XxrVl86CZd+DpqA1jN8YSz91e8yXxOlyeS8tLRnckLdZVIkhi0iAExccvYpTw5tIfPZ8z/OJGQtnvg9QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7A+XJrI4siFXUreDo+M94DBeuJwm0Oq5kHqeWuAw7xgBAgIAAQwCAAAAAIALMGTXDQA='
        ]);
      });
      it('should protect from creating excessive fee DOGE', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1, 2]);
        var txp = {
          coin: 'doge',
          inputs: utxos,
          toAddress: toAddress,
          amount: 1.5e8,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 3.2e8, /// 3 DOGE fee, WOW!
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };

        // var x = Utils;

        // x.newBitcoreTransaction = () => {
        //   return {
        //     from: sandbox.stub(),
        //     to: sandbox.stub(),
        //     change: sandbox.stub(),
        //     outputs: [
        //       {
        //         satoshis: 1000
        //       }
        //     ],
        //     fee: sandbox.stub()
        //   };
        // };

        var t = Utils.buildTx(txp);
        should.exist(t);
        // x.newBitcoreTransaction = x;
      });
      it('should protect from creating excessive fee', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1, 2]);
        var txp = {
          inputs: utxos,
          toAddress: toAddress,
          amount: 1.5e8,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 0.7e8,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };

        // var x = Utils;

        // x.newBitcoreTransaction = () => {
        //   return {
        //     from: sandbox.stub(),
        //     to: sandbox.stub(),
        //     change: sandbox.stub(),
        //     outputs: [
        //       {
        //         satoshis: 1000
        //       }
        //     ],
        //     fee: sandbox.stub()
        //   };
        // };

        (() => {
          var t = Utils.buildTx(txp);
        }).should.throw('Failed state: totalInputs - totalOutputs <= Defaults.MAX_TX_FEE(chain) at buildTx');

        // x.newBitcoreTransaction = x;
      });
      it('should build a tx with multiple outputs', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          inputs: utxos,
          outputs: [
            {
              toAddress: toAddress,
              amount: 800,
              message: 'first output'
            },
            {
              toAddress: toAddress,
              amount: 900,
              message: 'second output'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true
        });
        should.not.exist(bitcoreError);
      });
      it('should build a tx with provided output scripts', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [0.001]);
        var txp = {
          inputs: utxos,
          type: 'external',
          outputs: [
            {
              toAddress: '18433T2TSgajt9jWhcTBw4GoNREA6LpX3E',
              amount: 700,
              script:
                '512103ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff210314a96cd6f5a20826070173fe5b7e9797f21fc8ca4a55bcb2d2bde99f55dd352352ae'
            },
            {
              amount: 600,
              script: '76a9144d5bd54809f846dc6b1a14cbdd0ac87a3c66f76688ac'
            },
            {
              amount: 0,
              script: '6a1e43430102fa9213bc243af03857d0f9165e971153586d3915201201201210'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2, 3],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true
        });
        should.not.exist(bitcoreError);
        t.outputs.length.should.equal(4);
        t.outputs[0].script.toHex().should.equal(txp.outputs[0].script);
        t.outputs[0].satoshis.should.equal(txp.outputs[0].amount);
        t.outputs[1].script.toHex().should.equal(txp.outputs[1].script);
        t.outputs[1].satoshis.should.equal(txp.outputs[1].amount);
        t.outputs[2].script.toHex().should.equal(txp.outputs[2].script);
        t.outputs[2].satoshis.should.equal(txp.outputs[2].amount);
        var changeScript = Bitcore.Script.fromAddress(txp.changeAddress.address).toHex();
        t.outputs[3].script.toHex().should.equal(changeScript);
      });
      it('should fail if provided output has no either toAddress or script', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [0.001]);
        var txp: any = {
          inputs: utxos,
          type: 'external',
          outputs: [
            {
              amount: 700
            },
            {
              amount: 600,
              script: '76a9144d5bd54809f846dc6b1a14cbdd0ac87a3c66f76688ac'
            },
            {
              amount: 0,
              script: '6a1e43430102fa9213bc243af03857d0f9165e971153586d3915201201201210'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2, 3],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        (() => {
          var t = Utils.buildTx(txp);
        }).should.throw('Output should have either toAddress or script specified');

        txp.outputs[0].toAddress = '18433T2TSgajt9jWhcTBw4GoNREA6LpX3E';
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true
        });
        should.not.exist(bitcoreError);

        delete txp.outputs[0].toAddress;
        txp.outputs[0].script =
          '512103ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff210314a96cd6f5a20826070173fe5b7e9797f21fc8ca4a55bcb2d2bde99f55dd352352ae';
        t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true
        });
        should.not.exist(bitcoreError);
      });
      it('should build a v3 tx proposal', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: 3,
          inputs: utxos,
          outputs: [
            {
              toAddress: toAddress,
              amount: 800,
              message: 'first output'
            },
            {
              toAddress: toAddress,
              amount: 900,
              message: 'second output'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true
        });
        should.not.exist(bitcoreError);
      });

      it('should build a v4 tx proposal', () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: 4,
          inputs: utxos,
          outputs: [
            {
              toAddress: toAddress,
              amount: 800,
              message: 'first output'
            },
            {
              toAddress: toAddress,
              amount: 900,
              message: 'second output'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var t = Utils.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true
        });
        should.not.exist(bitcoreError);
      });
    });

    describe('#pushSignatures', () => {
      it('should sign BIP45 P2SH correctly', async () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP45'])
          }
        ];

        var utxos = helpers.generateUtxos('P2SH', publicKeyRing, 'm/2147483647/0/0', 1, [1000, 2000]);
        var txp = {
          inputs: utxos,
          coin: 'btc',
          signingMethod: 'ecdsa',
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10000,
          derivationStrategy: 'BIP45',
          addressType: 'P2SH'
        };
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        var path = "m/45'";
        var signatures = await key.sign(path, txp);

        // This is a GOOD test, since bitcore ONLY accept VALID signatures
        signatures.length.should.be.equal(utxos.length);
      });
      it('should sign BIP44 P2PKH correctly', async () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          inputs: utxos,
          toAddress: toAddress,
          coin: 'btc',
          amount: 1200,
          signingMethod: 'ecdsa',
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var path = "m/44'/1'/0'";
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        var signatures = await key.sign(path, txp);

        // This is a GOOD test, since bitcore ONLY accept VALID signatures
        signatures.length.should.be.equal(utxos.length);
      });
      it('should sign multiple-outputs proposal correctly', async () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          inputs: utxos,
          coin: 'btc',
          signingMethod: 'ecdsa',
          outputs: [
            {
              toAddress: toAddress,
              amount: 800,
              message: 'first output'
            },
            {
              toAddress: toAddress,
              amount: 900,
              message: 'second output'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var path = "m/44'/1'/0'";
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        var signatures = await key.sign(path, txp);
        signatures.length.should.be.equal(utxos.length);
      });
      it('should sign proposal with provided output scripts correctly', async () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [0.001]);
        var txp = {
          inputs: utxos,
          type: 'external',
          coin: 'btc',
          outputs: [
            {
              amount: 700,
              script:
                '512103ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff210314a96cd6f5a20826070173fe5b7e9797f21fc8ca4a55bcb2d2bde99f55dd352352ae'
            },
            {
              amount: 600,
              script: '76a9144d5bd54809f846dc6b1a14cbdd0ac87a3c66f76688ac'
            },
            {
              amount: 0,
              script: '6a1e43430102fa9213bc243af03857d0f9165e971153586d3915201201201210'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2, 3],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var path = "m/44'/1'/0'";
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        var signatures = await key.sign(path, txp);
        signatures.length.should.be.equal(utxos.length);
      });
      it('should sign btc proposal correctly', async () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: 3,
          coin: 'btc',
          inputs: utxos,
          outputs: [
            {
              toAddress: toAddress,
              amount: 800,
              message: 'first output'
            },
            {
              toAddress: toAddress,
              amount: 900,
              message: 'second output'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var path = "m/44'/1'/0'";
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        var signatures = await key.sign(path, txp);

        signatures.length.should.be.equal(utxos.length);
        signatures[0].should.equal(
          '3045022100cfacaf8e4c9782f33f717eba3162d44cf9f34d9768a3bcd66b7052eb0868a0880220015e930e1f7d9a8b6b9e54d1450556bf4ba95c2cf8ef5c55d97de7df270cc6fd'
        );
        signatures[1].should.equal(
          '3044022069cf6e5d8700ff117f754e4183e81690d99d6a6443e86c9589efa072ecb7d82c02204c254506ac38774a2176f9ef56cc239ef7867fbd24da2bef795128c75a063301'
        );
      });

      it('should sign btc proposal correctly (tx V2)', async () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: 4,
          coin: 'btc',
          inputs: utxos,
          outputs: [
            {
              toAddress: toAddress,
              amount: 800,
              message: 'first output'
            },
            {
              toAddress: toAddress,
              amount: 900,
              message: 'second output'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var path = "m/44'/1'/0'";
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        var signatures = await key.sign(path, txp);

        signatures.length.should.be.equal(utxos.length);
        signatures[0].should.equal(
          '3045022100da83ffb02ce0c5c7f2b30d0eb2fd62d1177d282fff5ce7deb9d3a8fd6e002c9d022030f0f0b29dd1fb9b602c50e8916568aa0dd68054523989291decfdbf36d70299'
        );
        signatures[1].should.equal(
          '3045022100951f980ad2fcd764a7824575e18aa4f28309b7160c353a0e3d239bff83050184022039c4ab5be5c40d19cd2c8bfcbf42a6262df851454a494ad78668be7d35519f05'
        );
      });

      it('should sign eth proposal correctly', async () => {
        const toAddress = '0xa062a07a0a56beb2872b12f388f511d694626730';
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        const path = "m/44'/60'/0'";
        const publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPrivateKey(masterPrivateKey).deriveChild(path).toString()
          }
        ];

        const from = Utils.deriveAddress('P2PKH', publicKeyRing, 'm/0/0', 1, 'livenet', 'eth');

        const txp = {
          version: 3,
          from: from.address,
          coin: 'eth',
          outputs: [
            {
              toAddress: toAddress,
              amount: 3896000000000000,
              gasLimit: 21000,
              message: 'first output'
            }
          ],
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 420000000000000,
          nonce: 6,
          gasPrice: 20000000000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
          amount: 3896000000000000
        };
        const signatures = await key.sign(path, txp);
        const expectedSignatures = [
          '0x4f761cd5f1cf1008d398c854ee338f82b457dc67ae794a987083b36b83fc6c917247fe72fe1880c0ee914c6e1b608625d8ab4e735520c33b2f7f76e0dcaf59801c'
        ];
        signatures.should.deep.equal(expectedSignatures);
      });
      it('should sign BCH proposal correctly', async () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: 3,
          coin: 'bch',
          signingMethod: 'ecdsa',
          inputs: utxos,
          outputs: [
            {
              toAddress: toAddress,
              amount: 800,
              message: 'first output'
            },
            {
              toAddress: toAddress,
              amount: 900,
              message: 'second output'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var path = "m/44'/1'/0'";
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        var signatures = await key.sign(path, txp);

        signatures.length.should.be.equal(utxos.length);
        signatures[0].should.equal(
          '304402200aa70dfe99e25792c4a7edf773477100b6659f1ba906e551e6e5218ec32d273402202e31c575edb55b2da824e8cafd02b4769017ef63d3c888718cf6f0243c570d41'
        );
        signatures[1].should.equal(
          '3045022100afde45e125f654453493b40d288cd66e8a011c66484509ae730a2686c9dff30502201bf34a6672c5848dd010b89ea1a5f040731acf78fec062f61b305e9ce32798a5'
        );
      });

      it('should sign BCH proposal correctly (schnorr)', async () => {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [
          {
            xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44'])
          }
        ];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: 3,
          coin: 'bch',
          signingMethod: 'schnorr',
          inputs: utxos,
          outputs: [
            {
              toAddress: toAddress,
              amount: 800,
              message: 'first output'
            },
            {
              toAddress: toAddress,
              amount: 900,
              message: 'second output'
            }
          ],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH'
        };
        var path = "m/44'/1'/0'";
        var key = new Key({ seedData: masterPrivateKey, seedType: 'extendedPrivateKey' });
        var signatures = await key.sign(path, txp);

        signatures.length.should.be.equal(utxos.length);
        signatures[0].should.equal(
          '8127bbe9a3627fb307c3e919a2dd2dd69b22aaaa363abbda1d44a305fc8ec98ae082f3c3439c54c49ab20e6cc4ad0a077750583758de5a09b1d50d91befe30de'
        );
        signatures[1].should.equal(
          '6b1494a6e8121215f40268f58b728585589c6933844b9bbcdae3fdd69be7c000d72c06143f554c5f9fd858a14e9d11cbb7c141901d8fc701c1f3c8c7328d6dc7'
        );
      });

      it('should sign SOL proposal correctly', async () => {
        const phrase = 'crush desk brain index action subject tackle idea trim unveil lawn live';
        let k  = new Key({ seedData: phrase, seedType: 'mnemonic', algo: 'EDDSA'});
        const toAddress = 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY';
        const from = '7EWwMxKQa5Gru7oTcS1Wi3AaEgTfA6MU3z7MaLUT6hnD';
        const txp = {
          version: 3,
          from: from,
          coin: 'sol',
          chain: 'sol',
          outputs: [
            {
              toAddress: toAddress,
              amount: 3896000000000000,
            }
          ],
          fee: 5000,
          blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
          blockHeight: 18446744,
          amount: 389600000
        };
        const path = "m/44'/501'/0'";
        const signatures = await k.sign(path, txp);
        signatures.length.should.be.equal(1);
        signatures[0].should.equal(
          '2Y17QoXHgW8zHHY9KSCYyYXaw5ZyNqYmSRndD3HReFyxQVNc8xtA1syZ8exEwAKH9NBNhz4FYZsraYX21oqM5T5Q'
        );
      });
    });
  });

  describe('Wallet secret round trip', () => {
    for (let i = 0; i < 20; i++) {
      const network = ['testnet', 'livenet', 'regtest'][i % 3];
      const coin = ['bch', 'btc', 'doge', 'ltc'][i % 4];

      it(`should create secret and parse secret: ${i} - ${coin}:${network}`, () => {
        var walletId = Uuid.v4();
        var walletPrivKey = new Bitcore.PrivateKey();
        var secret = Client._buildSecret(walletId, walletPrivKey, coin, network);
        var result = Client.parseSecret(secret);
        result.walletId.should.equal(walletId);
        result.walletPrivKey.toString().should.equal(walletPrivKey.toString());
        result.coin.should.equal(coin);
        result.network.should.equal(network);
      });
    }
    it('should fail on invalid secret', () => {
      (() => {
        Client.parseSecret('invalidSecret');
      }).should.throw('Invalid secret');
    });

    it('should create secret and parse secret from string', () => {
      var walletId = Uuid.v4();
      var walletPrivKey = new Bitcore.PrivateKey();
      var coin = 'btc';
      var network = 'testnet';
      var secret = Client._buildSecret(walletId, walletPrivKey.toString(), coin, network);
      var result = Client.parseSecret(secret);
      result.walletId.should.equal(walletId);
      result.walletPrivKey.toString().should.equal(walletPrivKey.toString());
      result.coin.should.equal(coin);
      result.network.should.equal(network);
    });
    it('should default to btc for secrets not specifying coin', () => {
      var result = Client.parseSecret('5ZN64RxKWCJXcy1pZwgrAzL1NnN5FQic5M2tLJVG5bEHaGXNRQs2uzJjMa9pMAbP5rz9Vu2xSaT');
      result.coin.should.equal('btc');
    });
  });

  describe('Notification polling', () => {
    var clock, interval;
    beforeEach(() => {
      clock = sandbox.useFakeTimers({ now: 1234000, toFake: ['Date'] });
    });
    afterEach(() => {
      clock.restore();
    });
    it('should fetch notifications at intervals', function(done) {
      helpers.createAndJoinWallet(clients, keys, 2, 2, {}, () => {
        clients[0].on('notification', data => {
          notifications.push(data);
        });

        var notifications = [];
        clients[0]._fetchLatestNotifications(5, (err) => {
          should.not.exist(err);
          notifications.map(n => n.type).should.deep.equal(['NewCopayer', 'WalletComplete']);
          clock.tick(2000);
          notifications = [];

          clients[0]._fetchLatestNotifications(5, () => {
            notifications.length.should.equal(0);
            clock.tick(2000);
            clients[1].createAddress(null, (err, x) => {
              should.not.exist(err);
              clients[0]._fetchLatestNotifications(5, () => {
                notifications.map(n => n.type).should.deep.equal(['NewAddress']);
                clock.tick(2000);
                notifications = [];
                clients[0]._fetchLatestNotifications(5, () => {
                  notifications.length.should.equal(0);
                  clients[1].createAddress(null, (err, x) => {
                    should.not.exist(err);
                    clock.tick(60 * 1000);
                    clients[0]._fetchLatestNotifications(5, () => {
                      notifications.length.should.equal(0);
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
  });

  describe('Wallet Creation', () => {
    var k;

    beforeEach(function(done) {
      k = new Key({ seedType:'new'});
      db.dropDatabase(err => {
        return done(err);
      });
    });

    it('should fail to create wallet in bogus device', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      clients[0].keyDerivationOk = false;
      clients[0].createWallet('mywallet', 'pepe', 1, 1, {}, (err, secret) => {
        should.exist(err);
        err.toString().should.contain('Cannot');
        should.not.exist(secret);
        done();
      });
    });

    it('should encrypt wallet name', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      var spy = sandbox.spy(clients[0].request, 'post');
      clients[0].createWallet('mywallet', 'pepe', 1, 1, {}, (err, secret) => {
        should.not.exist(err);
        var url = spy.getCall(0).args[0];
        var body = JSON.stringify(spy.getCall(0).args[1]);
        url.should.contain('/wallets');
        body.should.not.contain('mywallet');
        clients[0].getStatus({}, (err, status) => {
          should.not.exist(err);
          status.wallet.name.should.equal('mywallet');
          done();
        });
      });
    });

    it('should encrypt copayer name in wallet creation', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      var spy = sandbox.spy(clients[0].request, 'post');
      clients[0].createWallet('mywallet', 'pepe', 1, 1, {}, (err, secret) => {
        should.not.exist(err);
        var url = spy.getCall(1).args[0];
        var body = JSON.stringify(spy.getCall(1).args[1]);
        url.should.contain('/copayers');
        body.should.not.contain('pepe');
        clients[0].getStatus({}, (err, status) => {
          should.not.exist(err);
          status.wallet.copayers[0].name.should.equal('pepe');
          done();
        });
      });
    });

    it('should be able to access wallet name in non-encrypted wallet (legacy)', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      var wpk = new Bitcore.PrivateKey();
      var args = {
        name: 'mywallet',
        m: 1,
        n: 1,
        pubKey: wpk.toPublicKey().toString(),
        network: 'livenet',
        id: '123'
      };
      clients[0].request.post('/v2/wallets/', args, (err, wallet) => {
        should.not.exist(err);
        var c = clients[0].credentials;

        var args = {
          walletId: '123',
          name: 'pepe',
          xPubKey: c.xPubKey,
          requestPubKey: c.requestPubKey,
          customData: Utils.encryptMessage(
            JSON.stringify({
              walletPrivKey: wpk.toString()
            }),
            c.personalEncryptingKey
          ),
          copayerSignature: undefined
        };
        var hash = Utils.getCopayerHash(args.name, args.xPubKey, args.requestPubKey);
        args.copayerSignature = Utils.signMessage(hash, wpk);
        clients[0].request.post('/v2/wallets/123/copayers', args, (err, wallet) => {
          should.not.exist(err);
          clients[0].openWallet(null, err => {
            should.not.exist(err);
            clients[0].getStatus({}, (err, status) => {
              should.not.exist(err);
              var wallet = status.wallet;
              wallet.name.should.equal('mywallet');
              should.not.exist(wallet.encryptedName);
              wallet.copayers[0].name.should.equal('pepe');
              should.not.exist(wallet.copayers[0].encryptedName);
              done();
            });
          });
        });
      });
    });

    it('should check balance in a 1-1 ', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].getBalance({}, (err, balance) => {
          should.not.exist(err);
          balance.totalAmount.should.equal(0);
          balance.availableAmount.should.equal(0);
          balance.lockedAmount.should.equal(0);
          done();
        });
      });
    });

    it('should be able to complete wallet in copayer that joined later', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, () => {
        clients[0].getBalance({}, (err, x) => {
          should.not.exist(err);
          clients[1].getBalance({}, (err, x) => {
            should.not.exist(err);
            clients[2].getBalance({}, (err, x) => {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should fire event when wallet is complete', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 2
        })
      );

      var checks = 0;

      clients[0].on('walletCompleted', wallet => {
        wallet.name.should.equal('mywallet');
        wallet.status.should.equal('complete');
        clients[0].isComplete().should.equal(true);
        clients[0].credentials.isComplete().should.equal(true);
        if (++checks == 2) done();
      });
      clients[0].createWallet('mywallet', 'creator', 2, 2, {}, (err, secret) => {
        should.not.exist(err);
        clients[0].isComplete().should.equal(false);
        clients[0].credentials.isComplete().should.equal(false);

        let k2 = new Key({ seedType:'new'});
        clients[1].fromString(
          k2.createCredentials(null, {
            coin: 'btc',
            network: 'livenet',
            account: 1,
            n: 2
          })
        );

        clients[1].joinWallet(secret, 'guest', {}, (err, wallet) => {
          should.not.exist(err);
          wallet.name.should.equal('mywallet');
          clients[0].openWallet(null, (err, walletStatus) => {
            should.not.exist(err);
            should.exist(walletStatus);
            (walletStatus.copayers || []).every(c => ['creator', 'guest'].includes(c.name)).should.be.true;
            if (++checks == 2) done();
          });
        });
      });
    });

    it('should fill wallet info in an incomplete wallet', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 3
        })
      );

      clients[0].createWallet('XXX', 'creator', 2, 3, {}, (err, secret) => {
        should.not.exist(err);
        let k2 = new Key({ seedData: k.get(null, true).mnemonic, seedType: 'mnemonic' });
        clients[1].fromString(
          k2.createCredentials(null, {
            coin: 'btc',
            network: 'livenet',
            account: 0,
            n: 3
          })
        );

        clients[1].openWallet(null, err => {
          clients[1].credentials.walletName.should.equal('XXX');
          clients[1].credentials.m.should.equal(2);
          clients[1].credentials.n.should.equal(3);
          should.not.exist(err);
          done();
        });
      });
    });

    it('should return wallet on successful join', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 2
        })
      );

      clients[0].createWallet(
        'mywallet',
        'creator',
        2,
        2,
        {
          network: 'testnet'
        },
        (err, secret) => {
          should.not.exist(err);
          let k2 = new Key({ seedType:'new'});
          clients[1].fromString(
            k2.createCredentials(null, {
              coin: 'btc',
              network: 'testnet',
              account: 5,
              n: 2
            })
          );
          clients[0].credentials.rootPath.should.equal("m/48'/1'/0'");
          clients[1].credentials.rootPath.should.equal("m/48'/1'/5'");

          clients[1].joinWallet(secret, 'guest', {}, (err, wallet) => {
            should.not.exist(err);
            wallet.name.should.equal('mywallet');
            wallet.copayers[0].name.should.equal('creator');
            wallet.copayers[1].name.should.equal('guest');
            done();
          });
        }
      );
    });

    it('should not allow to join wallet on bogus device', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 2
        })
      );

      clients[0].createWallet(
        'mywallet',
        'creator',
        2,
        2,
        {
          network: 'testnet'
        },
        (err, secret) => {
          should.not.exist(err);
          let k2 = new Key({ seedType:'new'});
          clients[1].fromString(
            k2.createCredentials(null, {
              coin: 'btc',
              network: 'testnet',
              account: 5,
              n: 2
            })
          );

          clients[1].keyDerivationOk = false;
          clients[1].joinWallet(secret, 'guest', {}, (err, wallet) => {
            should.exist(err);
            done();
          });
        }
      );
    });

    it('should not allow to join a full wallet ', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 2
        })
      );

      helpers.createAndJoinWallet(clients, keys, 2, 2, {}, w => {
        should.exist(w.secret);

        clients[4].fromString(
          k.createCredentials(null, {
            coin: 'btc',
            network: 'testnet',
            account: 0,
            n: 2
          })
        );

        clients[4].joinWallet(w.secret, 'copayer', {}, (err, result) => {
          err.should.be.an.instanceOf(Errors.WALLET_FULL);
          done();
        });
      });
    });

    it('should fail with an invalid secret', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 2
        })
      );

      // Invalid
      clients[0].joinWallet('dummy', 'copayer', {}, (err, result) => {
        err.message.should.contain('Invalid secret');
        // Right length, invalid char for base 58
        clients[0].joinWallet(
          'DsZbqNQQ9LrTKU8EknR7gFKyCQMPg2UUHNPZ1BzM5EbJwjRZaUNBfNtdWLluuFc0f7f7sTCkh7T',
          'copayer',
          {},
          (err, result) => {
            err.message.should.contain('Invalid secret');
            done();
          }
        );
      });
    });

    it('should fail with an unknown secret', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 2
        })
      );

      // Unknown walletId
      var oldSecret = '3bJKRn1HkQTpwhVaJMaJ22KwsjN24ML9uKfkSrP7iDuq91vSsTEygfGMMpo6kWLp1pXG9wZSKcT';
      clients[0].joinWallet(oldSecret, 'copayer', {}, (err, result) => {
        err.should.be.an.instanceOf(Errors.WALLET_NOT_FOUND);
        done();
      });
    });

    it('should detect wallets with bad signatures', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sandbox.stub(clients[1], 'openWallet').resolves();

      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, () => {
        helpers.tamperResponse(
          [clients[0], clients[1]],
          'get',
          '/v1/wallets/',
          {},
          status => {
            status.wallet.copayers[0].xPubKey = status.wallet.copayers[1].xPubKey;
          },
          () => {
            openWalletStub.restore();

            clients[1].openWallet(null, (err, x) => {
              err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
              done();
            });
          }
        );
      });
    });

    it('should detect wallets with missing signatures', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sandbox.stub(clients[1], 'openWallet').resolves();

      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, () => {
        helpers.tamperResponse(
          [clients[0], clients[1]],
          'get',
          '/v1/wallets/',
          {},
          status => {
            delete status.wallet.copayers[1].xPubKey;
          },
          () => {
            openWalletStub.restore();
            clients[1].openWallet(null, (err, x) => {
              err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
              done();
            });
          }
        );
      });
    });

    it('should detect wallets missing callers pubkey', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sandbox.stub(clients[1], 'openWallet').resolves();

      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, () => {
        helpers.tamperResponse(
          [clients[0], clients[1]],
          'get',
          '/v1/wallets/',
          {},
          status => {
            // Replace caller's pubkey
            status.wallet.copayers[1].xPubKey = new Bitcore.HDPrivateKey().publicKey;
            // Add a correct signature
            status.wallet.copayers[1].xPubKeySignature = Utils.signMessage(
              status.wallet.copayers[1].xPubKey.toString(),
              clients[0].credentials.walletPrivKey
            );
          },
          () => {
            openWalletStub.restore();
            clients[1].openWallet(null, (err, x) => {
              err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
              done();
            });
          }
        );
      });
    });

    it('should perform a dry join without actually joining', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 2
        })
      );

      clients[0].createWallet('mywallet', 'creator', 1, 2, {}, (err, secret) => {
        should.not.exist(err);
        should.exist(secret);
        clients[1].fromString(
          k.createCredentials(null, {
            coin: 'btc',
            network: 'livenet',
            account: 1,
            n: 2
          })
        );
        clients[1].joinWallet(
          secret,
          'dummy',
          {
            dryRun: true
          },
          (err, wallet) => {
            should.not.exist(err);
            should.exist(wallet);
            wallet.status.should.equal('pending');
            wallet.copayers.length.should.equal(1);
            done();
          }
        );
      });
    });

    it('should return wallet status even if wallet is not yet complete', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 2
        })
      );

      clients[0].createWallet(
        'mywallet',
        'creator',
        1,
        2,
        {
          network: 'testnet'
        },
        (err, secret) => {
          should.not.exist(err);
          should.exist(secret);

          clients[0].getStatus({}, (err, status) => {
            should.not.exist(err);
            should.exist(status);
            status.wallet.status.should.equal('pending');
            should.exist(status.wallet.secret);
            status.wallet.secret.should.equal(secret);
            done();
          });
        }
      );
    });

    it('should return status using v2 version', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 1
        })
      );

      clients[0].createWallet(
        'mywallet',
        'creator',
        1,
        1,
        {
          network: 'testnet'
        },
        (err, secret) => {
          should.not.exist(err);
          clients[0].getStatus({}, (err, status) => {
            should.not.exist(err);
            should.not.exist(status.wallet.publicKeyRing);
            status.wallet.status.should.equal('complete');
            done();
          });
        }
      );
    });

    it('should return extended status using v2 version', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 1
        })
      );

      clients[0].createWallet(
        'mywallet',
        'creator',
        1,
        1,
        {
          network: 'testnet'
        },
        (err, secret) => {
          should.not.exist(err);
          clients[0].getStatus(
            {
              includeExtendedInfo: true
            },
            (err, status) => {
              should.not.exist(err);
              status.wallet.publicKeyRing.length.should.equal(1);
              status.wallet.status.should.equal('complete');
              done();
            }
          );
        }
      );
    });

    it('should store walletPrivKey', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 1
        })
      );

      clients[0].createWallet(
        'mywallet',
        'creator',
        1,
        1,
        {
          network: 'testnet'
        },
        err => {
          var key = clients[0].credentials.walletPrivKey;
          should.not.exist(err);
          clients[0].getStatus(
            {
              includeExtendedInfo: true
            },
            (err, status) => {
              should.not.exist(err);
              status.wallet.publicKeyRing.length.should.equal(1);
              status.wallet.status.should.equal('complete');
              var key2 = status.customData.walletPrivKey;

              clients[0].credentials.walletPrivKey.should.be.equal(key2);
              done();
            }
          );
        }
      );
    });

    it('should set walletPrivKey from BWS', function(done) {
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 1
        })
      );

      clients[0].createWallet(
        'mywallet',
        'creator',
        1,
        1,
        {
          network: 'testnet'
        },
        err => {
          var wkey = clients[0].credentials.walletPrivKey;
          var skey = clients[0].credentials.sharedEncryptingKey;
          delete clients[0].credentials.walletPrivKey;
          delete clients[0].credentials.sharedEncryptingKey;
          should.not.exist(err);
          clients[0].getStatus(
            {
              includeExtendedInfo: true
            },
            (err, status) => {
              should.not.exist(err);
              clients[0].credentials.walletPrivKey.should.equal(wkey);
              clients[0].credentials.sharedEncryptingKey.should.equal(skey);
              done();
            }
          );
        }
      );
    });

    it('should create a 1-1 wallet with given mnemonic', function(done) {
      var c = new Key({
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        seedType: 'mnemonic'
      });
      c.get(null).xPrivKey.should.equal(
        'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu'
      );
      clients[0].fromString(
        c.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );
      clients[0].createWallet(
        'mywallet',
        'creator',
        1,
        1,
        {
          network: 'livenet'
        },
        err => {
          should.not.exist(err);
          clients[0].openWallet(null, err => {
            should.not.exist(err);
            clients[0].credentials.xPubKey.should.equal(
              'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
            );
            should.not.exist(clients[0].credentials.xPrivKey);
            done();
          });
        }
      );
    });

    it('should create a 2-3 wallet with given mnemonic', function(done) {
      var c = new Key({
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        seedType: 'mnemonic'
      });
      c.get(null).xPrivKey.should.equal(
        'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu'
      );
      clients[0].fromString(
        c.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 3
        })
      );
      clients[0].createWallet(
        'mywallet',
        'creator',
        2,
        3,
        {
          network: 'livenet'
        },
        (err, secret) => {
          should.not.exist(err);
          should.exist(secret);
          clients[0].openWallet(null, err => {
            should.not.exist(err);
            clients[0].credentials.xPubKey.should.equal(
              'xpub6CKZtUaK1YHpQbg6CLaGRmsMKLQB1iKzsvmxtyHD6X7gzLqCB2VNZYd1XCxrccQnE8hhDxtYbR1Sakkvisy2J4CcTxWeeGjmkasCoNS9vZm'
            );
            done();
          });
        }
      );
    });

    it('should create Bitcoin Cash wallet', function(done) {
      let k = new Key({ seedType:'new'});
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'bch',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      clients[0].createWallet(
        'mycashwallet',
        'pepe',
        1,
        1,
        {
          coin: 'bch'
        },
        (err, secret) => {
          should.not.exist(err);
          clients[0].getStatus({}, (err, status) => {
            should.not.exist(err);
            status.wallet.coin.should.equal('bch');
            done();
          });
        }
      );
    });

    it('should create a BCH  address correctly', function(done) {
      var xPriv =
        'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu';
      let k = new Key({ seedData: xPriv, useLegacyCoinType: true, seedType: 'extendedPrivateKey' });
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'bch',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );

      clients[0].createWallet(
        'mycashwallet',
        'pepe',
        1,
        1,
        {
          coin: 'bch'
        },
        (err, secret) => {
          should.not.exist(err);

          clients[0].createAddress(null, (err, x) => {
            should.not.exist(err);
            x.coin.should.equal('bch');
            x.network.should.equal('livenet');
            x.address.should.equal('qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gms8s0u59');
            done();
          });
        }
      );
    });

    it('should create a P2WPKH wallet and derive a valid Segwit address', function(done) {
      helpers.createAndJoinWallet(
        clients,
        keys,
        1,
        1,
        { network: 'livenet', addressType: 'P2WPKH', useNativeSegwit: true },
        w => {
          clients[0].createAddress(null, (err, client) => {
            should.not.exist(err);
            client.address.should.include('bc1');
            client.address.length.should.equal(42);
            client.type.should.equal('P2WPKH');
            done();
          });
        }
      );
    });

    it('should create a P2WPKH testnet wallet and derive a valid Segwit testnet address', function(done) {
      helpers.createAndJoinWallet(
        clients,
        keys,
        1,
        1,
        { network: 'testnet', addressType: 'P2WPKH', useNativeSegwit: true },
        w => {
          clients[0].createAddress(null, (err, client) => {
            should.not.exist(err);
            client.address.should.include('tb1');
            client.address.length.should.equal(42);
            client.type.should.equal('P2WPKH');
            done();
          });
        }
      );
    });

    it('should create a P2WSH wallet and derive a valid Segwit address', function(done) {
      helpers.createAndJoinWallet(
        clients,
        keys,
        1,
        2,
        { network: 'livenet', addressType: 'P2WSH', useNativeSegwit: true },
        w => {
          clients[0].createAddress(null, (err, client) => {
            should.not.exist(err);
            client.address.should.include('bc1');
            client.address.length.should.equal(62);
            client.type.should.equal('P2WSH');
            done();
          });
        }
      );
    });

    it('should create a P2WSH testnet wallet and derive a valid Segwit testnet address', function(done) {
      helpers.createAndJoinWallet(
        clients,
        keys,
        1,
        2,
        { network: 'testnet', addressType: 'P2WSH', useNativeSegwit: true },
        w => {
          clients[0].createAddress(null, (err, client) => {
            should.not.exist(err);
            client.address.should.include('tb1');
            client.address.length.should.equal(62);
            client.type.should.equal('P2WSH');
            done();
          });
        }
      );
    });
  });

  describe('#getMainAddresses', () => {
    beforeEach(function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          clients[0].createAddress(null, (err, x0) => {
            should.not.exist(err);
            blockchainExplorerMock.setUtxo(x0, 1, 1);
            done();
          });
        });
      });
    });
    it('Should return all main addresses', function(done) {
      clients[0].getMainAddresses(
        {
          doNotVerify: true
        },
        (err, addr) => {
          should.not.exist(err);
          addr.length.should.equal(2);
          done();
        }
      );
    });
    it('Should return only main addresses when change addresses exist', function(done) {
      var opts = {
        amount: 0.1e8,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'hello 1-1'
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.not.exist(err);
        clients[0].getMainAddresses({}, (err, addr) => {
          should.not.exist(err);
          addr.length.should.equal(2);
          for(const a of addr) {
            a.isChange?.should.not.equal(true);
          }
          done();
        });
      });
    });
  });

  describe('#getUtxos', () => {
    beforeEach(function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
        done();
      });
    });
    it('Should return UTXOs', function(done) {
      clients[0].getUtxos({}, (err, utxos) => {
        should.not.exist(err);
        utxos.length.should.equal(0);
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          clients[0].getUtxos({}, (err, utxos) => {
            should.not.exist(err);
            utxos.length.should.equal(1);
            done();
          });
        });
      });
    });
    it('Should return UTXOs for specific addresses', async function() {
      const range0to2 = Array.from({ length: 3 }, (_, i) => i);
      const addresses: string[] = [];
      for (const i of range0to2) {
        const x = await clients[0].createAddress();
        should.exist(x.address);
        blockchainExplorerMock.setUtxo(x, 1, 1);
        addresses.push(x.address);
      }
      const utxos = await clients[0].getUtxos({ addresses: [addresses[0]]});
      utxos.length.should.equal(1);
      utxos.reduce((sum, utxo) => sum += utxo.satoshis, 0).should.equal(1 * 1e8);
    });
  });

  describe('Network fees', () => {
    it('should get current fee levels for BTC', function(done) {
      blockchainExplorerMock.setFeeLevels({
        1: 40000,
        3: 20000,
        10: 18000
      });
      clients[0].credentials = {} as Credentials;
      clients[0].getFeeLevels('btc', 'livenet', (err, levels) => {
        should.not.exist(err);
        Array.isArray(levels).should.be.true;
        should.exist(levels.find(l => l.level === 'priority'));
        should.exist(levels.find(l => l.level === 'normal'));
        should.exist(levels.find(l => l.level === 'economy'));
        done();
      });
    });
    it('should get default fee levels for BCH', function(done) {
      blockchainExplorerMock.setFeeLevels({});
      clients[0].credentials = {} as Credentials;
      clients[0].getFeeLevels('bch', 'livenet', (err, levels) => {
        should.not.exist(err);
        should.exist(levels);
        levels[0].level.should.equal('normal');
        levels[0].feePerKb.should.equal(2100);
        done();
      });
    });
  });

  describe('Version', () => {
    it('should get version of bws', function(done) {
      clients[0].credentials = {} as Credentials;
      clients[0].getVersion((err, version) => {
        if (err) {
          // if bws is older version without getVersion support
          err.should.be.an.instanceOf(Errors.NOT_FOUND);
        } else {
          // if bws is up-to-date
          should.exist(version);
          should.exist(version.serviceVersion);
          version.serviceVersion.should.contain('bws-');
        }
        done();
      });
    });
  });

  describe('Preferences', () => {
    it('should save and retrieve preferences', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].getPreferences((err, preferences) => {
          should.not.exist(err);
          preferences.should.be.empty;
          clients[0].savePreferences(
            {
              email: 'dummy@dummy.com'
            },
            err => {
              should.not.exist(err);
              clients[0].getPreferences((err, preferences) => {
                should.not.exist(err);
                should.exist(preferences);
                preferences.email.should.equal('dummy@dummy.com');
                done();
              });
            }
          );
        });
      });
    });

    it('should save and retrieve matic token addresses', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {coin: 'matic', chain: 'matic'}, () => {
        clients[0].getPreferences((err, preferences) => {
          should.not.exist(err);
          preferences.should.be.empty;
          clients[0].savePreferences(
            {
              maticTokenAddresses: ['0x2791bca1f2de4661ed88a30c99a7a9449aa84174']
            },
            err => {
              should.not.exist(err);
              clients[0].getPreferences((err, preferences) => {
                should.not.exist(err);
                should.exist(preferences);
                preferences.maticTokenAddresses[0].should.exist;
                preferences.maticTokenAddresses[0].should.equal('0x2791bca1f2de4661ed88a30c99a7a9449aa84174');
                done();
              });
            }
          );
        });
      });
    });

    it('should save and retrieve matic multisig address', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {coin: 'matic', chain: 'matic'}, () => {
        clients[0].getPreferences((err, preferences) => {
          should.not.exist(err);
          preferences.should.be.empty;
          clients[0].savePreferences(
            {
              multisigMaticInfo: [{
                walletName: 'myWallet',
                multisigContractAddress: '0xeC20607aa654D823DD01BEB8780a44863c57Ed07',
                n: 0,
                m: 1
              }]
            },
            err => {
              should.not.exist(err);
              clients[0].getPreferences((err, preferences) => {
                should.not.exist(err);
                should.exist(preferences);
                preferences.multisigMaticInfo[0].should.exist;
                preferences.multisigMaticInfo[0].multisigContractAddress.should.equal('0xeC20607aa654D823DD01BEB8780a44863c57Ed07');
                done();
              });
            }
          );
        });
      });
    });

    it('should save and retrieve op token addresses', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {coin: 'eth', chain: 'op'}, () => {
        clients[0].getPreferences((err, preferences) => {
          should.not.exist(err);
          preferences.should.be.empty;
          clients[0].savePreferences(
            {
              opTokenAddresses: ['0x0b2c639c533813f4aa9d7837caf62653d097ff85']
            },
            err => {
              should.not.exist(err);
              clients[0].getPreferences((err, preferences) => {
                should.not.exist(err);
                should.exist(preferences);
                preferences.opTokenAddresses[0].should.exist;
                preferences.opTokenAddresses[0].should.equal('0x0b2c639c533813f4aa9d7837caf62653d097ff85');
                done();
              });
            }
          );
        });
      });
    });

    it('should save and retrieve base token addresses', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {coin: 'eth', chain: 'base'}, () => {
        clients[0].getPreferences((err, preferences) => {
          should.not.exist(err);
          preferences.should.be.empty;
          clients[0].savePreferences(
            {
              baseTokenAddresses: ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913']
            },
            err => {
              should.not.exist(err);
              clients[0].getPreferences((err, preferences) => {
                should.not.exist(err);
                should.exist(preferences);
                preferences.baseTokenAddresses[0].should.exist;
                preferences.baseTokenAddresses[0].should.equal('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
                done();
              });
            }
          );
        });
      });
    });

    it('should save and retrieve arb token addresses', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {coin: 'eth', chain: 'arb'}, () => {
        clients[0].getPreferences((err, preferences) => {
          should.not.exist(err);
          preferences.should.be.empty;
          clients[0].savePreferences(
            {
              arbTokenAddresses: ['0xaf88d065e77c8cc2239327c5edb3a432268e5831']
            },
            err => {
              should.not.exist(err);
              clients[0].getPreferences((err, preferences) => {
                should.not.exist(err);
                should.exist(preferences);
                preferences.arbTokenAddresses[0].should.exist;
                preferences.arbTokenAddresses[0].should.equal('0xaf88d065e77c8cc2239327c5edb3a432268e5831');
                done();
              });
            }
          );
        });
      });
    });
  });

  describe('Fiat rates', () => {
    it('should get fiat exchange rate', function(done) {
      var now = Date.now();
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].getFiatRate(
          {
            code: 'USD',
            ts: now
          },
          (err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.ts.should.equal(now);
            should.not.exist(res.rate);
            done();
          }
        );
      });
    });
  });

  describe('Push notifications', () => {
    it('should do a post request', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].request.doRequest = sandbox.stub().resolves({
          body: { statusCode: 200 }
        });
        clients[0].pushNotificationsSubscribe(null, (err, res) => {
          should.not.exist(err);
          should.exist(res);
          res.statusCode.should.be.equal(200);
          done();
        });
      });
    });

    it('should do a delete request', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].request.doRequest = sandbox.stub().resolves({});
        clients[0].pushNotificationsUnsubscribe('123', err => {
          should.not.exist(err);
          done();
        });
      });
    });
  });

  describe('Tx confirmations', () => {
    it('should do a post request', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].request.doRequest = sandbox.stub().resolves({
          body: { statusCode: 200 }
        });
        clients[0].txConfirmationSubscribe(
          {
            txid: '123'
          },
          (err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.statusCode.should.be.equal(200);
            done();
          }
        );
      });
    });

    it('should do a delete request', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].request.doRequest = sandbox.stub().resolves({});
        clients[0].txConfirmationUnsubscribe('123', err => {
          should.not.exist(err);
          done();
        });
      });
    });
  });

  describe('Get send max information', () => {
    var balance;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].createAddress(null, (err, address) => {
          should.not.exist(err);
          should.exist(address.address);
          blockchainExplorerMock.setUtxo(address, 2, 1, 1);
          blockchainExplorerMock.setUtxo(address, 1, 1, 0);
          clients[0].getBalance({}, (err, bl) => {
            should.not.exist(err);
            balance = bl;
            done();
          });
        });
      });
    });
    it('should return send max info', function(done) {
      blockchainExplorerMock.setFeeLevels({
        1: 200e2
      });
      var opts = {
        feeLevel: 'priority' as const,
        excludeUnconfirmedUtxos: false,
        returnInputs: true
      };
      clients[0].getSendMaxInfo(opts, (err, result) => {
        should.not.exist(err);
        should.exist(result);
        result.inputs.length.should.be.equal(2);
        result.amount.should.be.equal(balance.totalAmount - result.fee);
        result.utxosBelowFee.should.be.equal(0);
        result.amountBelowFee.should.be.equal(0);
        result.utxosAboveMaxSize.should.be.equal(0);
        result.amountAboveMaxSize.should.be.equal(0);
        done();
      });
    });
    it('should return data excluding unconfirmed UTXOs', function(done) {
      var opts = {
        feePerKb: 200,
        excludeUnconfirmedUtxos: true,
        returnInputs: true
      };
      clients[0].getSendMaxInfo(opts, (err, result) => {
        should.not.exist(err);
        result.amount.should.be.equal(balance.availableConfirmedAmount - result.fee);
        done();
      });
    });
    it('should return data including unconfirmed UTXOs', function(done) {
      var opts = {
        feePerKb: 200,
        excludeUnconfirmedUtxos: false,
        returnInputs: true
      };
      clients[0].getSendMaxInfo(opts, (err, result) => {
        should.not.exist(err);
        result.amount.should.be.equal(balance.totalAmount - result.fee);
        done();
      });
    });
    it('should return data without inputs', function(done) {
      var opts = {
        feePerKb: 200,
        excludeUnconfirmedUtxos: true,
        returnInputs: false
      };
      clients[0].getSendMaxInfo(opts, (err, result) => {
        should.not.exist(err);
        result.inputs.length.should.be.equal(0);
        done();
      });
    });
    it('should return data with inputs', function(done) {
      var opts = {
        feePerKb: 200,
        excludeUnconfirmedUtxos: true,
        returnInputs: true
      };
      clients[0].getSendMaxInfo(opts, (err, result) => {
        should.not.exist(err);
        result.inputs.length.should.not.equal(0);
        var totalSatoshis = 0;
        for (const i of result.inputs) {
          totalSatoshis = totalSatoshis + i.satoshis;
        }
        result.amount.should.be.equal(totalSatoshis - result.fee);
        done();
      });
    });
  });

  describe('Address Creation', () => {
    it('should be able to create address in 1-of-1 wallet', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].createAddress(null, (err, x) => {
          should.not.exist(err);
          should.exist(x.address);
          x.address.charAt(0).should.not.equal('2');
          done();
        });
      });
    });
    it('should fail if key derivation is not ok', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        clients[0].keyDerivationOk = false;
        clients[0].createAddress(null, (err, address) => {
          should.exist(err);
          should.not.exist(address);
          err.message.should.contain('new address');
          done();
        });
      });
    });
    it('should be able to create address in all copayers in a 2-3 wallet', function(done) {
      this.timeout(5000);
      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, () => {
        clients[0].createAddress(null, (err, x) => {
          should.not.exist(err);
          should.exist(x.address);
          x.address.charAt(0).should.equal('2');
          clients[1].createAddress(null, (err, x) => {
            should.not.exist(err);
            should.exist(x.address);
            clients[2].createAddress(null, (err, x) => {
              should.not.exist(err);
              should.exist(x.address);
              done();
            });
          });
        });
      });
    });
    it('should see balance on address created by others', function(done) {
      // timeout(5000);
      helpers.createAndJoinWallet(clients, keys, 2, 2, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);

          blockchainExplorerMock.setUtxo(x0, 10, w.m);
          clients[0].getBalance({}, (err, bal0) => {
            should.not.exist(err);
            bal0.totalAmount.should.equal(10 * 1e8);
            bal0.lockedAmount.should.equal(0);
            clients[1].getBalance({}, (err, bal1) => {
              bal1.totalAmount.should.equal(10 * 1e8);
              bal1.lockedAmount.should.equal(0);
              done();
            });
          });
        });
      });
    });
    it('should detect fake addresses', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        helpers.tamperResponse(
          clients[0],
          'post',
          '/v3/addresses/',
          {},
          address => {
            address.address = '2N86pNEpREGpwZyHVC5vrNUCbF9nM1Geh4K';
          },
          () => {
            clients[0].createAddress(null, (err, x0) => {
              err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
              done();
            });
          }
        );
      });
    });
    it('should detect fake public keys', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        helpers.tamperResponse(
          clients[0],
          'post',
          '/v3/addresses/',
          {},
          address => {
            address.publicKeys = [
              '0322defe0c3eb9fcd8bc01878e6dbca7a6846880908d214b50a752445040cc5c54',
              '02bf3aadc17131ca8144829fa1883c1ac0a8839067af4bca47a90ccae63d0d8037'
            ];
          },
          () => {
            clients[0].createAddress(null, (err, x0) => {
              err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
              done();
            });
          }
        );
      });
    });
    it('should be able to derive 25 addresses', function(done) {
      this.timeout(5000);
      var num = 25;
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
        var create = callback => {
          clients[0].createAddress(
            {
              ignoreMaxGap: true
            },
            (err, x) => {
              if (err) console.log(err);
              should.not.exist(err);
              should.exist(x.address);
              callback(err, x);
            }
          );
        };

        var tasks = [];
        for (var i = 0; i < num; i++) {
          tasks.push(create);
        }

        // Node20 http performance improvements causes async.parallel to overwhelm the server, hence parallelLimt
        async.parallelLimit(tasks, 10, (err, results) => {
          should.not.exist(err);
          results.length.should.equal(num);
          done();
        });
      });
    });

    describe('ETH testnet address creation', () => {
      it('should be able to create address in 1-of-1 wallet', function(done) {
        var xPriv =
          'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu';
        let k  = new Key({ seedData: xPriv, seedType: 'extendedPrivateKey'});

        clients[0].fromString(
          k.createCredentials(null, {
            coin: 'eth',
            network: 'livenet',
            account: 0,
            n: 1
          })
        );
        clients[0].createWallet(
          'mywallet',
          'creator',
          1,
          1,
          {
            network: 'livenet',
            coin: 'eth'
          },
          err => {
            should.not.exist(err);
            clients[0].createAddress(null, (err, x0) => {
              clients[1].fromString(
                k.createCredentials(null, {
                  coin: 'eth',
                  network: 'testnet',
                  account: 0,
                  n: 1
                })
              );

              clients[1].createWallet(
                'mywallet',
                'creator',
                1,
                1,
                {
                  network: 'testnet',
                  coin: 'eth'
                },
                err => {
                  should.not.exist(err);
                  clients[1].createAddress(null, (err, x1) => {
                    clients[0].credentials.copayerId.should.not.equal(clients[1].credentials.copayerId);
                    // in ETH, same account address for livenet and testnet should match
                    x1.address.should.equal(x0.address);
                    done();
                  });
                }
              );
            });
          }
        );
      });
    });

    describe('SOL address creation', () => {
      it('should be able to create address in 1-of-1 wallet', function(done) {
        this.timeout(50000);
        var xPriv =
          'xprv9s21ZrQH143K3aKdQ6kXF1vj7R6LtkoLCiUXfM5bdbGXmhQkC1iXdnFfrxAAtaTunPUCCLwUQ3cpNixGLMbLAH1gzeCr8VZDe4gPgmKLb2X';
        let k  = new Key({ seedData: xPriv, seedType: 'extendedPrivateKey', algo: 'EDDSA'});

        clients[0].fromString(
          k.createCredentials(null, {
            coin: 'sol',
            network: 'livenet',
            account: 0,
            n: 1
          })
        );
        clients[0].createWallet(
          'mywallet',
          'creator',
          1,
          1,
          {
            network: 'livenet',
            coin: 'sol',
            singleAddress: true
          },
          err => {
            should.not.exist(err);
            clients[0].createAddress(null, (err, res) => {
              should.not.exist(err);
              res.address.should.equal('7EWwMxKQa5Gru7oTcS1Wi3AaEgTfA6MU3z7MaLUT6hnD');
              done(); 
            });
          }
        );
      });
    });
  });

  describe('Notifications', () => {
    var clock;
    beforeEach(function(done) {
      this.timeout(5000);
      clock = sandbox.useFakeTimers({ now: 1234000, toFake: ['Date'] });
      helpers.createAndJoinWallet(clients, keys, 2, 2, {}, () => {
        clock.tick(25 * 1000);
        clients[0].createAddress(null, (err, x) => {
          should.not.exist(err);
          clock.tick(25 * 1000);
          clients[1].createAddress(null, (err, x) => {
            should.not.exist(err);
            done();
          });
        });
      });
    });
    afterEach(() => {
      clock.restore();
    });
    it('should receive notifications', function(done) {
      clients[0].getNotifications({}, (err, notifications) => {
        should.not.exist(err);
        notifications.length.should.equal(3);
        notifications.map(n => n.type).should.deep.equal(['NewCopayer', 'WalletComplete', 'NewAddress']);
        clients[0].getNotifications(
          {
            lastNotificationId: notifications.slice(-1)[0].id
          },
          (err, notifications) => {
            should.not.exist(err);
            notifications.length.should.equal(0, 'should only return unread notifications');
            done();
          }
        );
      });
    });
    it('should not receive old notifications', function(done) {
      clock.tick(61 * 1000); // more than 60 seconds
      clients[0].getNotifications({}, (err, notifications) => {
        should.not.exist(err);
        notifications.length.should.equal(0);
        done();
      });
    });
    it('should not receive notifications for self generated events unless specified', function(done) {
      clients[0].getNotifications({}, (err, notifications) => {
        should.not.exist(err);
        notifications.length.should.equal(3);
        notifications.map(n => n.type).should.deep.equal(['NewCopayer', 'WalletComplete', 'NewAddress']);
        clients[0].getNotifications(
          {
            includeOwn: true
          },
          (err, notifications) => {
            should.not.exist(err);
            notifications.length.should.equal(5);
            notifications.map(n => n.type).should.deep.equal([
              'NewCopayer',
              'NewCopayer',
              'WalletComplete',
              'NewAddress',
              'NewAddress'
            ]);
            done();
          }
        );
      });
    });
  });

  describe('Transaction Proposals Creation and Locked funds', () => {
    var myAddress;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, w => {
        clients[0].createAddress(null, (err, address) => {
          should.not.exist(err);
          myAddress = address;
          blockchainExplorerMock.setUtxo(address, 2, 2);
          blockchainExplorerMock.setUtxo(address, 2, 2);
          blockchainExplorerMock.setUtxo(address, 1, 2, 0);
          done(err);
        });
      });
    });

    it('Should create & publish proposal', function(done) {
      blockchainExplorerMock.setFeeLevels({
        2: 123e2
      });
      var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
      var opts = {
        outputs: [
          {
            amount: 1e8,
            toAddress: toAddress,
            message: 'world'
          },
          {
            amount: 2e8,
            toAddress: toAddress
          }
        ],
        message: 'hello',
        customData: {
          someObj: {
            x: 1
          },
          someStr: 'str'
        }
      };
      clients[0].createTxProposal(opts, (err, txp) => {
        should.not.exist(err);
        should.exist(txp);

        txp.status.should.equal('temporary');
        txp.message.should.equal('hello');
        txp.outputs.length.should.equal(2);
        txp.outputs.reduce((sum, output) => sum += output.amount, 0).should.equal(3e8);
        txp.outputs[0].message.should.equal('world');
        new Set(txp.outputs.map(output => output.toAddress)).size.should.equal(1);
        Array.from(new Set(txp.outputs.map(o => o.toAddress)))[0].should.equal(toAddress);
        txp.hasUnconfirmedInputs.should.equal(false);
        txp.feeLevel.should.equal('normal');
        txp.feePerKb.should.equal(123e2);

        should.exist(txp.encryptedMessage);
        should.exist(txp.outputs[0].encryptedMessage);

        clients[0].getTxProposals({}, (err, txps) => {
          should.not.exist(err);
          txps.should.be.empty;

          clients[0].publishTxProposal(
            {
              txp: txp
            },
            (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              publishedTxp.status.should.equal('pending');
              clients[0].getTxProposals({}, (err, txps) => {
                should.not.exist(err);
                txps.length.should.equal(1);
                var x = txps[0];
                x.id.should.equal(txp.id);
                should.exist(x.proposalSignature);
                should.not.exist(x.proposalSignaturePubKey);
                should.not.exist(x.proposalSignaturePubKeySig);
                // Should be visible for other copayers as well
                clients[1].getTxProposals({}, (err, txps) => {
                  should.not.exist(err);
                  txps.length.should.equal(1);
                  txps[0].id.should.equal(txp.id);
                  done();
                });
              });
            }
          );
        });
      });
    });
    it('Should create, publish, recreate, republish proposal', function(done) {
      blockchainExplorerMock.setFeeLevels({
        1: 456e2,
        6: 123e2
      });
      var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
      var opts = {
        txProposalId: '1234',
        outputs: [
          {
            amount: 1e8,
            toAddress: toAddress,
            message: 'world'
          },
          {
            amount: 2e8,
            toAddress: toAddress
          }
        ],
        message: 'hello',
        feeLevel: 'economy' as const,
        customData: {
          someObj: {
            x: 1
          },
          someStr: 'str'
        }
      };
      clients[0].createTxProposal(opts, (err, txp) => {
        should.not.exist(err);
        should.exist(txp);
        txp.status.should.equal('temporary');
        txp.feeLevel.should.equal('economy');
        txp.feePerKb.should.equal(123e2);
        clients[0].publishTxProposal(
          {
            txp: txp
          },
          (err, publishedTxp) => {
            should.not.exist(err);
            should.exist(publishedTxp);
            publishedTxp.status.should.equal('pending');
            clients[0].getTxProposals({}, (err, txps) => {
              should.not.exist(err);
              txps.length.should.equal(1);
              // Try to republish from copayer 1
              clients[1].createTxProposal(opts, (err, txp) => {
                should.not.exist(err);
                should.exist(txp);
                txp.status.should.equal('pending');
                clients[1].publishTxProposal(
                  {
                    txp: txp
                  },
                  (err, publishedTxp) => {
                    should.not.exist(err);
                    should.exist(publishedTxp);
                    publishedTxp.status.should.equal('pending');
                    done();
                  }
                );
              });
            });
          }
        );
      });
    });
    it('Should protect against tampering at proposal creation', function(done) {
      var opts = {
        outputs: [
          {
            amount: 1e8,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'world'
          },
          {
            amount: 2e8,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5'
          }
        ],
        feePerKb: 123e2,
        changeAddress: myAddress.address,
        message: 'hello'
      };

      var tamperings = [
        txp => {
          txp.feePerKb = 45600;
        },
        txp => {
          txp.message = 'dummy';
        },
        txp => {
          txp.payProUrl = 'dummy';
        },
        txp => {
          txp.customData = 'dummy';
        },
        txp => {
          txp.outputs.push(txp.outputs[0]);
        },
        txp => {
          txp.outputs[0].toAddress = 'mjfjcbuYwBUdEyq2m7AezjCAR4etUBqyiE';
        },
        txp => {
          txp.outputs[0].amount = 2e8;
        },
        txp => {
          txp.outputs[1].amount = 3e8;
        },
        txp => {
          txp.outputs[0].message = 'dummy';
        },
        txp => {
          txp.changeAddress.address = 'mjfjcbuYwBUdEyq2m7AezjCAR4etUBqyiE';
        }
      ];

      var tmp = clients[0]._getCreateTxProposalArgs;
      var args = clients[0]._getCreateTxProposalArgs(opts);

      clients[0]._getCreateTxProposalArgs = opts => {
        return args;
      };
      async.each(
        tamperings,
        (tamperFn, next) => {
          helpers.tamperResponse(clients[0], 'post', '/v2/txproposals/', args, tamperFn, () => {
            clients[0].createTxProposal(opts, (err, txp) => {
              should.exist(err, 'For tamper function ' + tamperFn);
              err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
              next();
            });
          });
        },
        err => {
          should.not.exist(err);
          clients[0]._getCreateTxProposalArgs = tmp;
          done();
        }
      );
    });
    it('Should fail to publish when not enough available UTXOs', function(done) {
      var opts = {
        outputs: [
          {
            amount: 3e8,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5'
          }
        ],
        feePerKb: 100e2
      };

      var txp1, txp2;
      async.series(
        [
          next => {
            clients[0].createTxProposal(opts, (err, txp) => {
              txp1 = txp;
              next(err);
            });
          },
          next => {
            clients[0].createTxProposal(opts, (err, txp) => {
              txp2 = txp;
              next(err);
            });
          },
          next => {
            clients[0].publishTxProposal(
              {
                txp: txp1
              },
              next
            );
          },
          next => {
            clients[0].publishTxProposal(
              {
                txp: txp2
              },
              err => {
                should.exist(err);
                err.should.be.an.instanceOf(Errors.UNAVAILABLE_UTXOS);
                next();
              }
            );
          },
          next => {
            clients[1].rejectTxProposal(txp1, 'Free locked UTXOs', next);
          },
          next => {
            clients[2].rejectTxProposal(txp1, 'Free locked UTXOs', next);
          },
          next => {
            clients[0].publishTxProposal(
              {
                txp: txp2
              },
              next
            );
          }
        ],
        err => {
          should.not.exist(err);
          done();
        }
      );
    });
    it('Should create proposal with unconfirmed inputs', function(done) {
      var opts = {
        amount: 4.5e8,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'hello'
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.not.exist(err);
        clients[0].getTx(x.id, (err, x2) => {
          should.not.exist(err);
          x2.hasUnconfirmedInputs.should.equal(true);
          done();
        });
      });
    });
    it('Should fail to create proposal with insufficient funds', function(done) {
      var opts = {
        amount: 6e8,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'hello 1-1'
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.exist(err);
        err.should.be.an.instanceOf(Errors.INSUFFICIENT_FUNDS);
        done();
      });
    });
    it('Should fail to create proposal with insufficient funds for fee', function(done) {
      var opts = {
        amount: 5e8 - 200e2,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'hello 1-1',
        feePerKb: 800e2
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.exist(err);
        err.should.be.an.instanceOf(Errors.INSUFFICIENT_FUNDS_FOR_FEE);
        opts.feePerKb = 100e2;
        helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
          should.not.exist(err);
          clients[0].getTx(x.id, (err, x2) => {
            should.not.exist(err);
            should.exist(x2);
            done();
          });
        });
      });
    });
    it('Should lock and release funds through rejection', function(done) {
      var opts = {
        amount: 2.2e8,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5'
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.not.exist(err);

        helpers.createAndPublishTxProposal(clients[0], opts, (err, y) => {
          err.should.be.an.instanceOf(Errors.LOCKED_FUNDS);

          clients[1].rejectTxProposal(x, 'no', err => {
            should.not.exist(err);
            clients[2].rejectTxProposal(x, 'no', (err, z) => {
              should.not.exist(err);
              z.status.should.equal('rejected');
              helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });
    });
    it('Should lock and release funds through removal', function(done) {
      var opts = {
        amount: 2.2e8,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'hello 1-1'
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.not.exist(err);

        helpers.createAndPublishTxProposal(clients[0], opts, (err, y) => {
          err.should.be.an.instanceOf(Errors.LOCKED_FUNDS);

          clients[0].removeTxProposal(x, err => {
            should.not.exist(err);

            helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });
    it('Should keep message and refusal texts', function(done) {
      var opts = {
        amount: 1e8,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'some message'
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.not.exist(err);
        clients[1].rejectTxProposal(x, 'rejection comment', (err, tx1) => {
          should.not.exist(err);

          clients[2].getTxProposals({}, (err, txs) => {
            should.not.exist(err);
            txs[0].message.should.equal('some message');
            txs[0].actions[0].copayerName.should.equal('copayer 1');
            txs[0].actions[0].comment.should.equal('rejection comment');
            done();
          });
        });
      });
    });
    it('Should hide message and refusal texts if not key is present', function(done) {
      var opts = {
        amount: 1e8,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'some message'
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.not.exist(err);
        clients[1].rejectTxProposal(x, 'rejection comment', (err, tx1) => {
          should.not.exist(err);

          clients[2].credentials.sharedEncryptingKey = null;

          clients[2].getTxProposals({}, (err, txs) => {
            should.not.exist(err);
            txs[0].message.should.equal('<ECANNOTDECRYPT>');
            txs[0].actions[0].copayerName.should.equal('<ECANNOTDECRYPT>');
            txs[0].actions[0].comment.should.equal('<ECANNOTDECRYPT>');
            done();
          });
        });
      });
    });

    it('Should encrypt proposal message', function(done) {
      var opts = {
        outputs: [
          {
            amount: 1000e2,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5'
          }
        ],
        message: 'some message',
        feePerKb: 100e2
      };
      var spy = sandbox.spy(clients[0].request, 'post');
      clients[0].createTxProposal(opts, (err, x) => {
        should.not.exist(err);
        spy.calledOnce.should.be.true;
        JSON.stringify(spy.getCall(0).args).should.not.contain('some message');
        done();
      });
    });
    it('Should encrypt proposal refusal comment', function(done) {
      var opts = {
        amount: 1e8,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5'
      };
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.not.exist(err);
        var spy = sandbox.spy(clients[1].request, 'post');
        clients[1].rejectTxProposal(x, 'rejection comment', (err, tx1) => {
          should.not.exist(err);
          spy.calledOnce.should.be.true;
          JSON.stringify(spy.getCall(0).args).should.not.contain('rejection comment');
          done();
        });
      });
    });

    describe('Detecting tampered tx proposals', () => {
      it('should detect wrong signature', function(done) {
        var opts = {
          amount: 1000e2,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello'
        };
        helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
          should.not.exist(err);

          helpers.tamperResponse(
            clients[0],
            'get',
            '/v1/txproposals/',
            {},
            txps => {
              txps[0].proposalSignature =
                '304402206e4a1db06e00068582d3be41cfc795dcf702451c132581e661e7241ef34ca19202203e17598b4764913309897d56446b51bc1dcd41a25d90fdb5f87a6b58fe3a6920';
            },
            () => {
              clients[0].getTxProposals({}, (err, txps) => {
                should.exist(err);
                err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
                done();
              });
            }
          );
        });
      });
      it('should detect tampered amount', function(done) {
        var opts = {
          amount: 1000e2,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello'
        };
        helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
          should.not.exist(err);

          helpers.tamperResponse(
            clients[0],
            'get',
            '/v1/txproposals/',
            {},
            txps => {
              txps[0].outputs[0].amount = 1e8;
            },
            () => {
              clients[0].getTxProposals({}, (err, txps) => {
                should.exist(err);
                err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
                done();
              });
            }
          );
        });
      });
      it('should detect change address not it wallet', function(done) {
        var opts = {
          amount: 1000e2,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello'
        };
        helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
          should.not.exist(err);

          helpers.tamperResponse(
            clients[0],
            'get',
            '/v1/txproposals/',
            {},
            txps => {
              txps[0].changeAddress.address = 'mnA11ZwktRp4sZJbS8MbXmmFPZAgriuwhh';
            },
            () => {
              clients[0].getTxProposals({}, (err, txps) => {
                should.exist(err);
                err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
                done();
              });
            }
          );
        });
      });
    });
  });

  describe('Transaction Proposal signing', function() {
    this.timeout(5000);
    var setup = (m, n, coin, network, cb) => {
      helpers.createAndJoinWallet(
        clients,
        keys,
        m,
        n,
        {
          coin: coin,
          network: network
        },
        w => {
          clients[0].createAddress(null, (err, address) => {
            should.not.exist(err);

            // TODO change createAddress to /v4/, and remove this.
            if (coin == 'bch') {
              address.address = Bitcore_['bch'].Address(address.address).toString(true);
            }
            // ==

            blockchainExplorerMock.setUtxo(address, 2, 2);
            blockchainExplorerMock.setUtxo(address, 2, 2);
            blockchainExplorerMock.setUtxo(address, 1, 2, 0);
            cb();
          });
        }
      );
    };

    describe('BTC', function() {
      beforeEach(function(done) {
        setup(2, 3, 'btc', 'testnet', done);
      });

      it('Should sign proposal', function(done) {
        var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message'
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              publishedTxp.status.should.equal('pending');

              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(publishedTxp, signatures, async (err, txp) => {
                should.not.exist(err);
                let signatures2 = await keys[1].sign(clients[1].getRootPath(), txp);
                clients[1].pushSignatures(publishedTxp, signatures2, (err, txp) => {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  done();
                });
              });
            }
          );
        });
      });

      it('Should sign a RBF proposal', function(done) {
        var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message',
          enableRBF: true
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              publishedTxp.status.should.equal('pending');

              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(publishedTxp, signatures, async (err, txp) => {
                should.not.exist(err);
                let signatures2 = await keys[1].sign(clients[1].getRootPath(), txp);
                clients[1].pushSignatures(publishedTxp, signatures2, (err, txp) => {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  done();
                });
              });
            }
          );
        });
      });
      
      it('Should sign proposal with no change', function(done) {
        var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
        var opts = {
          outputs: [
            {
              amount: 4e8 - 100,
              toAddress: toAddress
            }
          ],
          excludeUnconfirmedUtxos: true,
          feePerKb: 1
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          var t = Utils.buildTx(txp);
          should.not.exist(t.getChangeOutput());
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              publishedTxp.status.should.equal('pending');
              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(publishedTxp, signatures, async (err, txp) => {
                should.not.exist(err);
                let signatures2 = await keys[1].sign(clients[1].getRootPath(), txp);
                clients[1].pushSignatures(publishedTxp, signatures2, (err, txp) => {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  done();
                });
              });
            }
          );
        });
      });
      it('Should sign proposal created with send max settings', function(done) {
        var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
        clients[0].getSendMaxInfo(
          {
            feePerKb: 100e2,
            returnInputs: true
          },
          (err, info) => {
            should.not.exist(err);
            var opts = {
              outputs: [
                {
                  amount: info.amount,
                  toAddress: toAddress
                }
              ],
              inputs: info.inputs,
              fee: info.fee
            };
            clients[0].createTxProposal(opts, (err, txp) => {
              should.not.exist(err);
              should.exist(txp);
              var t = Utils.buildTx(txp);
              should.not.exist(t.getChangeOutput());
              clients[0].publishTxProposal(
                {
                  txp: txp
                },
                async (err, publishedTxp) => {
                  should.not.exist(err);
                  should.exist(publishedTxp);
                  publishedTxp.status.should.equal('pending');
                  let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
                  clients[0].pushSignatures(publishedTxp, signatures, async (err, txp) => {
                    should.not.exist(err);
                    let signatures2 = await keys[1].sign(clients[1].getRootPath(), txp);
                    clients[1].pushSignatures(publishedTxp, signatures2, (err, txp) => {
                      should.not.exist(err);
                      txp.status.should.equal('accepted');
                      clients[0].getBalance({}, (err, balance) => {
                        should.not.exist(err);
                        balance.lockedAmount.should.equal(5e8);
                        done();
                      });
                    });
                  });
                }
              );
            });
          }
        );
      });

      // DISABLED 2020-04-07
      it.skip('Should sign proposal (legacy txp version 3)', function(done) {
        var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message'
        };
        clients[0].createTxProposal(
          opts,
          (err, txp) => {
            should.not.exist(err);
            should.exist(txp);
            txp.version.should.equal(3);
            clients[0].publishTxProposal(
              {
                txp: txp
              },
              async (err, publishedTxp) => {
                should.not.exist(err);
                should.exist(publishedTxp);
                publishedTxp.status.should.equal('pending');

                let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
                clients[0].pushSignatures(publishedTxp, signatures, async (err, txp) => {
                  should.not.exist(err);
                  let signatures2 = await keys[1].sign(clients[1].getRootPath(), txp);
                  clients[1].pushSignatures(publishedTxp, signatures2, (err, txp) => {
                    should.not.exist(err);
                    txp.status.should.equal('accepted');
                    done();
                  });
                });
              }
            );
          },
          '/v3/txproposals'
        );
      });

      it.skip('Should fail with need_update error if trying to sign a txp v4 on old client', function(done) {
        var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message'
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          txp.version.should.equal(4);
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(
                publishedTxp,
                signatures,
                (err, txp) => {
                  should.exist(err);
                  err.toString().should.contain('upgrade');
                  done();
                },
                '/v1/txproposals/'
              );
            }
          );
        });
      });

      it.skip('Should fail with wrong_signatures error if trying to push v3 signatures to  a v4 txp v', function(done) {
        var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message'
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          txp.version.should.equal(4);
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              txp.version = 3; // get v3 signatures
              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(
                publishedTxp,
                signatures,
                (err, txp) => {
                  should.exist(err);
                  err.toString().should.contain('BAD_SIGNATURES');
                  done();
                },
                '/v2/txproposals/'
              );
            }
          );
        });
      });
    });

    describe('BCH multisig', function() {
      beforeEach(function(done) {
        setup(2, 3, 'bch', 'testnet', done);
      });

      it('(BCH) two incompatible clients try to sign schnorr txp', function(done) {
        var toAddress = 'qr5m6xul5nahlzczeaqkg5qe3mgt754djuug954tc3';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message'
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              publishedTxp.status.should.equal('pending');

              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(publishedTxp, signatures, async (err, txp) => {
                should.not.exist(err);
                let signatures2 = await keys[1].sign(clients[1].getRootPath(), txp);
                clients[1].pushSignatures(
                  publishedTxp,
                  signatures2,
                  (err, txp) => {
                    should.exist(err);
                    err.message.should.contain('UPGRADE_NEEDED');
                    done();
                  },
                  '/v1/txproposals/'
                );
              });
            }
          );
        });
      });

      it('BCH Multisig Txp signingMethod = schnorr', function(done) {
        var toAddress = 'qr5m6xul5nahlzczeaqkg5qe3mgt754djuug954tc3';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message',
          signingMethod: 'schnorr' // forcing schnorr on BCH/livenet
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          txp.signingMethod.should.equal('schnorr');
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              publishedTxp.signingMethod.should.equal('schnorr');
              publishedTxp.status.should.equal('pending');

              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(
                publishedTxp,
                signatures,
                async (err, txp) => {
                  should.not.exist(err);
                  let signatures2 = await keys[1].sign(clients[1].getRootPath(), txp);
                  clients[1].pushSignatures(
                    publishedTxp,
                    signatures2,
                    (err, txp) => {
                      should.not.exist(err);
                      txp.status.should.equal('accepted');
                      done();
                    },
                    '/v2/txproposals/'
                  );
                },
                '/v2/txproposals/'
              );
            }
          );
        });
      });
    });

    describe('BCH testnet (schnorr activaton)', function() {
      beforeEach(function(done) {
        setup(1, 1, 'bch', 'testnet', done);
      });

      it('should sign a tx', function(done) {
        var toAddress = 'qr5m6xul5nahlzczeaqkg5qe3mgt754djuug954tc3';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message',
          signingMethod: 'schnorr' // forcing schnorr on BCH/livenet
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          txp.signingMethod.should.equal('schnorr');
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              publishedTxp.signingMethod.should.equal('schnorr');
              publishedTxp.status.should.equal('pending');

              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(publishedTxp, signatures, (err, txp) => {
                should.not.exist(err);
                txp.status.should.equal('accepted');
                done();
              });
            }
          );
        });
      });
    });

    describe('BCH', function() {
      beforeEach(function(done) {
        setup(1, 1, 'bch', 'livenet', done);
      });

      it('Should sign proposal', function(done) {
        var toAddress = 'qran0w2c8x2n4wdr60s4nrle65s745wt4sakf9xa8e';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message',
          coin: 'bch'
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              publishedTxp.status.should.equal('pending');
              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(publishedTxp, signatures, (err, txp) => {
                should.not.exist(err);
                txp.status.should.equal('accepted');
                done();
              });
            }
          );
        });
      });

      it('Should fail with "upgrade needed" trying to sign schnorr on old clients', function(done) {
        var toAddress = 'qran0w2c8x2n4wdr60s4nrle65s745wt4sakf9xa8e';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message',
          txpVersion: 3,
          coin: 'bch'
        };
        clients[0].createTxProposal(
          opts,
          (err, txp) => {
            should.not.exist(err);
            should.exist(txp);
            clients[0].publishTxProposal(
              {
                txp: txp
              },
              async (err, publishedTxp) => {
                should.not.exist(err);
                should.exist(publishedTxp);
                publishedTxp.status.should.equal('pending');
                let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
                clients[0].pushSignatures(
                  publishedTxp,
                  signatures,
                  (err, txp) => {
                    err.message.should.contain('upgrade');
                    done();
                  },
                  '/v1/txproposals/'
                );
              }
            );
          },
          '/v3/txproposals'
        );
      });

      it('Should sign proposal v3', function(done) {
        var toAddress = 'qran0w2c8x2n4wdr60s4nrle65s745wt4sakf9xa8e';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message',
          txpVersion: 3,
          coin: 'bch'
        };
        clients[0].createTxProposal(
          opts,
          (err, txp) => {
            should.not.exist(err);
            should.exist(txp);
            clients[0].publishTxProposal(
              {
                txp: txp
              },
              async (err, publishedTxp) => {
                should.not.exist(err);
                should.exist(publishedTxp);
                publishedTxp.status.should.equal('pending');
                let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
                clients[0].pushSignatures(
                  publishedTxp,
                  signatures,
                  (err, txp) => {
                    should.not.exist(err);
                    txp.status.should.equal('accepted');
                    done();
                  },
                  '/v2/txproposals/'
                );
              }
            );
          },
          '/v3/txproposals'
        );
      });

      it.skip('Should sign proposal (legacy txp version 3)', function(done) {
        var toAddress = 'qran0w2c8x2n4wdr60s4nrle65s745wt4sakf9xa8e';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message',
          coin: 'bch'
        };
        clients[0].createTxProposal(
          opts,
          (err, txp) => {
            should.not.exist(err);
            should.exist(txp);
            txp.version.should.equal(3);
            clients[0].publishTxProposal(
              {
                txp: txp
              },
              async (err, publishedTxp) => {
                should.not.exist(err);
                should.exist(publishedTxp);
                publishedTxp.status.should.equal('pending');

                let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
                clients[0].pushSignatures(publishedTxp, signatures, (err, txp) => {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  done();
                });
              }
            );
          },
          '/v3/txproposals'
        );
      });

      it.skip('Should fail with need_update error if trying to sign a txp v4 on old client', function(done) {
        var toAddress = 'qran0w2c8x2n4wdr60s4nrle65s745wt4sakf9xa8e';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message'
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          txp.version.should.equal(4);
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(
                publishedTxp,
                signatures,
                (err, txp) => {
                  should.exist(err);
                  err.toString().should.contain('upgrade');
                  done();
                },
                '/v1/txproposals/'
              );
            }
          );
        });
      });

      it.skip('Should fail with wrong_signatures error if trying to push v3 signatures to  a v4 txp v', function(done) {
        var toAddress = 'qran0w2c8x2n4wdr60s4nrle65s745wt4sakf9xa8e';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            },
            {
              amount: 2e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2,
          message: 'just some message'
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          txp.version.should.equal(4);
          clients[0].publishTxProposal(
            {
              txp: txp
            },
            async (err, publishedTxp) => {
              should.not.exist(err);
              should.exist(publishedTxp);
              txp.version = 3; // get v3 signatures
              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(
                publishedTxp,
                signatures,
                (err, txp) => {
                  should.exist(err);
                  err.toString().should.contain('BAD_SIGNATURES');
                  done();
                },
                '/v2/txproposals/'
              );
            }
          );
        });
      });
    });
  });

  describe('Payment Protocol V2', function() {
    var PP, oldreq, DATA, postArgs;
    var header: any = {};
    var mockRequest = (bodyBuf, headers) => {
      Client.PayProV2.request = {
        get: _url => {
          return {
            set: (_k, _v) => {
              if (_k && _v) {
                header[_k] = _v;
              }
            },
            query: _opts => {},
            agent: _opts => {},
            end: cb => {
              return cb(null, {
                headers: headers || {},
                statusCode: 200,
                statusMessage: 'OK',
                text: bodyBuf
              });
            }
          };
        },
        post: _url => {
          return {
            set: (_k, _v) => {
              if (_k && _v) {
                header[_k] = _v;
              }
            },
            send: opts => {
              var _opts = JSON.parse(opts);
              if (_opts.transactions) {
                postArgs.push(_opts);
              }
            },
            agent: _opts => {},
            end: cb => {
              return cb(null, {
                headers: headers || {},
                statusCode: 200,
                statusMessage: 'OK',
                text: bodyBuf
              });
            }
          };
        }
      };
    };
    beforeEach(() => {
      oldreq = Client.PayProV2.request;
      postArgs = [];
    });
    afterEach(function(done) {
      Client.PayProV2.request = oldreq;
      db.dropDatabase(err => {
        done();
      });
    });

    let tests = [
/*      {
        name: 'weightedSize: Legacy BTC',
        opts: { network: 'livenet' },
        expectedSize: 220,
      },
      {
        name: 'weightedSize: Segwit BTC',
        opts: { network: 'livenet', useNativeSegwit: true },
        expectedSize: 140,
      }
 */   {
        name: 'weightedSize: Legacy BTC',
        opts: { network: 'livenet' },
        expectedSize: 335,
      },
      {
        name: 'weightedSize: Segwit BTC',
        opts: { network: 'livenet', useNativeSegwit: true },
        expectedSize: 187, // from decode-tx
      }
 
    ];

    let cas = 0;
    for (const x of tests) {
      describe(x.name, () => {
        // Tests will be considered slow after 1 second elapses
        beforeEach(async () => {
          await new Promise<void>(resolve => {
            PP = TestData.payProJsonV2.btc;
            DATA = JSON.parse(TestData.payProJsonV2Body.btc);

            mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
            helpers.createAndJoinWallet(clients, keys, 2, 2, x.opts, w => {
              clients[0].createAddress(null, (err, x0) => {
                should.not.exist(err);
                should.exist(x0.address);
                blockchainExplorerMock.setUtxo(x0, 1, 2);
                blockchainExplorerMock.setUtxo(x0, 1, 2);
                var opts = {
                  paymentUrl: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X'
                };

                Client.PayProV2.selectPaymentOption(opts).then(paypro => {
                  //              http.getCall(0).args[0].coin.should.equal('btc');
                  
                  helpers.createAndPublishTxProposal(
                    clients[0],
                    {
                      toAddress: paypro.instructions[0].toAddress,
                      amount: paypro.instructions[0].amount,
                      message: paypro.memo,
                      payProUrl: paypro.payProUrl
                    },
                    (err, x) => {
                      should.not.exist(err);
                      resolve();
                    }
                  );
                });
              });
            });
          });
        });
        it('Should send the signed tx in paypro. case: ' + cas++, function(done) {
          clients[0].getTxProposals({}, async (err, txps) => {
            should.not.exist(err);
            let signatures = await keys[0].sign(clients[0].getRootPath(), txps[0]);
            clients[0].pushSignatures(txps[0], signatures, async (err, xx) => {
              should.not.exist(err);
              let signatures = await keys[1].sign(clients[1].getRootPath(), txps[0]);
              clients[1].pushSignatures(txps[0], signatures, (err, xx) => {
              should.not.exist(err);
 
              xx.status.should.equal('accepted');

              let spy = sandbox.spy(Client.PayProV2.request, 'post');
              clients[0].broadcastTxProposal(xx, (err, zz, memo) => {
                should.not.exist(err);
                spy.called.should.be.true;

                // unsigned
                let size = x.expectedSize;
                postArgs[0].transactions[0].weightedSize.should.within(
                  size - 10,
                  size + 10
                );

                // signed
                postArgs[1].transactions[0].weightedSize.should.within(size-10, size+10);
                done();
              });
            });
          });
          });
        });
      });
    }

    describe('Shared wallet BTC', () => {
      // Tests will be considered slow after 1 second elapses
      beforeEach(async () => {
        await new Promise<void>(resolve => {
          PP = TestData.payProJsonV2.btc;
          DATA = JSON.parse(TestData.payProJsonV2Body.btc);

          mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
          helpers.createAndJoinWallet(clients, keys, 2, 2, { network: 'livenet' }, w => {
            clients[0].createAddress(null, (err, x0) => {
              should.not.exist(err);
              should.exist(x0.address);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              var opts = {
                paymentUrl: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X'
              };

              Client.PayProV2.selectPaymentOption(opts).then(paypro => {
                //              http.getCall(0).args[0].coin.should.equal('btc');
                helpers.createAndPublishTxProposal(
                  clients[0],
                  {
                    toAddress: paypro.instructions[0].toAddress,
                    amount: paypro.instructions[0].amount,
                    message: paypro.memo,
                    payProUrl: paypro.payProUrl
                  },
                  (err, x) => {
                    should.not.exist(err);
                    resolve();
                  }
                );
              });
            });
          });
        });
      });

      it('Should Create and Verify a Tx from PayPro', function(done) {
        clients[1].getTxProposals({}, (err, txps) => {
          try {
            should.not.exist(err);
            var tx = txps[0];
            // From the hardcoded paypro request
            tx.outputs[0].amount.should.equal(DATA.instructions[0].outputs[0].amount);
            tx.outputs[0].toAddress.should.equal(DATA.instructions[0].outputs[0].address);
            tx.message.should.equal(DATA.memo);
            tx.payProUrl.should.equal('https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X');
            done();
          } catch (err) {
            console.error(err);
          }
        });
      });

      it('Should handle broken paypro data', async () => {
        mockRequest(Buffer.from('broken data'), TestData.payProJsonV2.btc.headers);
        var opts = {
          // payProUrl: 'dummy' // was this intentional?
          paymentUrl: 'dummy'
        };
        await Client.PayProV2.selectPaymentOption(opts).catch(err => {
          should.exist(err);
        });
      });

      it('Should ignore PayPro at getTxProposals if instructed', function(done) {
        mockRequest(Buffer.from('broken data'), TestData.payProJsonV2.btc.headers);
        clients[1].doNotVerifyPayPro = true;
        clients[1].getTxProposals({}, (err, txps) => {
          try {
            should.not.exist(err);
            var tx = txps[0];
            // From the hardcoded paypro request
            tx.outputs[0].amount.should.equal(DATA.instructions[0].outputs[0].amount);
            tx.outputs[0].toAddress.should.equal(DATA.instructions[0].outputs[0].address);
            tx.message.should.equal(DATA.memo);
            tx.payProUrl.should.equal('https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X');
            done();
          } catch (e) {
            console.error(e);
          }
        });
      });

      it('Should ignore PayPro at pushSignatures if instructed', function(done) {
        mockRequest(Buffer.from('broken data'), TestData.payProJsonV2.btc.headers);
        clients[1].doNotVerifyPayPro = true;
        clients[1].getTxProposals({}, async (err, txps) => {
          should.not.exist(err);
          let signatures = await keys[1].sign(clients[1].getRootPath(), txps[0]);
          clients[1].pushSignatures(txps[0], signatures, (err, txps) => {
            should.not.exist(err);
            done();
          });
        });
      });

      it('Should send the "payment message" when last copayer sign', function(done) {
        clients[0].getTxProposals({}, async (err, txps) => {
          should.not.exist(err);
          let signatures = await keys[0].sign(clients[0].getRootPath(), txps[0]);
          clients[0].pushSignatures(txps[0], signatures, async (err, xx) => {
            should.not.exist(err);
            let signatures2 = await keys[1].sign(clients[1].getRootPath(), txps[0]);
            clients[1].pushSignatures(xx, signatures2, (err, yy) => {
              should.not.exist(err);
              yy.status.should.equal('accepted');
              let spy = sandbox.spy(Client.PayProV2.request, 'post');
              //              http.onCall(5).resolves(TestData.payProAckHex);

              clients[1].broadcastTxProposal(yy, (err, zz, memo) => {
                should.not.exist(err);
                spy.called.should.be.true;
                memo.should.equal(
                  'Payment request for BitPay invoice LanynqCPoL2JQb8z8s5Z3X for merchant BitPay Visa® Load (USD-USA)'
                );
                zz.message.should.equal(
                  'Payment request for BitPay invoice LanynqCPoL2JQb8z8s5Z3X for merchant BitPay Visa® Load (USD-USA)'
                );
                done();
              });
            });
          });
        });
      });

      it('Should send the signed tx in paypro', function(done) {
        clients[0].getTxProposals({}, async (err, txps) => {
          should.not.exist(err);
          let signatures = await keys[0].sign(clients[0].getRootPath(), txps[0]);
          clients[0].pushSignatures(txps[0], signatures, async (err, xx) => {
            should.not.exist(err);
            let signatures = await keys[1].sign(clients[1].getRootPath(), txps[0]);
            clients[1].pushSignatures(xx, signatures, (err, yy) => {
              should.not.exist(err);

              yy.status.should.equal('accepted');
              let spy = sandbox.spy(Client.PayProV2.request, 'post');
              clients[1].broadcastTxProposal(yy, (err, zz, memo) => {
                should.not.exist(err);
                spy.called.should.be.true;
                var rawTx = Buffer.from(postArgs[1].transactions[0].tx, 'hex');
                var tx = new Bitcore.Transaction(rawTx);
                var script = tx.inputs[0].script;
                script.isScriptHashIn().should.equal(true);
                memo.should.be.equal(
                  'Payment request for BitPay invoice LanynqCPoL2JQb8z8s5Z3X for merchant BitPay Visa® Load (USD-USA)'
                );
                done();
              });
            });
          });
        });
      });

      it('Should set bp_partner', function(done) {
        clients[0].getTxProposals({}, async (err, txps) => {
          should.not.exist(err);
          var changeAddress = txps[0].changeAddress.address;
          let signatures = await keys[0].sign(clients[0].getRootPath(), txps[0]);
          clients[0].pushSignatures(txps[0], signatures, async (err, xx) => {
            should.not.exist(err);
            let signatures = await keys[1].sign(clients[1].getRootPath(), txps[0]);
            clients[1].pushSignatures(xx, signatures, (err, yy) => {
              should.not.exist(err);

              yy.status.should.equal('accepted');
              let spy = sandbox.spy(Client.PayProV2.request, 'post');

              clients[1].broadcastTxProposal(yy, (err, zz, memo) => {
                should.not.exist(err);
                spy.called.should.be.true;
                header.BP_PARTNER.should.equal('xxx');
                header.BP_PARTNER_VERSION.should.equal('yyy');
                done();
              });
            });
          });
        });
      });
    });

    describe('Shared wallet / requiredFeeRate BTC', () => {
      beforeEach(async () => {
        await new Promise<void>(resolve => {
          DATA = JSON.parse(TestData.payProJsonV2Body.btc);
          mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
          helpers.createAndJoinWallet(clients, keys, 2, 2, { network: 'livenet' }, w => {
            clients[0].createAddress(null, (err, x0) => {
              should.not.exist(err);
              should.exist(x0.address);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              var opts = {
                paymentUrl: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X'
              };
              Client.PayProV2.selectPaymentOption(opts).then(paypro => {
                paypro.requiredFeeRate.should.equal(34.337);
                helpers.createAndPublishTxProposal(
                  clients[0],
                  {
                    toAddress: paypro.instructions[0].outputs[0].address,
                    amount: paypro.instructions[0].outputs[0].amount,
                    message: paypro.memo,
                    payProUrl: paypro.payProUrl,
                    feePerKb: paypro.requiredFeeRate * 1024
                  },
                  (err, x) => {
                    should.not.exist(err);
                    resolve();
                  }
                );
              });
            });
          });
        });
      });

      it('Should Create and Verify a Tx from PayPro', function(done) {
        clients[1].getTxProposals({}, (err, txps) => {
          should.not.exist(err);
          var tx = txps[0];

          tx.outputs[0].amount.should.equal(DATA.instructions[0].outputs[0].amount);
          tx.outputs[0].toAddress.should.equal(DATA.instructions[0].outputs[0].address);
          tx.message.should.equal(DATA.memo);
          tx.payProUrl.should.equal('https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X');
          tx.feePerKb.should.equal(34.337 * 1024);

          // From the hardcoded paypro request
          done();
        });
      });

      it('Should send the "payment message" when last copayer sign', function(done) {
        clients[0].getTxProposals({}, async (err, txps) => {
          should.not.exist(err);
          let signatures = await keys[0].sign(clients[0].getRootPath(), txps[0]);
          clients[0].pushSignatures(txps[0], signatures, async (err, xx) => {
            should.not.exist(err);

            let signatures = await keys[1].sign(clients[1].getRootPath(), xx);
            clients[1].pushSignatures(xx, signatures, (err, yy) => {
              should.not.exist(err);
              yy.status.should.equal('accepted');
              let spy = sandbox.spy(Client.PayProV2.request, 'post');
              clients[1].broadcastTxProposal(yy, (err, zz, memo) => {
                try {
                  should.not.exist(err);
                  spy.called.should.be.true;
                  postArgs[1].currency.should.equal('BTC');
                  postArgs[1].transactions.length.should.equal(1);
                  postArgs[1].transactions[0].tx.length.should.be.within(665, 680);

                  memo.should.equal(
                    'Payment request for BitPay invoice LanynqCPoL2JQb8z8s5Z3X for merchant BitPay Visa® Load (USD-USA)'
                  );
                  zz.message.should.equal(
                    'Payment request for BitPay invoice LanynqCPoL2JQb8z8s5Z3X for merchant BitPay Visa® Load (USD-USA)'
                  );
                  zz.feePerKb.should.equal(34.337 * 1024);
                  done();
                } catch (e) {
                  console.error(e);
                }
              });
            });
          });
        });
      });

      it('Should NOT fail if requiredFeeRate is not meet', function(done) {
        clients[0].getTxProposals({}, async (err, txps) => {
          should.not.exist(err);
          let signatures = await keys[0].sign(clients[0].getRootPath(), txps[0]);
          clients[0].pushSignatures(txps[0], signatures, async (err, xx) => {
            should.not.exist(err);
            xx.feePerKb /= 2;
            let signatures2 = await keys[1].sign(clients[1].getRootPath(), xx);
            clients[1].pushSignatures(xx, signatures2, (err, yy) => {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    describe('1-of-1 wallet BTC', () => {
      beforeEach(async () => {
        await new Promise<void>(resolve => {
          DATA = JSON.parse(TestData.payProJsonV2Body.btc);
          mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
          helpers.createAndJoinWallet(clients, keys, 1, 1, { network: 'livenet' }, w => {
            clients[0].createAddress(null, (err, x0) => {
              should.not.exist(err);
              should.exist(x0.address);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              var opts = {
                paymentUrl: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X'
              };
              Client.PayProV2.selectPaymentOption(opts).then(paypro => {
                helpers.createAndPublishTxProposal(
                  clients[0],
                  {
                    toAddress: paypro.instructions[0].outputs[0].address,
                    amount: paypro.instructions[0].outputs[0].amount,
                    message: paypro.memo,
                    payProUrl: paypro.payProUrl
                  },
                  (err, x) => {
                    should.not.exist(err);
                    resolve();
                  }
                );
              });
            });
          });
        });
      });

      it('Should send the signed tx in paypro', function(done) {
        clients[0].getTxProposals({}, async (err, txps) => {
          should.not.exist(err);
          let signatures = await keys[0].sign(clients[0].getRootPath(), txps[0]);
          clients[0].pushSignatures(txps[0], signatures, (err, xx) => {
            should.not.exist(err);
            xx.status.should.equal('accepted');
            let spy = sandbox.spy(Client.PayProV2.request, 'post');

            clients[0].broadcastTxProposal(xx, (err, zz, memo) => {
              should.not.exist(err);
              spy.called.should.be.true;
              var rawTx = Buffer.from(postArgs[1].transactions[0].tx, 'hex');
              var tx = new Bitcore.Transaction(rawTx);
              var script = tx.inputs[0].script;

              script.isPublicKeyHashIn().should.equal(true);
              memo.should.be.equal(
                'Payment request for BitPay invoice LanynqCPoL2JQb8z8s5Z3X for merchant BitPay Visa® Load (USD-USA)'
              );

              done();
            });
          });
        });
      });
    });

    describe('1-of-1 BCH wallet', () => {
      beforeEach(async () => {
        await new Promise<void>(resolve => {
          DATA = JSON.parse(TestData.payProJsonV2Body.bch);
          mockRequest(TestData.payProJsonV2.bch.body, TestData.payProJsonV2.bch.headers);

          helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'bch', network: 'livenet' }, w => {
            clients[0].createAddress(null, async (err, x0) => {
              should.not.exist(err);
              should.exist(x0.address);

              // TODO change createAddress to /v4/, and remove this.
              //x0.address = Bitcore_['bch'].Address(x0.address).toString(true);
              // ======
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              var opts = {
                paymentUrl: 'https://bitpay.com/i/XM8XbreRs6cnKkR3yYT6qQ',
                chain: 'BCH',
                currency: 'BCH'
              };
              try {
                await Client.PayProV2.selectPaymentOption(opts).then(paypro => {
                  helpers.createAndPublishTxProposal(
                    clients[0],
                    {
                      toAddress: paypro.instructions[0].toAddress,
                      amount: paypro.instructions[0].amount,
                      message: paypro.memo,
                      payProUrl: paypro.payProUrl
                    },
                    (err, x) => {
                      should.not.exist(err);
                      resolve();
                    }
                  );
                });
              } catch (e) {
                console.error(e);
              }
            });
          });
        });
      });

      it('Should send the signed tx in paypro', function(done) {
        clients[0].getTxProposals({}, async (err, txps) => {
          should.not.exist(err);
          let signatures = await keys[0].sign(clients[0].getRootPath(), txps[0]);
          clients[0].pushSignatures(txps[0], signatures, (err, xx) => {
            should.not.exist(err);
            xx.status.should.equal('accepted');

            let spy = sandbox.spy(Client.PayProV2.request, 'post');
            clients[0].broadcastTxProposal(xx, (err, zz, memo) => {
              should.not.exist(err);
              spy.called.should.be.true;
              var rawTx = Buffer.from(postArgs[1].transactions[0].tx, 'hex');
              var tx = Bitcore_['bch'].Transaction(rawTx);
              var script = tx.inputs[0].script;
              script.isPublicKeyHashIn().should.equal(true);
              memo.should.be.equal(
                'Payment request for BitPay invoice XM8XbreRs6cnKkR3yYT6qQ for merchant BitPay Visa® Load (USD-USA)'
              );
              done();
            });
          });
        });
      });
    });

    describe('New proposal flow', () => {
      beforeEach(async function() {
        await new Promise<void>(resolve => {
          DATA = JSON.parse(TestData.payProJsonV2Body.btc);
          mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
          for (const val of Object.values(Client.PayProV2.trustedKeys)) {
            sandbox.stub(val, 'domains').value(['example.com']);
          }

          helpers.createAndJoinWallet(clients, keys, 2, 2, { network: 'livenet' }, w => {
            clients[0].createAddress(null, (err, x0) => {
              should.not.exist(err);
              should.exist(x0.address);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              blockchainExplorerMock.setUtxo(x0, 1, 2);
              var opts = {
                paymentUrl: 'http://example.com'
              };

              Client.PayProV2.selectPaymentOption(opts).then(() => {
                clients[0].createTxProposal(
                  {
                    outputs: [
                      {
                        toAddress: DATA.instructions[0].outputs[0].address,
                        amount: DATA.instructions[0].outputs[0].amount
                      }
                    ],
                    message: DATA.memo,
                    payProUrl: opts.paymentUrl,
                    feePerKb: 100e2
                  },
                  (err, txp) => {
                    should.not.exist(err);
                    clients[0].publishTxProposal(
                      {
                        txp: txp
                      },
                      err => {
                        should.not.exist(err);
                        resolve();
                      }
                    );
                  }
                );
              });
            });
          });
        });
      });

      it('Should Create and Verify a Tx from PayPro', function(done) {
        clients[1].getTxProposals({}, (err, txps) => {
          should.not.exist(err);
          var tx = txps[0];
          // From the hardcoded paypro request
          tx.amount.should.equal(DATA.instructions[0].outputs[0].amount);
          tx.outputs[0].toAddress.should.equal(DATA.instructions[0].outputs[0].address);
          tx.message.should.equal(DATA.memo);
          tx.payProUrl.should.equal('http://example.com');
          done();
        });
      });
    });
  });

  describe('Proposals with explicit ID', () => {
    it('Should create and publish a proposal', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
        var id = 'anId';
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
          var opts = {
            outputs: [
              {
                amount: 40000,
                toAddress: toAddress
              }
            ],
            feePerKb: 100e2,
            txProposalId: id
          };
          clients[0].createTxProposal(opts, (err, txp) => {
            should.not.exist(err);
            should.exist(txp);
            clients[0].publishTxProposal(
              {
                txp: txp
              },
              (err, publishedTxp) => {
                should.not.exist(err);
                publishedTxp.id.should.equal(id);
                clients[0].removeTxProposal(publishedTxp, err => {
                  opts.txProposalId = null;
                  clients[0].createTxProposal(opts, (err, txp) => {
                    should.not.exist(err);
                    should.exist(txp);
                    txp.id.should.not.equal(id);
                    done();
                  });
                });
              }
            );
          });
        });
      });
    });
  });

  describe('Multiple output proposals', () => {
    var toAddress;
    var opts;
    beforeEach(function(done) {
      toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
      opts = {
        message: 'hello',
        outputs: [
          {
            amount: 10000,
            toAddress: toAddress,
            message: 'world'
          }
        ],
        feePerKb: 100e2
      };

      var http = sandbox.stub();
      http.resolves(undefined);
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          done();
        });
      });
    });

    var doit = (opts, doNotVerifyPayPro, doBroadcast, done) => {
      helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
        should.not.exist(err);
        clients[0].getTx(x.id, async (err, x2) => {
          should.not.exist(err);
          x2.creatorName.should.equal('creator');
          x2.message.should.equal('hello');
          x2.outputs[0].toAddress.should.equal(toAddress);
          x2.outputs[0].amount.should.equal(10000);
          x2.outputs[0].message.should.equal('world');
          clients[0].doNotVerifyPayPro = doNotVerifyPayPro;
          let signatures = await keys[0].sign(clients[0].getRootPath(), x2);
          clients[0].pushSignatures(x2, signatures, (err, txp) => {
            should.not.exist(err);
            txp.status.should.equal('accepted');
            if (doBroadcast) {
              clients[0].broadcastTxProposal(txp, (err, txp) => {
                should.not.exist(err);
                txp.status.should.equal('broadcasted');
                txp.txid.should.equal(new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted).id);
                done();
              });
            } else {
              done();
            }
          });
        });
      });
    };
    it('should create, get, sign, and broadcast proposal with no payProUrl', function(done) {
      delete opts.payProUrl;
      doit(opts, false, true, done);
    });
    it('should create, get, sign, and broadcast proposal with null payProUrl', function(done) {
      opts.payProUrl = null;
      doit(opts, false, true, done);
    });
    it('should create, get, sign, and broadcast proposal with empty string payProUrl', function(done) {
      opts.payProUrl = '';
      doit(opts, false, true, done);
    });
    it('should create, get, and sign proposal with mal-formed payProUrl', function(done) {
      opts.payProUrl = 'dummy';
      doit(opts, true, false, done);
    });
    it('should create, get, and sign proposal with well-formed payProUrl', function(done) {
      opts.payProUrl = 'https://merchant.com/pay.php?h%3D2a8628fc2fbe';
      doit(opts, true, false, done);
    });
  });

  describe('Transactions Signatures and Rejection', function() {
    this.timeout(5000);
    it('Send and broadcast in 1-1 wallet BTC', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            outputs: [
              {
                amount: 10000000,
                toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                message: 'output 0'
              }
            ],
            message: 'hello',
            feePerKb: 100e2
          };
          helpers.createAndPublishTxProposal(clients[0], opts, async (err, txp) => {
            should.not.exist(err);
            txp.requiredRejections.should.equal(1);
            txp.requiredSignatures.should.equal(1);
            txp.status.should.equal('pending');
            txp.changeAddress.path.should.equal('m/1/0');
            txp.outputs[0].message.should.equal('output 0');
            txp.message.should.equal('hello');
            let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
            clients[0].pushSignatures(txp, signatures, (err, txp) => {
              should.not.exist(err);
              txp.status.should.equal('accepted');
              txp.outputs[0].message.should.equal('output 0');
              txp.message.should.equal('hello');
              clients[0].broadcastTxProposal(txp, (err, txp) => {
                should.not.exist(err);
                txp.status.should.equal('broadcasted');
                txp.txid.should.equal(new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted).id);
                txp.outputs[0].message.should.equal('output 0');
                txp.message.should.equal('hello');
                done();
              });
            });
          });
        });
      });
    });

    it('Send and broadcast in 1-1 wallet ETH', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth' }, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          //blockchainExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            outputs: [
              {
                amount: 10000000,
                toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
                message: 'output 0',
                gasLimit: 21000
              }
            ],
            message: 'hello',
            feePerKb: 100e2,
            txType: 2
          };
          helpers.createAndPublishTxProposal(clients[0], opts, async (err, txp) => {
            should.not.exist(err);
            txp.requiredRejections.should.equal(1);
            txp.requiredSignatures.should.equal(1);
            txp.status.should.equal('pending');
            txp.outputs[0].message.should.equal('output 0');
            txp.message.should.equal('hello');
            txp.txType.should.equal(2);
            txp.maxGasFee.should.equal(20000);
            txp.priorityGasFee.should.equal(5000);
            let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
            clients[0].pushSignatures(txp, signatures, (err, txp) => {
              should.not.exist(err);
              txp.status.should.equal('accepted');
              txp.outputs[0].message.should.equal('output 0');
              txp.message.should.equal('hello');
              clients[0].broadcastTxProposal(txp, (err, txp) => {
                should.not.exist(err);
                txp.status.should.equal('broadcasted');
                txp.txid.should.contain('0x');
                txp.message.should.equal('hello');
                done();
              });
            });
          });
        });
      });
    });

    it('Prevent signing of TXs with lower Nonces in 1-1 wallet ETH', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth' }, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          var opts = {
            outputs: [
              {
                amount: 10000000,
                toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
                message: 'output 0',
                gasLimit: 21000
              }
            ],
            message: 'hello',
            feePerKb: 100e2
          };
          const opts1 = { ...opts, nonce: 1 };
          helpers.createAndPublishTxProposal(clients[0], opts1, (err, txp1) => {
            should.not.exist(err);
            txp1.requiredRejections.should.equal(1);
            txp1.requiredSignatures.should.equal(1);
            txp1.status.should.equal('pending');
            txp1.outputs[0].message.should.equal('output 0');
            txp1.message.should.equal('hello');

            const opts2 = { ...opts, nonce: 2 };
            helpers.createAndPublishTxProposal(clients[0], opts2, async (err, txp2) => {
              should.not.exist(err);
              txp2.requiredRejections.should.equal(1);
              txp2.requiredSignatures.should.equal(1);
              txp2.status.should.equal('pending');
              txp2.outputs[0].message.should.equal('output 0');
              txp2.message.should.equal('hello');
              
              let signatures = await keys[0].sign(clients[0].getRootPath(), txp2);
              clients[0].pushSignatures(txp2, signatures, err => {
                should.exist(err);
                done();
              });
            });
          });
        });
      });
    });

    it('Send and broadcast in 1-1 wallet MATIC', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'matic', chain: 'matic' }, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          //blockchainExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            chain: 'matic',
            outputs: [
              {
                amount: 10000000,
                toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
                message: 'output 0',
                gasLimit: 21000
              }
            ],
            message: 'hello',
            feePerKb: 100e2
          };
          helpers.createAndPublishTxProposal(clients[0], opts, async (err, txp) => {
            should.not.exist(err);
            txp.requiredRejections.should.equal(1);
            txp.requiredSignatures.should.equal(1);
            txp.status.should.equal('pending');
            txp.outputs[0].message.should.equal('output 0');
            txp.message.should.equal('hello');
            let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
            clients[0].pushSignatures(txp, signatures, (err, txp) => {
              should.not.exist(err);
              txp.status.should.equal('accepted');
              txp.outputs[0].message.should.equal('output 0');
              txp.message.should.equal('hello');
              clients[0].broadcastTxProposal(txp, (err, txp) => {
                should.not.exist(err);
                txp.status.should.equal('broadcasted');
                txp.txid.should.contain('0x');
                txp.message.should.equal('hello');
                done();
              });
            });
          });
        });
      });
    });

    it('Send and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello'
          };
          helpers.createAndPublishTxProposal(clients[0], opts, (err, txp) => {
            should.not.exist(err);
            clients[0].getStatus({}, async (err, st) => {
              should.not.exist(err);
              var txp = st.pendingTxps[0];
              txp.status.should.equal('pending');
              txp.requiredRejections.should.equal(2);
              txp.requiredSignatures.should.equal(2);
              var w = st.wallet;
              w.copayers.length.should.equal(3);
              w.status.should.equal('complete');
              var b = st.balance;
              b.totalAmount.should.equal(1000000000);
              b.lockedAmount.should.equal(1000000000);
              let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
              clients[0].pushSignatures(txp, signatures, async (err, txp) => {
                should.not.exist(err);
                txp.status.should.equal('pending');
                let signatures = await keys[1].sign(clients[1].getRootPath(), txp);
                clients[1].pushSignatures(txp, signatures, (err, txp) => {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  clients[1].broadcastTxProposal(txp, (err, txp) => {
                    txp.status.should.equal('broadcasted');
                    txp.txid.should.equal(new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted).id);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('Send, reject actions in 2-3 wallet must have correct copayerNames', function(done) {
      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1'
          };
          helpers.createAndPublishTxProposal(clients[0], opts, (err, txp) => {
            should.not.exist(err);
            clients[0].rejectTxProposal(txp, 'wont sign', async (err, txp) => {
              should.not.exist(err);
              let signatures = await keys[1].sign(clients[1].getRootPath(), txp);
              clients[1].pushSignatures(txp, signatures, (err, txp) => {
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });
    });

    it('Send, reject, 2 signs and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1'
          };
          helpers.createAndPublishTxProposal(clients[0], opts, (err, txp) => {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(2);
            clients[0].rejectTxProposal(txp, 'wont sign', async (err, txp) => {
              should.not.exist(err);
              txp.status.should.equal('pending');
              let signatures = await keys[1].sign(clients[1].getRootPath(), txp);
              clients[1].pushSignatures(txp, signatures, async (err, txp) => {
                should.not.exist(err);
                let signatures = await keys[2].sign(clients[2].getRootPath(), txp);
                clients[2].pushSignatures(txp, signatures, (err, txp) => {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  clients[2].broadcastTxProposal(txp, (err, txp) => {
                    txp.status.should.equal('broadcasted');
                    txp.txid.should.equal(new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted).id);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('Send, reject in 3-4 wallet', function(done) {
      helpers.createAndJoinWallet(clients, keys, 3, 4, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 3);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1'
          };
          helpers.createAndPublishTxProposal(clients[0], opts, (err, txp) => {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(3);

            clients[0].rejectTxProposal(txp, 'wont sign', async (err, txp) => {
              should.not.exist(err);
              txp.status.should.equal('pending');
              let signatures = await keys[1].sign(clients[1].getRootPath(), txp);
              clients[1].pushSignatures(txp, signatures, (err, txp) => {
                should.not.exist(err);
                txp.status.should.equal('pending');
                clients[2].rejectTxProposal(txp, 'me neither', (err, txp) => {
                  should.not.exist(err);
                  txp.status.should.equal('rejected');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Should not allow to reject or sign twice', function(done) {
      helpers.createAndJoinWallet(clients, keys, 2, 3, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1'
          };
          helpers.createAndPublishTxProposal(clients[0], opts, async (err, txp) => {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(2);
            let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
            clients[0].pushSignatures(txp, signatures, (err, txp) => {
              should.not.exist(err);
              txp.status.should.equal('pending');
              clients[0].pushSignatures(txp, signatures, err => {
                should.exist(err);
                err.should.be.an.instanceOf(Errors.COPAYER_VOTED);
                clients[1].rejectTxProposal(txp, 'xx', (err, txp) => {
                  should.not.exist(err);
                  clients[1].rejectTxProposal(txp, 'xx', err => {
                    should.exist(err);
                    err.should.be.an.instanceOf(Errors.COPAYER_VOTED);
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

  describe('Broadcast raw transaction', () => {
    it('should broadcast raw tx', function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
        var opts = {
          network: 'testnet',
          rawTx:
            '0100000001b1b1b1b0d9786e237ec6a4b80049df9e926563fee7bdbc1ac3c4efc3d0af9a1c010000006a47304402207c612d36d0132ed463526a4b2370de60b0aa08e76b6f370067e7915c2c74179b02206ae8e3c6c84cee0bca8521704eddb40afe4590f14fd5d6434da980787ba3d5110121031be732b984b0f1f404840f2479bcc81f90187298efecc67dd83e1f93d9b2860dfeffffff0200ab9041000000001976a91403383bd4cff200de3690db1ed17d0b1a228ea43f88ac25ad6ed6190000001976a9147ccbaf7bcc1e323548bd1d57d7db03f6e6daf76a88acaec70700'
        };
        clients[0].broadcastRawTx(opts, (err, txid) => {
          should.not.exist(err);
          txid.should.equal('d19871cf7c123d413ac71f9240ea234fac77bc95bcf41015d8bf5c03f221b92c');
          done();
        });
      });
    });
  });

  describe('Transaction history', () => {
    it('should get transaction history', function(done) {
      blockchainExplorerMock.setHistory(createTxsV8(2, 1000));
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
        clients[0].createAddress(null, (err, x0) => {
          should.not.exist(err);
          should.exist(x0.address);
          clients[0].getTxHistory({}, (err, txs) => {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(2);
            done();
          });
        });
      });
    });
    it('should get empty transaction history when there are no addresses', function(done) {
      blockchainExplorerMock.setHistory([]);
      helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
        clients[0].getTxHistory({}, (err, txs) => {
          should.not.exist(err);
          should.exist(txs);
          txs.length.should.equal(0);
          done();
        });
      });
    });
    it('should get transaction history decorated with proposal & notes', function(done) {
      this.timeout(5000);
      async.waterfall(
        [
          next => {
            helpers.createAndJoinWallet(clients, keys, 2, 3, {}, w => {
              clients[0].createAddress(null, (err, address) => {
                should.not.exist(err);
                should.exist(address);
                next(null, address);
              });
            });
          },
          (address, next) => {
            blockchainExplorerMock.setUtxo(address, 10, 2);
            var opts = {
              amount: 10000,
              toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
              message: 'some message'
            };
            helpers.createAndPublishTxProposal(clients[0], opts, (err, txp) => {
              should.not.exist(err);
              clients[1].rejectTxProposal(txp, 'some reason', async (err, txp) => {
                should.not.exist(err);
                let signatures = await keys[2].sign(clients[2].getRootPath(), txp);
                clients[2].pushSignatures(txp, signatures, async (err, txp) => {
                  should.not.exist(err);
                  let signatures = await keys[0].sign(clients[0].getRootPath(), txp);
                  clients[0].pushSignatures(txp, signatures, (err, txp) => {
                    should.not.exist(err);
                    txp.status.should.equal('accepted');
                    clients[0].broadcastTxProposal(txp, (err, txp) => {
                      should.not.exist(err);
                      txp.status.should.equal('broadcasted');
                      next(null, txp);
                    });
                  });
                });
              });
            });
          },
          (txp, next) => {
            clients[1].editTxNote(
              {
                txid: txp.txid,
                body: 'just a note'
              },
              err => {
                return next(err, txp);
              }
            );
          },
          (txp, next) => {
            var history = createTxsV8(2, 1000);
            history[0].txid = txp.txid;
            for (const h of history) {
              h.blockTime = new Date().toISOString();
            }
            blockchainExplorerMock.setHistory(history);
            clients[0].getTxHistory({}, (err, txs) => {
              should.not.exist(err);
              should.exist(txs);
              txs.length.should.equal(2);
              var decorated = txs.find(tx => tx.txid === txp.txid);
              should.exist(decorated);
              decorated.proposalId.should.equal(txp.id);
              decorated.message.should.equal('some message');
              decorated.actions.length.should.equal(3);
              var rejection = decorated.actions.find(a => a.type === 'reject');
              should.exist(rejection);
              rejection.comment.should.equal('some reason');

              var note = decorated.note;
              should.exist(note);
              note.body.should.equal('just a note');
              note.editedByName.should.equal('copayer 1');
              next();
            });
          }
        ],
        err => {
          should.not.exist(err);
          done();
        }
      );
    });
    describe('should get paginated transaction history', function() {
      let testCases = [
        {
          opts: {},
          expected: [20, 10]
        },
        {
          opts: {
            skip: 1
          },
          expected: [10]
        },
        {
          opts: {
            limit: 1
          },
          expected: [20]
        },
        {
          opts: {
            skip: 3
          },
          expected: []
        },
        {
          opts: {
            skip: 1,
            limit: 10
          },
          expected: [10]
        }
      ];

      beforeEach(function(done) {
        let txs = createTxsV8(2, 1000);
        txs[0].blockTime = new Date(20 * 1000).toISOString();
        txs[1].blockTime = new Date(10 * 1000).toISOString();
        blockchainExplorerMock.setHistory(txs);
        helpers.createAndJoinWallet(clients, keys, 1, 1, {}, w => {
          clients[0].createAddress(null, (err, x0) => {
            should.not.exist(err);
            should.exist(x0.address);
            done();
          });
        });
      });
      for (const testCase of testCases) {
        it(`should skip ${testCase.opts.skip} limit ${testCase.opts.limit}`, function(done) {
          clients[0].getTxHistory(testCase.opts, (err, txs) => {
            should.not.exist(err);
            should.exist(txs);
            var times = txs.map(tx => tx.time);
            times.should.deep.equal(testCase.expected);
            done();
          });
        });
      }
    });
  });

  describe('Transaction notes', function() {
    beforeEach(function(done) {
      helpers.createAndJoinWallet(clients, keys, 1, 2, {}, w => {
        done();
      });
    });

    it('should edit a note for an arbitrary txid', function(done) {
      clients[0].editTxNote(
        {
          txid: '123',
          body: 'note body'
        },
        (err, note) => {
          should.not.exist(err);
          should.exist(note);
          note.body.should.equal('note body');
          clients[0].getTxNote(
            {
              txid: '123'
            },
            (err, note) => {
              should.not.exist(err);
              should.exist(note);
              note.txid.should.equal('123');
              note.walletId.should.equal(clients[0].credentials.walletId);
              note.body.should.equal('note body');
              note.editedBy.should.equal(clients[0].credentials.copayerId);
              note.editedByName.should.equal(clients[0].credentials.copayerName);
              note.createdOn.should.equal(note.editedOn);
              done();
            }
          );
        }
      );
    });
    it('should not send note body in clear text', function(done) {
      var spy = sandbox.spy(clients[0].request, 'put');
      clients[0].editTxNote(
        {
          txid: '123',
          body: 'a random note'
        },
        err => {
          should.not.exist(err);
          var url = spy.getCall(0).args[0];
          var body = JSON.stringify(spy.getCall(0).args[1]);
          url.should.contain('/txnotes');
          body.should.contain('123');
          body.should.not.contain('a random note');
          done();
        }
      );
    });

    it('should share notes between copayers', function(done) {
      clients[0].editTxNote(
        {
          txid: '123',
          body: 'note body'
        },
        err => {
          should.not.exist(err);
          clients[0].getTxNote(
            {
              txid: '123'
            },
            (err, note) => {
              should.not.exist(err);
              should.exist(note);
              note.editedBy.should.equal(clients[0].credentials.copayerId);
              var creator = note.editedBy;
              clients[1].getTxNote(
                {
                  txid: '123'
                },
                (err, note) => {
                  should.not.exist(err);
                  should.exist(note);
                  note.body.should.equal('note body');
                  note.editedBy.should.equal(creator);
                  done();
                }
              );
            }
          );
        }
      );
    });
    it('should get all notes edited past a given date', function(done) {
      var clock = sandbox.useFakeTimers({ toFake: ['Date'] });
      async.series(
        [
          next => {
            clients[0].getTxNotes({}, (err, notes) => {
              should.not.exist(err);
              notes.should.be.empty;
              next();
            });
          },
          next => {
            clients[0].editTxNote(
              {
                txid: '123',
                body: 'note body'
              },
              next
            );
          },
          next => {
            clients[0].getTxNotes(
              {
                minTs: 0
              },
              (err, notes) => {
                should.not.exist(err);
                notes.length.should.equal(1);
                notes[0].txid.should.equal('123');
                next();
              }
            );
          },
          next => {
            clock.tick(60 * 1000);
            clients[0].editTxNote(
              {
                txid: '456',
                body: 'another note'
              },
              next
            );
          },
          next => {
            clients[0].getTxNotes(
              {
                minTs: 0
              },
              (err, notes) => {
                should.not.exist(err);
                notes.length.should.equal(2);
                notes[0].txid.should.equal('123');
                notes[1].txid.should.equal('456');
                next();
              }
            );
          },
          next => {
            clients[0].getTxNotes(
              {
                minTs: 50
              },
              (err, notes) => {
                should.not.exist(err);
                notes.length.should.equal(1);
                notes[0].txid.should.equal('456');
                next();
              }
            );
          },
          next => {
            clock.tick(60 * 1000);
            clients[0].editTxNote(
              {
                txid: '123',
                body: 'an edit'
              },
              next
            );
          },
          next => {
            clients[0].getTxNotes(
              {
                minTs: 100
              },
              (err, notes) => {
                should.not.exist(err);
                notes.length.should.equal(1);
                notes[0].txid.should.equal('123');
                notes[0].body.should.equal('an edit');
                next();
              }
            );
          },
          next => {
            clients[0].getTxNotes({}, (err, notes) => {
              should.not.exist(err);
              notes.length.should.equal(2);
              next();
            });
          }
        ],
        err => {
          should.not.exist(err);
          clock.restore();
          done();
        }
      );
    });
  });

  describe('from Old credentials', () => {
    describe(`#upgradeCredentialsV1`, () => {
      for (const x of oldCredentials) {
        it(`should import old credentials: ${x.name}`, () => {
          let imported = Client.upgradeCredentialsV1(JSON.parse(x.blob));
          let k = imported.key;
          let c = imported.credentials;
          if (x.password) {
            k.decrypt(x.password);
          }

          for (const [expectedKey, expectedValue] of Object.entries(x.test.key)) {
            k.toObj()[expectedKey].should.be.equal(expectedValue);
          }
          for (const [expectedKey, expectedValue] of Object.entries(x.test.credentials)) {
            c[expectedKey].should.be.equal(expectedValue);
          }
        });
      }
    });

    describe(`#upgradeMultipleCredentialsV1`, () => {
      it(`should import many credentials`, () => {
        let oldies = oldCredentials.map(x => JSON.parse(x.blob));
        let imported = Client.upgradeMultipleCredentialsV1(oldies);

        imported.credentials.length.should.equal(oldies.length);

        // 1 read-only
        imported.keys.length.should.equal(oldies.length - 1);
        new Set(imported.credentials.map(cred => cred.keyId).filter(c => c)).size.should.equal(oldies.length - 1);

        for (const i in oldies) {
          const x = oldies[i];
          x.xPubKey.should.equal(imported.credentials[i].xPubKey);
        }
      });

      it(`should detect and merge with existing keys`, () => {
        let oldies = oldCredentials.map(x => JSON.parse(x.blob));

        // Create some keys.
        oldies[0] = JSON.parse(JSON.stringify(oldies[2]));
        oldies[1] = JSON.parse(JSON.stringify(oldies[2]));

        let imported = Client.upgradeMultipleCredentialsV1(oldies);
        imported.credentials.length.should.equal(oldies.length);

        // 1 read-only - 2 existing
        imported.keys.length.should.equal(oldies.length - 1 - 2);

        // should assign keyIds to existing keys
        let k = imported.credentials[0].keyId;
        imported.credentials[1].keyId.should.equal(k);
        imported.credentials[2].keyId.should.equal(k);

        // the resulting key should be returned
        imported.keys.filter(x => x.id == k).length.should.equal(1);
      });

      it(`should detect and merge with existing keys (2 wallets)`, () => {
        let oldies = oldCredentials.map(x => JSON.parse(x.blob));
        oldies = oldies.splice(0, 2);

        // Create some keys.
        oldies[0] = JSON.parse(JSON.stringify(oldies[1]));

        let imported = Client.upgradeMultipleCredentialsV1(oldies);
        imported.credentials.length.should.equal(oldies.length);

        imported.keys.length.should.equal(1);

        // should assign keyIds to existing keys
        let k = imported.credentials[0].keyId;
        imported.credentials[1].keyId.should.equal(k);

        // the resulting key should be returned
        imported.keys.filter(x => x.id == k).length.should.equal(1);
      });
    });
  });

  describe('Mobility, backup & restore', () => {
    describe('Export & Import', () => {
      var address, importedClient;
      describe('Compliant derivation', () => {
        beforeEach(function(done) {
          importedClient = null;
          helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
            clients[0].createAddress(null, (err, addr) => {
              should.not.exist(err);
              should.exist(addr.address);
              address = addr.address;
              done();
            });
          });
        });
        afterEach(function(done) {
          if (!importedClient) return done();
          importedClient.getMainAddresses({}, (err, list) => {
            should.not.exist(err);
            should.exist(list);
            list.length.should.equal(1);
            list[0].address.should.equal(address);
            done();
          });
        });

        it('should export & import with mnemonics + BWS', function(done) {
          var c = clients[0].credentials;
          var walletId = c.walletId;
          var walletName = c.walletName;
          var copayerName = c.copayerName;
          var key = c.xPubKey;

          var exported = clients[0].toString();
          importedClient = helpers.newClient(app);
          importedClient.fromString(exported);
          var c2 = importedClient.credentials;
          c2.xPubKey.should.equal(key);
          c2.walletId.should.equal(walletId);
          c2.walletName.should.equal(walletName);
          c2.copayerName.should.equal(copayerName);

          // Will check addresses on afterEach
          done();
        });

        it.skip('should export & import with mnemonic encrypted ', function(done) {
          var c = clients[0].credentials;
          var walletId = c.walletId;
          var walletName = c.walletName;
          var copayerName = c.copayerName;
          var key = c.xPubKey;

          var exported = clients[0].toString();
          importedClient = helpers.newClient(app);
          importedClient.fromString(exported);
          var c2 = importedClient.credentials;
          c2.xPubKey.should.equal(key);
          c2.walletId.should.equal(walletId);
          c2.walletName.should.equal(walletName);
          c2.copayerName.should.equal(copayerName);

          // Will check addresses on afterEach
          done();
        });

        it('should export & import from Key +  BWS', function(done) {
          var c = clients[0].credentials;
          var walletId = c.walletId;
          var walletName = c.walletName;
          var copayerName = c.copayerName;
          var network = c.network;
          var pub = c.xPubKey;

          importedClient = helpers.newClient(app);
          importedClient.fromString(
            keys[0].createCredentials(null, {
              coin: 'btc',
              network: 'testnet',
              account: 0,
              n: 1
            })
          );
          var c2 = importedClient.credentials;
          c2.xPubKey.should.equal(pub);
          importedClient.openWallet(null, err => {
            should.not.exist(err);
            c2.walletId.should.equal(walletId);
            c2.walletName.should.equal(walletName);
            c2.copayerName.should.equal(copayerName);

            // Will check addresses on afterEach
            done();
          });
        });
      });

      describe('Non-compliant derivation', () => {
        var setup = function(done) {
          clients[0].createWallet(
            'mywallet',
            'creator',
            1,
            1,
            {
              network: 'livenet'
            },
            err => {
              should.not.exist(err);
              clients[0].createAddress(null, (err, addr) => {
                should.not.exist(err);
                address = addr.address;
                done();
              });
            }
          );
        };

        beforeEach(() => {
          importedClient = null;
        });
        afterEach(function(done) {
          if (!importedClient) return done();
          importedClient.getMainAddresses({}, (err, list) => {
            should.not.exist(err);
            should.exist(list);
            list.length.should.equal(1);
            list[0].address.should.equal(address);
            done();
          });
        });

        /*
                  k.get().xPrivKey.should.equal('xprv9s21ZrQH143K3E71Wm5nrxuMdqCTMG6AM5Xyp4dJ3ZkUj2gEpfifT5Hc1cfqnycKooRpzoH4gjmAKDmGGaH2k2cSe29EcQSarveq6STBZZW');
                  clients[0].credentials.xPubKey.toString().should.equal('xpub6CLj2x8T5zwngq3Uq42PbXbAXnyaUtsANEZaBjAPNBn5PbhSJM29DM5nhrdJDNpEy9X3n5sQhk6CNA7PKTp48Xvq3QFdiYAXAcaWEJ6Xmug');
                  setup(() =>{
                    let k2 = Key.fromMnemonicAndServer('pink net pet stove boy receive task nephew book spawn pull regret', { client: helpers.newClient(app)}, (err, clients) => {
                      should.not.exist(err);
                      clients.length.should.equal(1);
                      importedClient = clients[0];
                      importedClient.openWallet(null, (err) =>{
                        should.not.exist(err);
                        done();
                      });
        */
        it('should export & import with mnemonics + BWS', function(done) {
          let k = new Key({
            seedData: 'pink net pet stove boy receive task nephew book spawn pull regret',
            seedType: 'mnemonic',
            nonCompliantDerivation: true
          });

          clients[0].fromString(
            k.createCredentials(null, {
              coin: 'btc',
              network: 'livenet',
              account: 0,
              n: 1
            })
          );

          k.get(null).xPrivKey.should.equal(
            'xprv9s21ZrQH143K3E71Wm5nrxuMdqCTMG6AM5Xyp4dJ3ZkUj2gEpfifT5Hc1cfqnycKooRpzoH4gjmAKDmGGaH2k2cSe29EcQSarveq6STBZZW'
          );
          clients[0].credentials.xPubKey
            .toString()
            .should.equal(
              'xpub6CLj2x8T5zwngq3Uq42PbXbAXnyaUtsANEZaBjAPNBn5PbhSJM29DM5nhrdJDNpEy9X3n5sQhk6CNA7PKTp48Xvq3QFdiYAXAcaWEJ6Xmug'
            );
          setup(() => {
            importedClient = helpers.newClient(app);
            let k2 = new Key({
              seedData: 'pink net pet stove boy receive task nephew book spawn pull regret',
              seedType: 'mnemonic',
              nonCompliantDerivation: true
            });
            importedClient.fromString(
              k2.createCredentials(null, {
                coin: 'btc',
                network: 'livenet',
                account: 0,
                n: 1
              })
            );
            importedClient.openWallet(null, err => {
              should.not.exist(err);
              done();
            });
          });
        });

        it('should check BWS once if specific derivation is not problematic', function(done) {
          // this key derivation is equal for compliant and non-compliant
          let k = new Key({
            seedData: 'relax about label gentle insect cross summer helmet come price elephant seek',
            seedType: 'mnemonic',
            nonCompliantDerivation: true
          });

          clients[0].fromString(
            k.createCredentials(null, {
              coin: 'btc',
              network: 'livenet',
              account: 0,
              n: 1
            })
          );

          // no setup.
          importedClient = helpers.newClient(app);
          importedClient.fromString(
            k.createCredentials(null, {
              coin: 'btc',
              network: 'livenet',
              account: 0,
              n: 1
            })
          );

          var spy = sandbox.spy(importedClient, 'openWallet');
          importedClient.openWallet(null, err => {
            should.exist(err);
            err.should.be.an.instanceOf(Errors.NOT_AUTHORIZED);
            spy.getCalls().length.should.equal(1);
            importedClient = null;
            done();
          });
        });
      });
    });

    describe('#validateKeyDerivation', () => {
      beforeEach(function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
          done();
        });
      });
      it('should validate key derivation (fail)', function(done) {
        let x = Utils.signMessage;
        Utils.signMessage = () => {
          return 'xxxx';
        };
        clients[0].validateKeyDerivation({}, (err, isValid) => {
          should.not.exist(err);
          isValid.should.be.false;
          clients[0].keyDerivationOk.should.be.false;
          Utils.signMessage = x;
          done();
        });
      });

      it('should validate key derivation', function(done) {
        clients[0].validateKeyDerivation({}, (err, isValid) => {
          should.not.exist(err);
          isValid.should.be.true;
          clients[0].keyDerivationOk.should.be.true;
          done();
        });
      });
    });

    describe('#import FromMnemonic', () => {
      it('should handle importing an invalid mnemonic', function(done) {
        var mnemonicWords = 'this is an invalid mnemonic';
        Client.serverAssistedImport({ words: mnemonicWords }, {}, err => {
          should.exist(err);
          err.should.be.an.instanceOf(Errors.INVALID_BACKUP);
          done();
        });
      });
    });

    describe('#import FromExtendedPrivateKey', () => {
      it('should handle importing an invalid extended private key', function(done) {
        var xPrivKey = 'this is an invalid key';
        Client.serverAssistedImport({ xPrivKey }, {}, err => {
          should.exist(err);
          err.should.be.an.instanceOf(Errors.INVALID_BACKUP);
          done();
        });
      });
    });

    describe('Recovery', () => {
      let db2;
      let connection2;
      before(function(done) {
        helpers.newDb(2, (err, db, conn) => {
          db2 = db;
          connection2 = conn;
          return done(err);
        });
      });
      
      after(function(done) {
        connection2.close(done);
      });

      it('should be able to gain access to a 1-1 wallet from mnemonic', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;

          clients[0].createAddress(null, (err, addr) => {
            should.not.exist(err);
            should.exist(addr);
            Client.serverAssistedImport(
              { words, includeTestnetWallets: true, includeLegacyWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                should.not.exist(err);
                c.length.should.equal(1);
                const recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.getMainAddresses({}, (err, list) => {
                    should.not.exist(err);
                    should.exist(list);
                    list[0].address.should.equal(addr.address);
                    done();
                  });
                });
              }
            );
          });
        });
      });

      it('should be able to gain access to eth tokens wallets from mnemonic', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var tokenAddresses = [
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd'
          ];

          clients[0].savePreferences(
            {
              tokenAddresses
            },
            err => {
              should.not.exist(err);
              Client.serverAssistedImport(
                { words, includeTestnetWallets: true },
                helpers.newClient(app),
                (err, k, c) => {
                  // the eth wallet + 2 tokens.
                  c.length.should.equal(3);
                  let recoveryClient = c[0];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.credentials.walletId.should.equal(walletId);
                    recoveryClient.credentials.coin.should.equal('eth');
                    recoveryClient.credentials.chain.should.equal('eth');
                    let recoveryClient2 = c[2];
                    recoveryClient2.openWallet(null, err => {
                      should.not.exist(err);
                      recoveryClient2.credentials.coin.should.equal('gusd');
                      should.exist(recoveryClient2.credentials.chain);
                      recoveryClient2.credentials.chain.should.equal('eth');
                    recoveryClient2.credentials.walletId.should.equal(`${walletId}-${tokenAddresses[1]}`);
                      done();
                    });
                  });
                }
              );
            }
          );
        });
      });

      it('should be able to gain access to eth tokens wallets from mnemonic (Case 2)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var tokenAddresses = [
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          ];

          clients[0].savePreferences({ tokenAddresses }, err => {
            should.not.exist(err);
            Client.serverAssistedImport(
              { words, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                // the eth wallet + 1 token.
                c.length.should.equal(2);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('eth');
                  recoveryClient.credentials.chain.should.equal('eth');
                  let recoveryClient2 = c[1];
                  recoveryClient2.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient2.credentials.coin.should.equal('usdc');
                    should.exist(recoveryClient2.credentials.chain);
                    recoveryClient2.credentials.chain.should.equal('eth');
                    recoveryClient2.credentials.walletId.should.equal(`${walletId}-${tokenAddresses[0]}`);
                    done();
                  });
                });
              }
            );
          });
        });
      });

      it('should not fail to gain access to eth wallet with unknown tokens addresses from mnemonic (Case 3)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var tokenAddresses = [
            '0x9da9bc12b19b22d7c55798f722a1b6747ae9a710',
          ];

          clients[0].savePreferences({ tokenAddresses }, err => {
            should.not.exist(err);
              Client.serverAssistedImport(
              { words, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                // the eth wallet + 1 unknown token addresses on preferences.
                c.length.should.equal(1);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('eth');
                  recoveryClient.credentials.chain.should.equal('eth');
                  done();
                });
              })
          });
        });
      });

      it('should be able to gain access to matic tokens wallets from mnemonic', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'matic', chain: 'matic' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var maticTokenAddresses = [
            '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'
          ];
          clients[0].savePreferences(
            {
              maticTokenAddresses
            },
            err => {
              should.not.exist(err);
              Client.serverAssistedImport(
                { words, includeTestnetWallets: true  },
                helpers.newClient(app),
                (err, k, c) => {
                  // the matic wallet + 2 tokens.
                  c.length.should.equal(3);
                  let recoveryClient = c[0];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.credentials.walletId.should.equal(walletId);
                    recoveryClient.credentials.coin.should.equal('matic');
                    recoveryClient.credentials.chain.should.equal('matic');
                    let recoveryClient2 = c[2];
                    recoveryClient2.openWallet(null, err => {
                      should.not.exist(err);
                      recoveryClient2.credentials.coin.should.equal('dai');
                      should.exist(recoveryClient2.credentials.chain);
                      recoveryClient2.credentials.chain.should.equal('matic');
                      recoveryClient2.credentials.walletId.should.equal(`${walletId}-${maticTokenAddresses[1]}`);
                      done();
                    });
                  });
                }
              );
            }
          );
        });
      });

      it('should be able to gain access to matic tokens wallets from mnemonic (Case 2)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'matic', chain: 'matic' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var maticTokenAddresses = [
            '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          ];

          clients[0].savePreferences({ maticTokenAddresses }, err => {
            should.not.exist(err);
            Client.serverAssistedImport(
              { words, includeTestnetWallets: true  },
              helpers.newClient(app),
              (err, k, c) => {
                // the matic wallet + 1 token.
                c.length.should.equal(2);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('matic');
                  recoveryClient.credentials.chain.should.equal('matic');
                  let recoveryClient2 = c[1];
                  recoveryClient2.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient2.credentials.coin.should.equal('usdc.e');
                    should.exist(recoveryClient2.credentials.chain);
                    recoveryClient2.credentials.chain.should.equal('matic');
                    recoveryClient2.credentials.walletId.should.equal(`${walletId}-${maticTokenAddresses[0]}`);
                    done();
                  });
                });
              }
            );
          });
        });
      });

      it('should not fail to gain access to matic wallet with unknown tokens addresses from mnemonic (Case 3)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'matic', chain: 'matic' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var maticTokenAddresses = [
            '0x9da9bc12b19b22d7c55798f722a1b6747ae9a710',
          ];

          clients[0].savePreferences({ maticTokenAddresses }, err => {
            should.not.exist(err);
              Client.serverAssistedImport(
              { words, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                // the matic wallet + 1 unknown token addresses on preferences.
                c.length.should.equal(1);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('matic');
                  recoveryClient.credentials.chain.should.equal('matic');
                  done();
                });
              })
          });
        });
      });

      it('should be able to gain access to op tokens wallets from mnemonic', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'op' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var opTokenAddresses = [
            '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
            '0x68f180fcce6836688e9084f035309e29bf0a2095'
          ];
          clients[0].savePreferences(
            {
              opTokenAddresses
            },
            err => {
              should.not.exist(err);
              Client.serverAssistedImport(
                { words, includeTestnetWallets: true  },
                helpers.newClient(app),
                (err, k, c) => {
                  // the op wallet + 2 tokens.
                  c.length.should.equal(3);
                  let recoveryClient = c[0];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.credentials.walletId.should.equal(walletId);
                    recoveryClient.credentials.coin.should.equal('eth');
                    recoveryClient.credentials.chain.should.equal('op');
                    let recoveryClient2 = c[2];
                    recoveryClient2.openWallet(null, err => {
                      should.not.exist(err);
                      recoveryClient2.credentials.coin.should.equal('wbtc');
                      should.exist(recoveryClient2.credentials.chain);
                      recoveryClient2.credentials.chain.should.equal('op');
                      recoveryClient2.credentials.walletId.should.equal(`${walletId}-${opTokenAddresses[1]}`);
                      done();
                    });
                  });
                }
              );
            }
          );
        });
      });

      it('should be able to gain access to op tokens wallets from mnemonic (Case 2)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'op' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var opTokenAddresses = [
            '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
          ];

          clients[0].savePreferences({ opTokenAddresses }, err => {
            should.not.exist(err);
            Client.serverAssistedImport(
              { words, includeTestnetWallets: true  },
              helpers.newClient(app),
              (err, k, c) => {
                // the op wallet + 1 token.
                c.length.should.equal(2);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('eth');
                  recoveryClient.credentials.chain.should.equal('op');
                  let recoveryClient2 = c[1];
                  recoveryClient2.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient2.credentials.coin.should.equal('usdc');
                    should.exist(recoveryClient2.credentials.chain);
                    recoveryClient2.credentials.chain.should.equal('op');
                    recoveryClient2.credentials.walletId.should.equal(`${walletId}-${opTokenAddresses[0]}`);
                    done();
                  });
                });
              }
            );
          });
        });
      });
      
      it('should not fail to gain access to op wallet with unknown tokens addresses from mnemonic (Case 3)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'op' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var opTokenAddresses = [
            '0x9da9bc12b19b22d7c55798f722a1b6747ae9a710',
          ];

          clients[0].savePreferences({ opTokenAddresses }, err => {
            should.not.exist(err);
              Client.serverAssistedImport(
              { words, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                // the op wallet + 1 unknown token addresses on preferences.
                c.length.should.equal(1);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('eth');
                  recoveryClient.credentials.chain.should.equal('op');
                  done();
                });
              })
          });
        });
      });

      it('should be able to gain access to base tokens wallets from mnemonic', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'base' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var baseTokenAddresses = [
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            '0x4200000000000000000000000000000000000006'
          ];
          clients[0].savePreferences(
            {
              baseTokenAddresses
            },
            err => {
              should.not.exist(err);
              Client.serverAssistedImport(
                { words, includeTestnetWallets: true },
                helpers.newClient(app),
                (err, k, c) => {
                  // the base wallet + 2 tokens.
                  c.length.should.equal(3);
                  let recoveryClient = c[0];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.credentials.walletId.should.equal(walletId);
                    recoveryClient.credentials.coin.should.equal('eth');
                    recoveryClient.credentials.chain.should.equal('base');
                    let recoveryClient2 = c[2];
                    recoveryClient2.openWallet(null, err => {
                      should.not.exist(err);
                      recoveryClient2.credentials.coin.should.equal('weth');
                      should.exist(recoveryClient2.credentials.chain);
                      recoveryClient2.credentials.chain.should.equal('base');
                      recoveryClient2.credentials.walletId.should.equal(`${walletId}-${baseTokenAddresses[1]}`);
                      done();
                    });
                  });
                }
              );
            }
          );
        });
      });
      
      it('should be able to gain access to base tokens wallets from mnemonic (Case 2)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'base' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var baseTokenAddresses = [
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          ];

          clients[0].savePreferences({ baseTokenAddresses }, err => {
            should.not.exist(err);
            Client.serverAssistedImport(
              { words, includeTestnetWallets: true  },
              helpers.newClient(app),
              (err, k, c) => {
                // the base wallet + 1 token.
                c.length.should.equal(2);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('eth');
                  recoveryClient.credentials.chain.should.equal('base');
                  let recoveryClient2 = c[1];
                  recoveryClient2.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient2.credentials.coin.should.equal('usdc');
                    should.exist(recoveryClient2.credentials.chain);
                    recoveryClient2.credentials.chain.should.equal('base');
                    recoveryClient2.credentials.walletId.should.equal(`${walletId}-${baseTokenAddresses[0]}`);
                    done();
                  });
                });
              }
            );
          });
        });
      });

      it('should not fail to gain access to base wallet with unknown tokens addresses from mnemonic (Case 3)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'base' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var baseTokenAddresses = [
            '0x9da9bc12b19b22d7c55798f722a1b6747ae9a710',
          ];
      
          clients[0].savePreferences({ baseTokenAddresses }, err => {
            should.not.exist(err);
              Client.serverAssistedImport(
              { words, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                // the base wallet + unknown token addresses should be ignored.
                c.length.should.equal(1);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('eth');
                  recoveryClient.credentials.chain.should.equal('base');
                  done();
                });
              })
          });
        });
      });

      it('should be able to gain access to arb tokens wallets from mnemonic', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'arb' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var arbTokenAddresses = [
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
            '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f'
          ];
          clients[0].savePreferences(
            {
              arbTokenAddresses
            },
            err => {
              should.not.exist(err);
              Client.serverAssistedImport(
                { words, includeTestnetWallets: true },
                helpers.newClient(app),
                (err, k, c) => {
                  // the arb wallet + 2 tokens.
                  c.length.should.equal(3);
                  let recoveryClient = c[0];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.credentials.walletId.should.equal(walletId);
                    recoveryClient.credentials.coin.should.equal('eth');
                    recoveryClient.credentials.chain.should.equal('arb');
                    let recoveryClient2 = c[2];
                    recoveryClient2.openWallet(null, err => {
                      should.not.exist(err);
                      recoveryClient2.credentials.coin.should.equal('wbtc');
                      should.exist(recoveryClient2.credentials.chain);
                      recoveryClient2.credentials.chain.should.equal('arb');
                      recoveryClient2.credentials.walletId.should.equal(`${walletId}-${arbTokenAddresses[1]}`);
                      done();
                    });
                  });
                }
              );
            }
          );
        });
      });

      it('should be able to gain access to arb tokens wallets from mnemonic (Case 2)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'arb' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var arbTokenAddresses = [
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
          ];

          clients[0].savePreferences({ arbTokenAddresses }, err => {
            should.not.exist(err);
            Client.serverAssistedImport(
              { words, includeTestnetWallets: true  },
              helpers.newClient(app),
              (err, k, c) => {
                // the arb wallet + 1 token.
                c.length.should.equal(2);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('eth');
                  recoveryClient.credentials.chain.should.equal('arb');
                  let recoveryClient2 = c[1];
                  recoveryClient2.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient2.credentials.coin.should.equal('usdc');
                    should.exist(recoveryClient2.credentials.chain);
                    recoveryClient2.credentials.chain.should.equal('arb');
                    recoveryClient2.credentials.walletId.should.equal(`${walletId}-${arbTokenAddresses[0]}`);
                    done();
                  });
                });
              }
            );
          });
        });
      });

      it('should not fail to gain access to arb wallet with unknown tokens addresses from mnemonic (Case 3)', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'eth', chain: 'arb' }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          var walletId = clients[0].credentials.walletId;
          var arbTokenAddresses = [
            '0x9da9bc12b19b22d7c55798f722a1b6747ae9a710',
          ];
      
          clients[0].savePreferences({ arbTokenAddresses }, err => {
            should.not.exist(err);
              Client.serverAssistedImport(
              { words, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                // the arb wallet + unknown token addresses should be ignored.
                c.length.should.equal(1);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.walletId.should.equal(walletId);
                  recoveryClient.credentials.coin.should.equal('eth');
                  recoveryClient.credentials.chain.should.equal('arb');
                  done();
                });
              })
          });
        });
      });

      
      it('should be able to gain access to two TESTNET btc/bch 1-1 wallets from mnemonic', function(done) {
        let key = new Key({ seedType: 'new' });
        helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key }, () => {
          helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'bch', key: key }, () => {
            var words = keys[0].get(null, true).mnemonic;
            var walletName = clients[0].credentials.walletName;
            var copayerName = clients[0].credentials.copayerName;
            clients[0].createAddress(null, (err, addr) => {
              should.not.exist(err);
              should.exist(addr);
              Client.serverAssistedImport(
                { words, includeTestnetWallets: true },
                helpers.newClient(app),
                (err, k, c) => {
                  should.not.exist(err);
                  c.length.should.equal(2);
                  c[0].credentials.coin.should.equal('btc');
                  c[1].credentials.coin.should.equal('bch');
                  c[0].credentials.copayerId.should.not.equal(c[1].credentials.copayerId);

                  let recoveryClient = c[1];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.getMainAddresses({}, (err, list) => {
                      should.not.exist(err);
                      should.exist(list);
                      list[0].address.should.equal(addr.address);
                      done();
                    });
                  });
                }
              );
            });
          });
        });
      });

      it('should be able to gain access to two TESTNET btc/bch 1-1 wallets from mnemonic', function(done) {
        let key = new Key({ seedType: 'new' });
        helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, network: 'livenet' }, () => {
          helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: 'bch', key: key, network: 'livenet' }, () => {
            var words = keys[0].get(null, true).mnemonic;
            var walletName = clients[0].credentials.walletName;
            var copayerName = clients[0].credentials.copayerName;
            clients[0].createAddress(null, (err, addr) => {
              should.not.exist(err);
              should.exist(addr);
              Client.serverAssistedImport(
                { words, includeTestnetWallets: true},
                helpers.newClient(app),
                (err, k, c) => {
                  should.not.exist(err);
                  c.length.should.equal(2);
                  c[0].credentials.coin.should.equal('btc');
                  c[1].credentials.coin.should.equal('bch');
                  c[0].credentials.copayerId.should.not.equal(c[1].credentials.copayerId);
                  let recoveryClient = c[1];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.getMainAddresses({}, (err, list) => {
                      should.not.exist(err);
                      should.exist(list);
                      list[0].address.should.equal(addr.address);
                      done();
                    });
                  });
                }
              );
            });
          });
        });
      });

      it('should be able to gain access to three btc 1-1 accounts of a single wallet from mnemonic and add wallet info correctly to all of them', function(done) {
        let key = new Key({ seedType: 'new' });
        helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key }, () => {
          helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, account: 1 }, () => {
            helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, account: 2 }, () => {
              var words = keys[0].get(null, true).mnemonic;
              var walletName = clients[0].credentials.walletName;
              var copayerName = clients[0].credentials.copayerName;
              clients[0].createAddress(null, (err, addr) => {
                should.not.exist(err);
                should.exist(addr);
                Client.serverAssistedImport(
                  { words, includeTestnetWallets: true },
                  helpers.newClient(app),
                  (err, k, c) => {
                    should.not.exist(err);
                    c.length.should.equal(3);
                    c[0].credentials.coin.should.equal('btc');
                    c[1].credentials.coin.should.equal('btc');
                    c[2].credentials.coin.should.equal('btc');
                    c[0].credentials.account.should.equal(0);
                    c[1].credentials.account.should.equal(1);
                    c[2].credentials.account.should.equal(2);
                    c[0].credentials.copayerId.should.not.equal(c[1].credentials.copayerId);
                    c[0].credentials.copayerId.should.not.equal(c[2].credentials.copayerId);
                    c[1].credentials.copayerId.should.not.equal(c[2].credentials.copayerId);
                    should.exist(c[0].credentials.walletId);
                    should.exist(c[1].credentials.walletId);
                    should.exist(c[2].credentials.walletId);
                    let recoveryClient = c[2];
                    recoveryClient.openWallet(null, err => {
                      should.not.exist(err);
                      recoveryClient.credentials.walletName.should.equal(walletName);
                      recoveryClient.credentials.copayerName.should.equal(copayerName);
                      recoveryClient.getMainAddresses({}, (err, list) => {
                        should.not.exist(err);
                        should.exist(list);
                        list[0].address.should.equal(addr.address);
                        done();
                      });
                    });
                  }
                );
              });
            });
          });
        });
      });

      it('should be able to gain access to seven btc 1-1 accounts of a single wallet from mnemonic', function(done) {
        let key = new Key({ seedType: 'new' });
        helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key }, () => {
          helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, account: 1 }, () => {
            helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, account: 2 }, () => {
              helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, account: 3 }, () => {
                helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, account: 4 }, () => {
                  helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, account: 5 }, () => {
                    helpers.createAndJoinWallet(clients, keys, 1, 1, { key: key, account: 6 }, () => {
                      var words = keys[0].get(null, true).mnemonic;
                      var walletName = clients[0].credentials.walletName;
                      var copayerName = clients[0].credentials.copayerName;
                      clients[0].createAddress(null, (err, addr) => {
                        should.not.exist(err);
                        should.exist(addr);
                        Client.serverAssistedImport(
                          { words, includeTestnetWallets: true },
                          helpers.newClient(app),
                          (err, k, c) => {
                            should.not.exist(err);
                            c.length.should.equal(7);
                            // check the following data on each of the clients
                            for (let i = 0; i < c.length; i++) {
                              c[i].credentials.coin.should.equal('btc');
                              c[i].credentials.account.should.equal(i);
                            }
                            // make sure only one client has each copayerId
                            c.every(client => {
                              let copayerId = client.credentials.copayerId;
                              return c.filter(x => x.credentials.copayerId === copayerId).length === 1;
                            }).should.equal(true);


                            let recoveryClient = c[6];
                            recoveryClient.openWallet(null, err => {
                              should.not.exist(err);
                              recoveryClient.credentials.walletName.should.equal(walletName);
                              recoveryClient.credentials.copayerName.should.equal(copayerName);
                              recoveryClient.getMainAddresses({}, (err, list) => {
                                should.not.exist(err);
                                should.exist(list);
                                list[0].address.should.equal(addr.address);
                                done();
                              });
                            });
                          }
                        );
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('should be able to gain access to three arb accounts from mnemonic and add wallet info correctly to all of them', function(done) {
        let key = new Key({ seedType: 'new' });
        helpers.createAndJoinWallet(clients, keys, 1, 1, {key, coin: 'eth', chain: 'arb'}, () => {
          helpers.createAndJoinWallet(clients, keys, 1, 1, {key, coin: 'eth', chain: 'arb', account: 1}, () => {
            helpers.createAndJoinWallet(clients, keys, 1, 1, {key, coin: 'eth', chain: 'arb', account: 2}, () => {
              var words = keys[0].get(null, true).mnemonic;
              var walletName = clients[0].credentials.walletName;
              var copayerName = clients[0].credentials.copayerName;
              clients[0].createAddress(null, (err, addr) => {
                should.not.exist(err);
                should.exist(addr);
                Client.serverAssistedImport(
                  { words, includeTestnetWallets: true },
                  helpers.newClient(app),
                  (err, k, c) => {
                    should.not.exist(err);
                    c.length.should.equal(3);
                    c[0].credentials.coin.should.equal('eth');
                    c[1].credentials.coin.should.equal('eth');
                    c[2].credentials.coin.should.equal('eth');
                    c[0].credentials.chain.should.equal('arb');
                    c[1].credentials.chain.should.equal('arb');
                    c[2].credentials.chain.should.equal('arb');
                    c[0].credentials.account.should.equal(0);
                    c[1].credentials.account.should.equal(1);
                    c[2].credentials.account.should.equal(2);
                    c[0].credentials.copayerId.should.not.equal(c[1].credentials.copayerId);
                    c[0].credentials.copayerId.should.not.equal(c[2].credentials.copayerId);
                    c[1].credentials.copayerId.should.not.equal(c[2].credentials.copayerId);
                    should.exist(c[0].credentials.walletId);
                    should.exist(c[1].credentials.walletId);
                    should.exist(c[2].credentials.walletId);
                    let recoveryClient = c[2];
                    recoveryClient.openWallet(null, err => {
                      should.not.exist(err);
                      recoveryClient.credentials.walletName.should.equal(walletName);
                      recoveryClient.credentials.copayerName.should.equal(copayerName);
                      recoveryClient.getMainAddresses({}, (err, list) => {
                        should.not.exist(err);
                        should.exist(list);
                        list[0].address.should.equal(addr.address);
                        done();
                      });
                    });
                  }
                );
              });
            });
          });
        });
      });

      it('should be able to gain access to a 1-1 wallet from mnemonic with passphrase', function(done) {
        let passphrase = 'xxx';
        helpers.createAndJoinWallet(clients, keys, 1, 1, { passphrase }, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          clients[0].createAddress(null, (err, addr) => {
            should.not.exist(err);
            should.exist(addr);
            Client.serverAssistedImport(
              { words, passphrase, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                should.not.exist(err);
                c.length.should.equal(1);

                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.getMainAddresses({}, (err, list) => {
                    should.not.exist(err);
                    should.exist(list);
                    list[0].address.should.equal(addr.address);
                    done();
                  });
                });
              }
            );
          });
        });
      });

      it('should be able to gain access to a 1-1 wallet with just the xPriv', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
          var xPrivKey = keys[0].get(null).xPrivKey;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          clients[0].createAddress(null, (err, addr) => {
            should.not.exist(err);
            should.exist(addr);
            Client.serverAssistedImport(
              { xPrivKey, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, key, c) => {
                const k = key.toObj();
                k.xPrivKey.should.equal(xPrivKey);
                k.compliantDerivation.should.equal(true);
                k.use0forBCH.should.equal(false);
                k.use44forMultisig.should.equal(false);
                should.not.exist(err);
                c.length.should.equal(1);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.getMainAddresses({}, (err, list) => {
                    should.not.exist(err);
                    should.exist(list);
                    list[0].address.should.equal(addr.address);
                    done();
                  });
                });
              }
            );
          });
        });
      });

      it('should be able to gain access to a 2-2 wallet from mnemonic', function(done) {
        helpers.createAndJoinWallet(clients, keys, 2, 2, {}, () => {
          var words = keys[0].get(null, true).mnemonic;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;
          clients[0].createAddress(null, (err, addr) => {
            should.not.exist(err);
            should.exist(addr);
            Client.serverAssistedImport(
              { words, includeTestnetWallets: true },
              helpers.newClient(app),
              (err, k, c) => {
                k.compliantDerivation.should.equal(true);
                k.use0forBCH.should.equal(false);
                k.use44forMultisig.should.equal(false);
                should.not.exist(err);
                c.length.should.equal(1);
                let recoveryClient = c[0];
                recoveryClient.openWallet(null, err => {
                  should.not.exist(err);
                  recoveryClient.credentials.walletName.should.equal(walletName);
                  recoveryClient.credentials.copayerName.should.equal(copayerName);
                  recoveryClient.credentials.m.should.equal(2);
                  recoveryClient.credentials.n.should.equal(2);
                  recoveryClient.getMainAddresses({}, (err, list) => {
                    should.not.exist(err);
                    should.exist(list);
                    list[0].address.should.equal(addr.address);
                    done();
                  });
                });
              }
            );
          });
        });
      });

      it('should fail to gain access to a 1-1 wallet from wrong mnemonic', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
          const key = new Key({ seedType: 'new' });
          const words = key.get().mnemonic;
          Client.serverAssistedImport(
            { words },
            helpers.newClient(app),
            (err, k, c) => {
              should.not.exist(err);
              c.length.should.equal(0);
              done();
            }
          );
        });
      });

      it("should be able to gain access to a OLD 44' 2-2 wallet from mnemonic", function(done) {
        helpers.createAndJoinWallet(
          clients,
          keys,
          2,
          2,
          {
            useLegacyPurpose: true
          },
          () => {
            var words = keys[0].get(null, true).mnemonic;
            var walletName = clients[0].credentials.walletName;
            var copayerName = clients[0].credentials.copayerName;
            clients[0].createAddress(null, (err, addr) => {
              should.not.exist(err);
              should.exist(addr);
              Client.serverAssistedImport(
                { words, includeLegacyWallets: true, includeTestnetWallets: true },
                helpers.newClient(app),
                (err, k, c) => {
                  should.exist(k);
                  should.exist(c[0]);
                  k.compliantDerivation.should.equal(true);
                  k.use0forBCH.should.equal(false);
                  k.use44forMultisig.should.equal(true);

                  should.not.exist(err);
                  c.length.should.equal(1);
                  let recoveryClient = c[0];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.credentials.m.should.equal(2);
                    recoveryClient.credentials.n.should.equal(2);
                    recoveryClient.getMainAddresses({}, (err, list) => {
                      should.not.exist(err);
                      should.exist(list);
                      list[0].address.should.equal(addr.address);
                      done();
                    });
                  });
                }
              );
            });
          }
        );
      });

      it("should be able to gain access to a OLD 44' 2-3 wallet from mnemonic", function(done) {
        this.timeout(5000);
        helpers.createAndJoinWallet(
          clients,
          keys,
          2,
          3,
          {
            useLegacyPurpose: true
          },
          () => {
            var words = keys[0].get(null, true).mnemonic;
            var walletName = clients[0].credentials.walletName;
            var copayerName = clients[0].credentials.copayerName;
            clients[0].createAddress(null, (err, addr) => {
              should.not.exist(err);
              should.exist(addr);
              Client.serverAssistedImport(
                { words, includeLegacyWallets: true, includeTestnetWallets: true },
                helpers.newClient(app),
                (err, k, c) => {
                  should.exist(k);
                  should.exist(c[0]);
                  k.compliantDerivation.should.equal(true);
                  k.use0forBCH.should.equal(false);
                  k.use44forMultisig.should.equal(true);

                  should.not.exist(err);
                  c.length.should.equal(1);
                  let recoveryClient = c[0];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.credentials.copayerName.should.equal(copayerName);
                    recoveryClient.credentials.m.should.equal(2);
                    recoveryClient.credentials.n.should.equal(3);
                    recoveryClient.getMainAddresses({}, (err, list) => {
                      should.not.exist(err);
                      should.exist(list);
                      list[0].address.should.equal(addr.address);
                      done();
                    });
                  });
                }
              );
            });
          }
        );
      });

      it('should be able to restore with equal keyid an old bch wallet and an old multisig btc wallet', function(done) {  
        var words = 'famous ship happy oyster retire sponsor disease friend parent wise grunt voyage';
        let k1 = new Key({ seedData: words, seedType: 'mnemonic', useLegacyCoinType: false, useLegacyPurpose: true}); // old bch wallets: /[44,48]/[0,0]'/
        let k2 = new Key({ seedData: words, seedType: 'mnemonic', useLegacyCoinType: true,  useLegacyPurpose: false });  // old BTC/BCH  multisig wallets: /[44]/[0,145]'/
        helpers.createAndJoinWallet(clients, keys, 2, 2, { key: k1, network: 'livenet'}, () => {
        // first create a "old" bch wallet (coin = 0).
        clients[1].fromString(
          k2.createCredentials(null, {
            coin: 'bch',
            network: 'livenet',
            account: 0,
            n: 1
          })
        );
        clients[1].createWallet(
          'mywallet',
          'creator',
          1,
          1,
          {
            coin: 'bch',
            network: 'livenet'
          },
          (err, secret) => {
            should.not.exist(err);
              Client.serverAssistedImport(
                { words, includeTestnetWallets: false, includeLegacyWallets: true },
                helpers.newClient(app),
                (err, k, c) => {
                  should.not.exist(err);
                  should.exist(k);
                  should.exist(c[0]);
                  should.exist(c[1]);
                  c[0].credentials.keyId.should.equal(c[1].credentials.keyId);
                  c.length.should.equal(2);
                  done();
                });
            });
          });
        });

      it('should be able to see txp messages after gaining access', function(done) {
        helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
          var xPrivKey = keys[0].get().xPrivKey;
          var walletName = clients[0].credentials.walletName;
          clients[0].createAddress(null, (err, x0) => {
            should.not.exist(err);
            should.exist(x0.address);
            blockchainExplorerMock.setUtxo(x0, 1, 1, 0);
            var opts = {
              amount: 30000,
              toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
              message: 'hello'
            };
            helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
              should.not.exist(err);

              Client.serverAssistedImport(
                { xPrivKey, includeTestnetWallets: true },
                helpers.newClient(app),
                (err, k, c) => {
                  should.not.exist(err);
                  c.length.should.equal(1);
                  let recoveryClient = c[0];
                  recoveryClient.openWallet(null, err => {
                    should.not.exist(err);
                    recoveryClient.credentials.walletName.should.equal(walletName);
                    recoveryClient.getTx(x.id, (err, x2) => {
                      should.not.exist(err);
                      x2.message.should.equal(opts.message);
                      done();
                    });
                  });
                }
              );
            });
          });
        });
      });

      it('should be able to recreate wallet 2-2', function(done) {
        helpers.createAndJoinWallet(clients, keys, 2, 2, {}, () => {
          clients[0].createAddress(null, (err, addr) => {
            should.not.exist(err);
            should.exist(addr);

            var storage = new Storage({
              db: db2
            });

            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start(
              {
                storage: storage,
                blockchainExplorer: blockchainExplorerMock,
                disableLogs: true
              },
              () => {
                newApp = expressApp.app;

                var recoveryClient = helpers.newClient(newApp);
                recoveryClient.fromString(clients[0].toString());

                recoveryClient.getStatus({}, (err, status) => {
                  should.exist(err);
                  err.should.be.an.instanceOf(Errors.NOT_AUTHORIZED);
                  var spy = sandbox.spy(recoveryClient.request, 'post');
                  recoveryClient.recreateWallet(err => {
                    should.not.exist(err);

                    // Do not send wallet name and copayer names in clear text
                    var url = spy.getCall(0).args[0];
                    var body = JSON.stringify(spy.getCall(0).args[1]);
                    url.should.contain('/wallets');
                    body.should.not.contain('mywallet');
                    var url = spy.getCall(1).args[0];
                    var body = JSON.stringify(spy.getCall(1).args[1]);
                    url.should.contain('/copayers');
                    body.should.not.contain('creator');
                    body.should.not.contain('copayer 1');

                    recoveryClient.getStatus({}, (err, status) => {
                      should.not.exist(err);
                      status.wallet.name.should.equal('mywallet');
                      status.wallet.copayers.every(c => ['creator', 'copayer 1'].includes(c.name)).should.be.true;
                      recoveryClient.createAddress(null, (err, addr2) => {
                        should.not.exist(err);
                        should.exist(addr2);
                        addr2.address.should.equal(addr.address);
                        addr2.path.should.equal(addr.path);

                        var recoveryClient2 = helpers.newClient(newApp);
                        recoveryClient2.fromString(clients[1].toString());
                        recoveryClient2.getStatus({}, (err, status) => {
                          should.not.exist(err);
                          done();
                        });
                      });
                    });
                  });
                });
              }
            );
          });
        });
      });

      it('should be able to recover funds from recreated wallet', function(done) {
        this.timeout(10000);
        helpers.createAndJoinWallet(clients, keys, 2, 2, {}, () => {
          clients[0].createAddress(null, (err, addr) => {
            should.not.exist(err);
            should.exist(addr);
            blockchainExplorerMock.setUtxo(addr, 1, 2);

            var storage = new Storage({
              db: db2
            });
            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start(
              {
                storage: storage,
                blockchainExplorer: blockchainExplorerMock,
                disableLogs: true
              },
              () => {
                newApp = expressApp.app;

                var recoveryClient = helpers.newClient(newApp);
                recoveryClient.fromString(clients[0].toString());

                recoveryClient.getStatus({}, (err, status) => {
                  should.exist(err);
                  err.should.be.an.instanceOf(Errors.NOT_AUTHORIZED);
                  recoveryClient.recreateWallet(err => {
                    should.not.exist(err);
                    recoveryClient.getStatus({}, (err, status) => {
                      should.not.exist(err);
                      recoveryClient.startScan({}, err => {
                        should.not.exist(err);
                        var balance = 0;
                        async.whilst(
                          () => {
                            return balance == 0;
                          },
                          next => {
                            setTimeout(() => {
                              recoveryClient.getBalance({}, (err, b) => {
                                balance = b.totalAmount;
                                next(err);
                              });
                            }, 200);
                          },
                          err => {
                            should.not.exist(err);
                            balance.should.equal(1e8);
                            done();
                          }
                        );
                      });
                    });
                  });
                });
              }
            );
          });
        });
      });

      it('should be able call recreate wallet twice', function(done) {
        helpers.createAndJoinWallet(clients, keys, 2, 2, {}, () => {
          clients[0].createAddress(null, (err, addr) => {
            should.not.exist(err);
            should.exist(addr);

            var storage = new Storage({
              db: db2
            });
            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start(
              {
                storage: storage,
                blockchainExplorer: blockchainExplorerMock,
                disableLogs: true
              },
              () => {
                newApp = expressApp.app;

                var recoveryClient = helpers.newClient(newApp);
                recoveryClient.fromString(clients[0].toString());

                recoveryClient.getStatus({}, (err, status) => {
                  should.exist(err);
                  err.should.be.an.instanceOf(Errors.NOT_AUTHORIZED);
                  recoveryClient.recreateWallet(err => {
                    should.not.exist(err);
                    recoveryClient.recreateWallet(err => {
                      should.not.exist(err);
                      recoveryClient.getStatus({}, (err, status) => {
                        should.not.exist(err);
                        status.wallet.copayers.every(c => ['creator', 'copayer 1'].includes(c.name)).should.be.true;
                        recoveryClient.createAddress(null, (err, addr2) => {
                          should.not.exist(err);
                          should.exist(addr2);
                          addr2.address.should.equal(addr.address);
                          addr2.path.should.equal(addr.path);

                          var recoveryClient2 = helpers.newClient(newApp);
                          recoveryClient2.fromString(clients[1].toString());
                          recoveryClient2.getStatus({}, (err, status) => {
                            should.not.exist(err);
                            done();
                          });
                        });
                      });
                    });
                  });
                });
              }
            );
          });
        });
      });

      it('should be able to recreate 1-of-1 wallet with account 2', function(done) {
        let k = new Key({
          seedData:
            'tprv8ZgxMBicQKsPdeZR4tV14PAJmzrWGsmafRVaHXUVYezrSbtnFM1CnqdbQuXfmSLxwr71axKewd3LTRDcQmtttUnZe27TQoGmGMeddv1H9JQ',
          seedType: 'extendedPrivateKey'
        });
        clients[0].fromString(
          k.createCredentials(null, {
            coin: 'btc',
            network: 'testnet',
            account: 2,
            n: 1
          })
        );

        clients[0].createWallet(
          'mywallet',
          'creator',
          1,
          1,
          {
            network: 'testnet'
          },
          (err, secret) => {
            should.not.exist(err);

            clients[0].createAddress(null, (err, addr) => {
              should.not.exist(err);
              should.exist(addr);

              var storage = new Storage({
                db: db2
              });

              var newApp;
              var expressApp = new ExpressApp();
              expressApp.start(
                {
                  storage: storage,
                  blockchainExplorer: blockchainExplorerMock,
                  disableLogs: true
                },
                () => {
                  newApp = expressApp.app;

                  var recoveryClient = helpers.newClient(newApp);
                  recoveryClient.fromString(clients[0].toString());
                  recoveryClient.credentials.account.should.equal(2);
                  recoveryClient.credentials.rootPath.should.equal("m/44'/1'/2'");
                  recoveryClient.getStatus({}, (err, status) => {
                    should.exist(err);
                    err.should.be.an.instanceOf(Errors.NOT_AUTHORIZED);
                    recoveryClient.recreateWallet(err => {
                      should.not.exist(err);
                      recoveryClient.getStatus({}, (err, status) => {
                        should.not.exist(err);
                        recoveryClient.createAddress(null, (err, addr2) => {
                          should.not.exist(err);
                          should.exist(addr2);
                          addr2.address.should.equal(addr.address);
                          addr2.path.should.equal(addr.path);
                          done();
                        });
                      });
                    });
                  });
                }
              );
            });
          }
        );
      });
    });
  });

  describe('Mobility, backup & restore BCH ONLY', () => {
    var importedClient = null,
      address;

    beforeEach(() => {
      importedClient = null;
    });

    it('should be able to restore a  useLegacyCoinType wallet', function(done) {
      this.timeout(5000);

      var check = x => {
        x.credentials.rootPath.should.equal("m/44'/0'/0'");
        x.credentials.xPubKey
          .toString()
          .should.equal(
            'xpub6DJEsBSYZrjsrHssifihdekpoWcKRHR6WVfbyk6Hhq1HxZSDoyEvT2pMHmSnNKEvdQNmfVqn1Ef1yWgYcrnhc3mSegUCbMvVJCPLYJ1PNen'
          );
      };

      var m = 'pink net pet stove boy receive task nephew book spawn pull regret';
      // first create a "old" bch wallet (coin = 0).
      //
      let k = new Key({ seedData: m, seedType: 'mnemonic', useLegacyCoinType: true });
      clients[0].fromString(
        k.createCredentials(null, {
          coin: 'bch',
          network: 'livenet',
          account: 0,
          n: 1
        })
      );
      clients[0].createWallet(
        'mywallet',
        'creator',
        1,
        1,
        {
          coin: 'bch',
          network: 'livenet'
        },
        (err, secret) => {
          should.not.exist(err);
          clients[0].createAddress(null, (err, x) => {
            should.not.exist(err);
            address = x.address;
            var importedClient = helpers.newClient(app);
            importedClient.fromString(
              k.createCredentials(null, {
                coin: 'bch',
                network: 'livenet',
                account: 0,
                n: 1
              })
            );
            var spy = sandbox.spy(importedClient, 'openWallet');
            importedClient.openWallet(null, err => {
              should.not.exist(err);
              check(importedClient);
              importedClient.getMainAddresses({}, (err, x) => {
                should.not.exist(err);
                x[0].address.should.equal(address);
                done();
              });
            });
          });
        }
      );
    });
  });

  /*
  describe.skip('Air gapped related flows', () => {
    it('should create wallet in proxy from airgapped', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom({ network: 'testnet' });
      var exported = airgapped.toString({ noSign: true });

      var proxy = helpers.newClient(app);
      proxy.fromString(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      var seedSpy = sandbox.spy(proxy, 'seedFromRandom');
      proxy.createWallet(
        'mywallet',
        'creator',
        1,
        1,
        {
          network: 'testnet'
        },
        err => {
          should.not.exist(err);
          seedSpy.called.should.be.false;
          proxy.getStatus({}, (err, status) => {
            should.not.exist(err);
            status.wallet.name.should.equal('mywallet');
            done();
          });
        }
      );
    });
    it('should fail to create wallet in proxy from airgapped when networks do not match', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom({
        network: 'testnet'
      });
      var exported = airgapped.toString({ noSign: true });

      var proxy = helpers.newClient(app);
      proxy.fromString(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      var seedSpy = sandbox.spy(proxy, 'seedFromRandom');
      should.not.exist(proxy.credentials.xPrivKey);
      proxy.createWallet(
        'mywallet',
        'creator',
        1,
        1,
        {
          network: 'livenet'
        },
        err => {
          should.exist(err);
          err.message.should.equal('Existing keys were created for a different network');
          done();
        }
      );
    });
    it('should be able to sign from airgapped client and broadcast from proxy', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom({ network: 'testnet' });
      var exported = airgapped.toString({ noSign: true });

      var proxy = helpers.newClient(app);
      proxy.fromString(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      async.waterfall(
        [
          next => {
            proxy.createWallet(
              'mywallet',
              'creator',
              1,
              1,
              {
                network: 'testnet'
              },
              err => {
                should.not.exist(err);
                proxy.createAddress(null, (err, address) => {
                  should.not.exist(err);
                  should.exist(address.address);
                  blockchainExplorerMock.setUtxo(address, 1, 1);
                  var opts = {
                    amount: 1200000,
                    toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                    message: 'hello 1-1'
                  };
                  helpers.createAndPublishTxProposal(proxy, opts, next);
                });
              }
            );
          },
          (txp, next) => {
            should.exist(txp);
            proxy.signTxProposal(txp, (err, txp) => {
              should.exist(err);
              should.not.exist(txp);
              err.message.should.equal('Missing private keys to sign.');
              next(null, txp);
            });
          },
          (txp, next) => {
            proxy.getTxProposals(
              {
                forAirGapped: true
              },
              next
            );
          },
          (bundle, next) => {
            var signatures = airgapped.signTxProposalFromAirGapped(
              bundle.txps[0],
              bundle.encryptedPkr,
              bundle.m,
              bundle.n
            );
            next(null, signatures);
          },
          (signatures, next) => {
            proxy.getTxProposals({}, (err, txps) => {
              should.not.exist(err);
              var txp = txps[0];
              txp.signatures = signatures;
              async.each(
                txps,
                (txp, cb) => {
                  proxy.signTxProposal(txp, (err, txp) => {
                    should.not.exist(err);
                    proxy.broadcastTxProposal(txp, (err, txp) => {
                      should.not.exist(err);
                      txp.status.should.equal('broadcasted');
                      should.exist(txp.txid);
                      cb();
                    });
                  });
                },
                err => {
                  next(err);
                }
              );
            });
          }
        ],
        err => {
          should.not.exist(err);
          done();
        }
      );
    });
    it('should be able to sign from airgapped client with mnemonics (with unencrypted xpubkey ring)', function(done) {
      var client = helpers.newClient(app);
      client.seedFromRandomWithMnemonic({
        network: 'testnet',
        passphrase: 'passphrase'
      });

      var mnemonic = client.getMnemonic();
      client.encryptPrivateKey('password');
      client.isPrivKeyEncrypted().should.be.true;

      async.waterfall(
        [
          next => {
            client.createWallet(
              'mywallet',
              'creator',
              1,
              1,
              {
                network: 'testnet'
              },
              err => {
                should.not.exist(err);
                client.createAddress(null, (err, address) => {
                  should.not.exist(err);
                  should.exist(address.address);
                  blockchainExplorerMock.setUtxo(address, 1, 1);
                  var opts = {
                    amount: 1200000,
                    toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                    message: 'hello 1-1'
                  };
                  helpers.createAndPublishTxProposal(client, opts, next);
                });
              }
            );
          },
          (txp, next) => {
            should.exist(txp);
            client.getTxProposals(
              {
                forAirGapped: true,
                doNotEncryptPkr: true
              },
              next
            );
          },
          (bundle, next) => {
            var signatures = Client.signTxProposalFromAirGapped(
              mnemonic,
              bundle.txps[0],
              bundle.unencryptedPkr,
              bundle.m,
              bundle.n,
              {
                passphrase: 'passphrase',
                account: 0,
                derivationStrategy: 'BIP44'
              }
            );
            next(null, signatures);
          },
          (signatures, next) => {
            client.getTxProposals({}, (err, txps) => {
              should.not.exist(err);
              var txp = txps[0];
              txp.signatures = signatures;
              async.each(
                txps,
                (txp, cb) => {
                  client.signTxProposal(txp, (err, txp) => {
                    should.not.exist(err);
                    client.broadcastTxProposal(txp, (err, txp) => {
                      should.not.exist(err);
                      txp.status.should.equal('broadcasted');
                      should.exist(txp.txid);
                      cb();
                    });
                  });
                },
                err => {
                  next(err);
                }
              );
            });
          }
        ],
        err => {
          should.not.exist(err);
          done();
        }
      );
    });
    describe('Failure and tampering', () => {
      var airgapped, proxy, bundle;

      beforeEach(function(done) {
        airgapped = new Client();
        airgapped.seedFromRandom({
          network: 'testnet'
        });
        var exported = airgapped.toString({
          noSign: true
        });

        proxy = helpers.newClient(app);
        proxy.fromString(exported);
        should.not.exist(proxy.credentials.xPrivKey);

        async.waterfall(
          [
            next => {
              proxy.createWallet(
                'mywallet',
                'creator',
                1,
                1,
                {
                  network: 'testnet'
                },
                err => {
                  should.not.exist(err);
                  proxy.createAddress(null, (err, address) => {
                    should.not.exist(err);
                    should.exist(address.address);
                    blockchainExplorerMock.setUtxo(address, 1, 1);
                    var opts = {
                      amount: 1200000,
                      toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                      message: 'hello 1-1'
                    };
                    helpers.createAndPublishTxProposal(proxy, opts, next);
                  });
                }
              );
            },
            (txp, next) => {
              proxy.getTxProposals(
                {
                  forAirGapped: true
                },
                (err, result) => {
                  should.not.exist(err);
                  bundle = result;
                  next();
                }
              );
            }
          ],
          err => {
            should.not.exist(err);
            done();
          }
        );
      });
      it('should fail to sign from airgapped client when there is no extended private key', function(done) {
        delete airgapped.credentials.xPrivKey;
        (() => {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw('Missing private keys');
        done();
      });
      it('should fail gracefully when PKR cannot be decrypted in airgapped client', function(done) {
        bundle.encryptedPkr = 'dummy';
        (() => {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw('Could not decrypt public key ring');
        done();
      });
      it('should be able to detect invalid or tampered PKR when signing on airgapped client', function(done) {
        (() => {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, 2);
        }).should.throw('Invalid public key ring');
        done();
      });
      it.skip('should be able to detect tampered proposal when signing on airgapped client', function(done) {
        bundle.txps[0].encryptedMessage = 'tampered message';
        (() => {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw('Fake transaction proposal');
        done();
      });
      it('should be able to detect tampered change address when signing on airgapped client', function(done) {
        bundle.txps[0].changeAddress.address = 'mqNkvNuhzZKeXYNRZ1bdj55smmW3acr6K7';
        (() => {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw('Fake transaction proposal');
        done();
      });
    });
  });
  */

  describe('#addAccess', () => {
    describe('1-1 wallets', () => {
      var opts;

      beforeEach(function(done) {
        opts = {
          amount: 10000,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello'
        };

        helpers.createAndJoinWallet(clients, keys, 1, 1, {}, () => {
          clients[0].createAddress(null, (err, x0) => {
            should.not.exist(err);
            blockchainExplorerMock.setUtxo(x0, 10, 1);
            var c = clients[0].credentials;

            // Ggenerate a new priv key, not registered
            var k = new Bitcore.PrivateKey();
            c.requestPrivKey = k.toString();
            c.requestPubKey = k.toPublicKey().toString();
            done();
          });
        });
      });

      it('should deny access before registering it ', function(done) {
        helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
          err.should.be.an.instanceOf(Errors.NOT_AUTHORIZED);
          done();
        });
      });

      it('should grant access with current keys', function(done) {
        let rk = clients[0].credentials.requestPrivKey;
        clients[0].addAccess(
          keys[0].createAccess(null, {
            path: clients[0].credentials.rootPath,
            requestPrivKey: clients[0].credentials.requestPrivKey
          }),
          (err, x) => {
            should.not.exist(err);
            helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
              should.not.exist(err);
              clients[0].credentials.requestPrivKey.should.be.equal(rk);
              done();
            });
          }
        );
      });

      it('should add access with copayer name', function(done) {
        var spy = sandbox.spy(clients[0].request, 'put');

        var opts2 = keys[0].createAccess(null, {
          path: clients[0].credentials.rootPath
        });
        opts2.name = 'pepe';
        clients[0].addAccess(opts2, (err, x, key) => {
          should.not.exist(err);
          var url = spy.getCall(0).args[0];
          var body = JSON.stringify(spy.getCall(0).args[1]);
          url.should.contain('/copayers');
          body.should.not.contain('pepe');

          var k = new Bitcore.PrivateKey(key);
          var c = clients[0].credentials;
          c.requestPrivKey = k.toString();
          c.requestPubKey = k.toPublicKey().toString();

          clients[0].getStatus({}, (err, status) => {
            should.not.exist(err);
            var keys = status.wallet.copayers[0].requestPubKeys;
            keys.length.should.equal(2);
            keys.filter(key => key.name === 'pepe').length.should.equal(1);

            helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
              should.not.exist(err);
              // TODO: verify tx's creator is 'pepe'
              done();
            });
          });
        });
      });

      it('should grant access with *new* keys then deny access with old keys', function(done) {
        var opts2 = keys[0].createAccess(null, {
          path: clients[0].credentials.rootPath
          // Generate new keys:  Do not pass this param
          //requestPrivKey: clients[0].credentials.requestPrivKey,
        });
        clients[0].addAccess(opts2, (err, x) => {
          helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
            err.should.be.an.instanceOf(Errors.NOT_AUTHORIZED);
            done();
          });
        });
      });

      it('should grant access with new keys', function(done) {
        var opts2 = keys[0].createAccess(null, {
          path: clients[0].credentials.rootPath
        });

        clients[0].addAccess(opts2, (err, x, key) => {
          var k = new Bitcore.PrivateKey(key);
          var c = clients[0].credentials;
          c.requestPrivKey = k.toString();
          c.requestPubKey = k.toPublicKey().toString();
          helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
            should.not.exist(err);
            done();
          });
        });
      });

      it('should verify tx proposals of added access', function(done) {
        var opts2 = keys[0].createAccess(null, {
          path: clients[0].credentials.rootPath,
          requestPrivKey: clients[0].credentials.requestPrivKey
        });
        clients[0].addAccess(opts2, (err, x) => {
          helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
            should.not.exist(err);
            clients[0].getTxProposals({}, (err, txps) => {
              should.not.exist(err);
              done();
            });
          });
        });
      });

      it('should detect tampered tx proposals of added access (case 1)', function(done) {
        var opts2 = keys[0].createAccess(null, {
          path: clients[0].credentials.rootPath,
          requestPrivKey: clients[0].credentials.requestPrivKey
        });
        clients[0].addAccess(opts2, (err, x) => {
          helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
            should.not.exist(err);
            helpers.tamperResponse(
              clients[0],
              'get',
              '/v1/txproposals/',
              {},
              txps => {
                txps[0].proposalSignature =
                  '304402206e4a1db06e00068582d3be41cfc795dcf702451c132581e661e7241ef34ca19202203e17598b4764913309897d56446b51bc1dcd41a25d90fdb5f87a6b58fe3a6920';
              },
              () => {
                clients[0].getTxProposals({}, (err, txps) => {
                  err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
                  done();
                });
              }
            );
          });
        });
      });

      it('should detect tampered tx proposals of added access (case 2)', function(done) {
        var opts2 = keys[0].createAccess(null, {
          path: clients[0].credentials.rootPath,
          requestPrivKey: clients[0].credentials.requestPrivKey
        });
        clients[0].addAccess(opts2, (err, x) => {
          helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
            should.not.exist(err);
            helpers.tamperResponse(
              clients[0],
              'get',
              '/v1/txproposals/',
              {},
              txps => {
                txps[0].proposalSignaturePubKey = '02d368d7f03a57b2ad3ad9c2766739da83b85ab9c3718fb02ad36574f9391d6bf6';
              },
              () => {
                clients[0].getTxProposals({}, (err, txps) => {
                  err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
                  done();
                });
              }
            );
          });
        });
      });

      it('should detect tampered tx proposals of added access (case 3)', function(done) {
        var opts2 = keys[0].createAccess(null, {
          path: clients[0].credentials.rootPath,
          requestPrivKey: clients[0].credentials.requestPrivKey
        });
        clients[0].addAccess(opts2, (err, x) => {
          helpers.createAndPublishTxProposal(clients[0], opts, (err, x) => {
            should.not.exist(err);
            helpers.tamperResponse(
              clients[0],
              'get',
              '/v1/txproposals/',
              {},
              txps => {
                txps[0].proposalSignaturePubKeySig =
                  '304402201528748eafc5083fe67c84cbf0eb996eba9a65584a73d8c07ed6e0dc490c195802204f340488266c804cf1033f8b852efd1d4e05d862707c119002dc3fbe7a805c35';
              },
              () => {
                clients[0].getTxProposals({}, (err, txps) => {
                  err.should.be.an.instanceOf(Errors.SERVER_COMPROMISED);
                  done();
                });
              }
            );
          });
        });
      });
    });
  });

  var addrMap = {
    btc: ['1PuKMvRFfwbLXyEPXZzkGi111gMUCs6uE3', '1GG3JQikGC7wxstyavUBDoCJ66bWLLENZC'],
    bch: ['qran0w2c8x2n4wdr60s4nrle65s745wt4sakf9xa8e', 'qznkyz7hdd3jvkqc76zsf585dcp5czmz5udnlj26ya']
  };
  for (const coin of ['bch', 'btc']) {
    describe('Sweep paper wallet ' + coin, () => {
      const addr = addrMap[coin];
      const B = Bitcore_[coin];

      beforeEach(() => {
        blockchainExplorerMock.supportsGrouping = () => {
          return true;
        };
      });

      afterEach(() => {
        blockchainExplorerMock.supportsGrouping = () => {
          return false;
        };
      });

      it.skip('should decrypt bip38 encrypted private key', function(done) {
        this.timeout(60000);
        clients[0].decryptBIP38PrivateKey(
          '6PfRh9ZnWtiHrGoPPSzXe6iafTXc6FSXDhSBuDvvDmGd1kpX2Gvy1CfTcA',
          'passphrase',
          {},
          (err, result) => {
            should.not.exist(err);
            result.should.equal('5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp');
            done();
          }
        );
      });
      it.skip('should fail to decrypt bip38 encrypted private key with incorrect passphrase', function(done) {
        this.timeout(60000);
        clients[0].decryptBIP38PrivateKey(
          '6PfRh9ZnWtiHrGoPPSzXe6iafTXc6FSXDhSBuDvvDmGd1kpX2Gvy1CfTcA',
          'incorrect passphrase',
          {},
          (err, result) => {
            should.exist(err);
            err.message.should.contain('passphrase');
            done();
          }
        );
      });
      it('should get balance from single private key', function(done) {
        var address = {
          address: addr[0],
          type: 'P2PKH',
          coin: coin
        };
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: coin, network: 'livenet' }, () => {
          blockchainExplorerMock.setUtxo(address, 123, 1);
          clients[0].getBalanceFromPrivateKey(
            '5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp',
            coin,
            (err, balance) => {
              should.not.exist(err);
              balance.should.equal(123 * 1e8);
              done();
            }
          );
        });
      });
      it('should build tx for single private key', function(done) {
        var address = {
          address: addr[0],
          type: 'P2PKH',
          coin: coin
        };
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: coin, network: 'livenet' }, () => {
          blockchainExplorerMock.setUtxo(address, 123, 1);
          clients[0].buildTxFromPrivateKey(
            '5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp',
            addr[1],
            {
              coin: coin
            },
            (err, tx) => {
              should.not.exist(err);
              should.exist(tx);
              tx.outputs.length.should.equal(1);
              var output = tx.outputs[0];
              output.satoshis.should.equal(123 * 1e8 - 10000);
              var script = B.Script.buildPublicKeyHashOut(B.Address.fromString(addr[1]));
              output.script.toString('hex').should.equal(script.toString('hex'));
              done();
            }
          );
        });
      });

      it('should handle tx serialization error when building tx', function(done) {
        var sandbox = sinon.createSandbox();

        var se = sandbox.stub(B.Transaction.prototype, 'serialize').callsFake(() => {
          throw new Error('this is an error');
        });

        var address = {
          address: addr[0],
          type: 'P2PKH',
          coin: coin
        };
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: coin, network: 'livenet' }, () => {
          blockchainExplorerMock.setUtxo(address, 123, 1);
          clients[0].buildTxFromPrivateKey(
            '5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp',
            addr[1],
            {
              coin: coin
            },
            (err, tx) => {
              should.exist(err);
              should.not.exist(tx);
              err.should.be.an.instanceOf(Errors.COULD_NOT_BUILD_TRANSACTION);
              sandbox.restore();
              done();
            }
          );
        });
      });

      it('should fail to build tx for single private key if insufficient funds', function(done) {
        var address = {
          address: addr[0],
          type: 'P2PKH',
          coin: coin
        };
        helpers.createAndJoinWallet(clients, keys, 1, 1, { coin: coin, network: 'livenet' }, () => {
          blockchainExplorerMock.setUtxo(address, 123 / 1e8, 1);
          clients[0].buildTxFromPrivateKey(
            '5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp',
            addr[1],
            {
              fee: 500,
              coin: coin
            },
            (err, tx) => {
              should.exist(err);
              err.should.be.an.instanceOf(Errors.INSUFFICIENT_FUNDS);
              done();
            }
          );
        });
      });
    });
  }

  describe('#formatAmount', () => {
    it('should successfully format amount', () => {
      var cases = [
        {
          args: [1, 'bit'],
          expected: '0'
        },
        {
          args: [
            1,
            'bit',
            {
              fullPrecision: true
            }
          ],
          expected: '0.01'
        },
        {
          args: [1, 'btc'],
          expected: '0.00'
        },
        {
          args: [
            1,
            'btc',
            {
              fullPrecision: true
            }
          ],
          expected: '0.00000001'
        },
        {
          args: [
            1234567899999,
            'btc',
            {
              thousandsSeparator: ' ',
              decimalSeparator: ','
            }
          ],
          expected: '12 345,678999'
        }
      ];

      for (const testCase of cases) {
        Utils.formatAmount.apply(this, testCase.args).should.equal(testCase.expected);
      }
    });
  });

  describe('_initNotifications', () => {
    it('should handle NOT_FOUND error from _fetchLatestNotifications', function(done) {
      var sandbox = sinon.createSandbox();
      var clock = sandbox.useFakeTimers();

      var client = new Client();

      var _f = sandbox.stub(client, '_fetchLatestNotifications').callsFake((interval, cb) => {
        cb(new Errors.NOT_FOUND());
      });

      client._initNotifications({
        notificationIntervalSeconds: 1
      });
      should.exist(client.notificationsIntervalId);
      clock.tick(1000);
      should.not.exist(client.notificationsIntervalId);
      sandbox.restore();
      done();
    });

    it('should handle NOT_AUTHORIZED error from _fetLatestNotifications', function(done) {
      var sandbox = sinon.createSandbox();
      var clock = sandbox.useFakeTimers();

      var client = new Client();

      var _f = sandbox.stub(client, '_fetchLatestNotifications').callsFake((interval, cb) => {
        cb(new Errors.NOT_AUTHORIZED());
      });

      client._initNotifications({
        notificationIntervalSeconds: 1
      });
      should.exist(client.notificationsIntervalId);
      clock.tick(1000);
      should.not.exist(client.notificationsIntervalId);
      sandbox.restore();
      done();
    });
  });

  describe('Import', () => {
    describe('#import', function() {
      it('should handle import with invalid JSON', function(done) {
        var importString = 'this is not valid JSON';
        var client = new Client();
        (() => {
          client.fromString(importString);
        }).should.throw(Errors.INVALID_BACKUP);
        done();
      });
      it('should handle old credentials', function(done) {
        var importString = '{"version": 1, "xPubKey": "xxx"}';
        var client = new Client();
        (() => {
          client.fromString(importString);
        }).should.throw(Errors.OBSOLETE_BACKUP);
        done();
      });
    });
    /*
    describe.skip('#importFromExtendedPublicKey', () => {
      it('should handle importing an invalid extended private key', function(done) {
        var client = new Client();
        var xPubKey = 'this is an invalid key';
        client.importFromExtendedPublicKey(xPubKey, {}, {}, {}, err => {
          should.exist(err);
          err.should.be.an.instanceOf(Errors.INVALID_BACKUP);
          done();
        });
      });
      it('should import with external public key', function(done) {
        var client = helpers.newClient(app);

        client.seedFromExtendedPublicKey(
          'xpub661MyMwAqRbcGVyYUcHbZi9KNhN9Tdj8qHi9ZdoUXP1VeKiXDGGrE9tSoJKYhGFE2rimteYdwvoP6e87zS5LsgcEvsvdrpPBEmeWz9EeAUq',
          'ledger',
          '1a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f00'
        );

        client.createWallet(
          'mywallet',
          'creator',
          1,
          1,
          {
            network: 'livenet'
          },
          err => {
            should.not.exist(err);
            var c = client.credentials;
            var importedClient = helpers.newClient(app);
            importedClient.importFromExtendedPublicKey(
              'xpub661MyMwAqRbcGVyYUcHbZi9KNhN9Tdj8qHi9ZdoUXP1VeKiXDGGrE9tSoJKYhGFE2rimteYdwvoP6e87zS5LsgcEvsvdrpPBEmeWz9EeAUq',
              'ledger',
              '1a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f00',
              {},
              err => {
                should.not.exist(err);
                var c2 = importedClient.credentials;
                c2.account.should.equal(0);
                c2.xPubKey.should.equal(client.credentials.xPubKey);
                c2.personalEncryptingKey.should.equal(c.personalEncryptingKey);
                c2.walletId.should.equal(c.walletId);
                c2.walletName.should.equal(c.walletName);
                c2.copayerName.should.equal(c.copayerName);
                done();
              }
            );
          }
        );
      });

      it('should fail to import with external priv key when not enought entropy', () => {
        var client = helpers.newClient(app);
        (() => {
          client.seedFromExtendedPublicKey(
            'xpub661MyMwAqRbcGVyYUcHbZi9KNhN9Tdj8qHi9ZdoUXP1VeKiXDGGrE9tSoJKYhGFE2rimteYdwvoP6e87zS5LsgcEvsvdrpPBEmeWz9EeAUq',
            'ledger',
            '1a1f00'
          );
        }).should.throw('entropy');
      });
    });
    */
  });

  describe('doRequest', () => {
    it('should handle connection error', function(done) {
      var client = new Client();
      client.credentials = {} as Credentials;
      client.request.r = helpers.stubRequest(null, {});
      client.request.doRequest('get', 'url', {}, false, (err, body, header) => {
        should.exist(err);
        should.not.exist(body);
        should.not.exist(header);
        err.should.be.an.instanceOf(Errors.CONNECTION_ERROR);
        done();
      });
    });

    it('should handle ECONNRESET error', function(done) {
      var client = new Client();
      client.credentials = {} as Credentials;
      client.request.r = helpers.stubRequest(null, {
        status: 200,
        body: '{"error":"read ECONNRESET"}'
      });
      client.request.doRequest('get', 'url', {}, false, (err, body, header) => {
        should.exist(err);
        should.not.exist(body);
        should.not.exist(header);
        err.should.be.an.instanceOf(Errors.ECONNRESET_ERROR);
        done();
      });
    });
  });

  describe('Single-address wallets', () => {
    beforeEach(function(done) {
      helpers.createAndJoinWallet(
        clients,
        keys,
        1,
        2,
        {
          singleAddress: true
        },
        wallet => {
          done();
        }
      );
    });
    it('should always return same address', function(done) {
      clients[0].createAddress(null, (err, x) => {
        should.not.exist(err);
        should.exist(x);
        x.path.should.equal('m/0/0');
        clients[0].createAddress(null, (err, y) => {
          should.not.exist(err);
          should.exist(y);
          y.path.should.equal('m/0/0');
          y.address.should.equal(x.address);
          clients[1].createAddress(null, (err, z) => {
            should.not.exist(err);
            should.exist(z);
            z.path.should.equal('m/0/0');
            z.address.should.equal(x.address);
            clients[0].getMainAddresses({}, (err, addr) => {
              should.not.exist(err);
              addr.length.should.equal(1);
              done();
            });
          });
        });
      });
    });
    it('should reuse address as change address on tx proposal creation', function(done) {
      clients[0].createAddress(null, (err, address) => {
        should.not.exist(err);
        should.exist(address.address);
        blockchainExplorerMock.setUtxo(address, 2, 1);

        var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
        var opts = {
          outputs: [
            {
              amount: 1e8,
              toAddress: toAddress
            }
          ],
          feePerKb: 100e2
        };
        clients[0].createTxProposal(opts, (err, txp) => {
          should.not.exist(err);
          should.exist(txp);
          should.exist(txp.changeAddress);
          txp.changeAddress.address.should.equal(address.address);
          txp.changeAddress.path.should.equal(address.path);
          done();
        });
      });
    });
  });
});
