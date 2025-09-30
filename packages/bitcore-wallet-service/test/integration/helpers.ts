'use strict';
// Node >= 17 started attempting to resolve all dns listings by ipv6 first, these lines are required to make it check ipv4 first
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import chai from 'chai';
import sinon from 'sinon';
import log from 'npmlog';
log.debug = log.verbose;
import config from '../test-config';
import {
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
  Transactions
} from 'crypto-wallet-core';
import util from 'util';
import { ChainService } from '../../src/lib/chain/index';
import { Common } from '../../src/lib/common';
import { Storage } from '../../src/lib/storage';
import { WalletService } from '../../src/lib/server';
import * as Model from '../../src/lib/model';
import * as TestData from '../testdata';
import { version } from '../../package.json';

const should = chai.should();
const { Utils, Constants, Defaults } = Common;
const Bitcore_ = {
  btc: BitcoreLib,
  bch: BitcoreLibCash,
  doge: BitcoreLibDoge,
  ltc: BitcoreLibLtc
};

let storage;
let blockchainExplorer;
let stubAddressActivityFailsOn = null;
let stubAddressActivityFailsOnCount = 1;


class Helpers {
  CLIENT_VERSION = `bwc-${version}`;
  _utxos = [];

  async before(cb?) {
    if (cb) {
      throw new Error('USE PROMISES = before'); // REMOVE ME
    }
    storage = new Storage();
    await util.promisify(storage.connect).call(storage, config);
    blockchainExplorer = this.mockBlockchainExplorer();

    const opts = {
      storage,
      blockchainExplorer,
      request: sinon.stub()
    };
    await util.promisify(WalletService.initialize).call(WalletService, opts);
    return opts;
  }

  async beforeEach(cb?) {
    if (cb) {
      throw new Error('USE PROMISES = beforeEach'); // REMOVE ME
    }
    if (!storage.db) return;

    // Left overs to be initalized
    let be = blockchainExplorer;
    be.register = sinon.stub().callsArgWith(1, null, null);
    be.addAddresses = sinon.stub().callsArgWith(2, null, null);

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
      FIAT_RATES2: 'fiat_rates2',
      TX_NOTES: 'tx_notes',
      SESSIONS: 'sessions',
      PUSH_NOTIFICATION_SUBS: 'push_notification_subs',
      TX_CONFIRMATION_SUBS: 'tx_confirmation_subs',
      LOCKS: 'locks'
    };


    for (const x of Object.values(collections)) {
      await storage.db.collection(x).deleteMany({});
    }
    const opts = {
      storage,
      blockchainExplorer,
      request: sinon.stub()
    };
    await util.promisify(WalletService.initialize).call(WalletService, opts);
    return opts;
  }

  async after(cb?) {
    if (cb) {
      throw new Error('USE PROMISES = after'); // REMOVE ME
    }
    await util.promisify(WalletService.shutDown).call(WalletService);
  }

  getBlockchainExplorer() {
    return blockchainExplorer;
  }

  mockBlockchainExplorer() {
    const blockchainExplorer = sinon.stub();
    blockchainExplorer.register = sinon.stub().callsArgWith(1, null, null);
    blockchainExplorer.addAddresses = sinon.stub().callsArgWith(2, null, null);
    blockchainExplorer.getAddressUtxos = sinon.stub().callsArgWith(2, null, []);
    blockchainExplorer.getCheckData = sinon.stub().callsArgWith(1, null, { sum: 100 });
    blockchainExplorer.getUtxos = sinon.stub().callsArgWith(1, null, []);
    blockchainExplorer.getTransactions = sinon.stub().callsArgWith(2, null, []);
    blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000, 'hash');
    blockchainExplorer.estimateGas = sinon.stub().callsArgWith(1, null, Defaults.MIN_GAS_LIMIT);
    blockchainExplorer.getBalance = sinon.stub().callsArgWith(1, null, { unconfirmed: 0, confirmed: '10000000000', balance: '10000000000' });
    blockchainExplorer.getReserve = sinon.stub().callsArgWith(0, null, Defaults.MIN_XRP_BALANCE);
    // just a number >0 (xrp does not accept 0)
    blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '5');
    return blockchainExplorer;
  }

  getStorage() {
    return storage;
  }

  signMessage(message, privKey) {
    const priv = new BitcoreLib.PrivateKey(privKey);
    const flattenedMessage = Array.isArray(message)? message.join(',') : message;
    const hash = Utils.hashMessage(flattenedMessage, false);
    return BitcoreLib.crypto.ECDSA.sign(hash, priv, { endian: 'little' }).toString();
  }

  signRequestPubKey(requestPubKey, xPrivKey) {
    const priv = new BitcoreLib.HDPrivateKey(xPrivKey).deriveChild(Constants.PATHS.REQUEST_KEY_AUTH).privateKey;
    return this.signMessage(requestPubKey, priv);
  }

  async getAuthServer(copayerId, cb?) {
    if (cb) {
      throw new Error('USE PROMISES = getAuthServer'); // REMOVE ME
    }
    const verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
    verifyStub.returns(true);

    const server = await util.promisify(WalletService.getInstanceWithAuth).call(WalletService, {
      copayerId: copayerId,
      message: 'dummy',
      signature: 'dummy',
      clientVersion: this.CLIENT_VERSION,
    });
    verifyStub.restore();
    return server;
  };

  /** unused */
  _generateCopayersTestData() {
    const xPrivKeys = [
      'xprv9s21ZrQH143K2n4rV4AtAJFptEmd1tNMKCcSyQBCSuN5eq1dCUhcv6KQJS49joRxu8NNdFxy8yuwTtzCPNYUZvVGC7EPRm2st2cvE7oyTbB',
      'xprv9s21ZrQH143K3BwkLceWNLUsgES15JoZuv8BZfnmDRcCGtDooUAPhY8KovhCWcRLXUun5AYL5vVtUNRrmPEibtfk9ongxAGLXZzEHifpvwZ',
      'xprv9s21ZrQH143K3xgLzxd6SuWqG5Zp1iUmyGgSsJVhdQNeTzAqBFvXXLZqZzFZqocTx4HD9vUVYU27At5i8q46LmBXXL97fo4H9C3tHm4BnjY',
      'xprv9s21ZrQH143K48nfuK14gKJtML7eQzV2dAH1RaqAMj8v2zs79uaavA9UTWMxpBdgbMH2mhJLeKGq8AFA6GDnFyWP4rLmknqZAfgFFV718vo',
      'xprv9s21ZrQH143K44Bb9G3EVNmLfAUKjTBAA2YtKxF4zc8SLV1o15JBoddhGHE9PGLXePMbEsSjCCvTvP3fUv6yMXZrnHigBboRBn2DmNoJkJg',
      'xprv9s21ZrQH143K48PpVxrh71KdViTFhAaiDSVtNFkmbWNYjwwwPbTrcqoVXsgBfue3Gq9b71hQeEbk67JgtTBcpYgKLF8pTwVnGz56f1BaCYt',
      'xprv9s21ZrQH143K3pgRcRBRnmcxNkNNLmJrpneMkEXY6o5TWBuJLMfdRpAWdb2cG3yxbL4DxfpUnQpjfQUmwPdVrRGoDJmtAf5u8cyqKCoDV97',
      'xprv9s21ZrQH143K3nvcmdjDDDZbDJHpfWZCUiunwraZdcamYcafHvUnZfV51fivH9FPyfo12NyKH5JDxGLsQePyWKtTiJx3pkEaiwxsMLkVapp',
      'xprv9s21ZrQH143K2uYgqtYtphEQkFAgiWSqahFUWjgCdKykJagiNDz6Lf7xRVQdtZ7MvkhX9V3pEcK3xTAWZ6Y6ecJqrXnCpzrH9GSHn8wyrT5',
      'xprv9s21ZrQH143K2wcRMP75tAEL5JnUx4xU2AbUBQzVVUDP7DHZJkjF3kaRE7tcnPLLLL9PGjYTWTJmCQPaQ4GGzgWEUFJ6snwJG9YnQHBFRNR'
    ];

    console.log('var copayers = [');
    for (const xPrivKeyStr of xPrivKeys) {
      var xpriv = BitcoreLib.HDPrivateKey(xPrivKeyStr);
      var xpub = BitcoreLib.HDPublicKey(xpriv);

      var xpriv_45H = xpriv.deriveChild(45, true);
      var xpub_45H = BitcoreLib.HDPublicKey(xpriv_45H);
      var id45 = Model.Copayer.xPubToCopayerId('btc', xpub_45H.toString());

      var xpriv_44H_0H_0H = xpriv.deriveChild(44, true).deriveChild(0, true).deriveChild(0, true);
      var xpub_44H_0H_0H = BitcoreLib.HDPublicKey(xpriv_44H_0H_0H);
      var id44btc = Model.Copayer.xPubToCopayerId('btc', xpub_44H_0H_0H.toString());
      var id44bch = Model.Copayer.xPubToCopayerId('bch', xpub_44H_0H_0H.toString());

      var xpriv_1H = xpriv.deriveChild(1, true);
      var xpub_1H = BitcoreLib.HDPublicKey(xpriv_1H);
      var priv = xpriv_1H.deriveChild(0).privateKey;
      var pub = xpub_1H.deriveChild(0).publicKey;

      console.log('{id44btc: ', "'" + id44btc + "',");
      console.log('id44bch: ', "'" + id44bch + "',");
      console.log('id45: ', "'" + id45 + "',");
      console.log('xPrivKey: ', "'" + xpriv.toString() + "',");
      console.log('xPubKey: ', "'" + xpub.toString() + "',");
      console.log('xPrivKey_45H: ', "'" + xpriv_45H.toString() + "',");
      console.log('xPubKey_45H: ', "'" + xpub_45H.toString() + "',");
      console.log('xPrivKey_44H_0H_0H: ', "'" + xpriv_44H_0H_0H.toString() + "',");
      console.log('xPubKey_44H_0H_0H: ', "'" + xpub_44H_0H_0H.toString() + "',");
      console.log('xPrivKey_1H: ', "'" + xpriv_1H.toString() + "',");
      console.log('xPubKey_1H: ', "'" + xpub_1H.toString() + "',");
      console.log('privKey_1H_0: ', "'" + priv.toString() + "',");
      console.log('pubKey_1H_0: ', "'" + pub.toString() + "'},");
    }
    console.log('];');
  }

  getSignedCopayerOpts(opts) {
    const hash = WalletService._getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
    opts.copayerSignature = this.signMessage(hash, TestData.keyPair.priv);
    return opts;
  }

  /* ETH wallet use the provided key here, probably 44'/0'/0' */
  async createAndJoinWallet(m, n, opts?, cb?) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    opts = opts || {};
    if (cb) {
      throw new Error('USE PROMISES = createAndJoinWallet'); // REMOVE ME
    }

    const server = new WalletService();
    const copayerIds = [];
    const offset = opts.offset || 0;

    const walletOpts: any = {
      name: 'a wallet',
      m: m,
      n: n,
      pubKey: TestData.keyPair.pub,
      singleAddress: !!opts.singleAddress,
      coin: opts.coin || 'btc',
      network: opts.network || 'livenet',
      nativeCashAddr: opts.nativeCashAddr,
      useNativeSegwit: opts.useNativeSegwit,
      segwitVersion: opts.segwitVersion,
    };

    if ([true, false].includes(opts.supportBIP44AndP2PKH))
      walletOpts.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

    const walletId = await util.promisify(server.createWallet).call(server, walletOpts);

    for (let i = 0; i < n; i++) {
      const copayerData = TestData.copayers[i + offset];
      let pub = ([true, false].includes(opts.supportBIP44AndP2PKH) && !opts.supportBIP44AndP2PKH) ? copayerData.xPubKey_45H : copayerData.xPubKey_44H_0H_0H;
      const aliases = Constants.NETWORK_ALIASES[walletOpts.coin];
      if ((aliases && aliases.testnet && aliases.testnet == opts.network) || opts.network == 'testnet') {
        if (opts.coin == 'btc' || opts.coin == 'bch') {
          pub = copayerData.xPubKey_44H_0H_0Ht;
        } else {
          pub = copayerData.xPubKey_44H_0H_0HtSAME;
        }
      }

      const copayerOpts = this.getSignedCopayerOpts({
        walletId: walletId,
        coin: opts.coin,
        name: 'copayer ' + (i + 1),
        xPubKey: pub,
        requestPubKey: copayerData.pubKey_1H_0,
        customData: 'custom data ' + (i + 1),
      });
      if ([true, false].includes(opts.supportBIP44AndP2PKH))
        copayerOpts.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

      const result = await util.promisify(server.joinWallet).call(server, copayerOpts);
      copayerIds.push(result.copayerId);
    }
    const s = await this.getAuthServer(copayerIds[0]);
    if (opts.earlyRet) return { server: s };
    const w = await util.promisify(s.getWallet).call(s, {});

    // STUB for checkWalletSync.
    s.checkWalletSync = function(a, b, simple, cb) {
      if (simple) return cb(null, false);
      return cb(null, true);
    };
    return { server: s, wallet: w };
  }


  randomTXID() {
    return BitcoreLib.crypto.Hash.sha256(Buffer.from((Math.random() * 100000).toString())).toString('hex');;
  }

  toSatoshi(btc) {
    if (Array.isArray(btc)) {
      return btc.map(this.toSatoshi);
    } else {
      return Utils.strip(btc * 1e8);
    }
  };

  _parseAmount(str) {
    const result = {
      amount: +0,
      confirmations: Math.floor(Math.random() * 95) + 6 // random between 6 and 100 (inclusive)
    };

    if (typeof str === 'number' || typeof str === 'bigint') str = str.toString();

    const re = /^((?:\d+c)|u)?\s*([\d\.]+)\s*(btc|bit|sat)?$/;
    const match = str.match(re);
    if (!match) throw new Error('Could not parse amount ' + str);

    if (match[1]) {
      if (match[1] == 'u') result.confirmations = 0;
      if (match[1].endsWith('c')) result.confirmations = +match[1].slice(0, -1);
    }

    switch (match[3]) {
      default:
      case 'btc':
        result.amount = Utils.strip(+match[2] * 1e8);
        break;
      case 'bit':
        result.amount = Utils.strip(+match[2] * 1e2);
        break
      case 'sat':
        result.amount = Utils.strip(+match[2]);
        break;
    };

    return result;
  }

  async stubUtxos(server, wallet, amounts, opts?, cb?) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    opts = opts || {};
    if (cb) {
      throw new Error('USE PROMISES = stubUtxos'); // REMOVE ME
    }

    if (opts.tokenAddress) {
      amounts = Array.isArray(amounts) ? amounts : [amounts];
      blockchainExplorer.getBalance = function(opts, cb) {
        if (opts.tokenAddress) {
          return cb(null, { unconfirmed: 0, confirmed: 2e6, balance: 2e6 });
        }
        let conf = amounts.map(x =>  Number((x * 1e18).toFixed(0))).reduce((sum, x) => sum += x, 0);
        return cb(null, { unconfirmed: 0, confirmed: conf, balance: conf });
      }
      blockchainExplorer.estimateFee = sinon.stub().callsArgWith(1, null, 20000000000);
      return;
    }

    if (wallet.coin == 'eth') {
      amounts = Array.isArray(amounts) ? amounts : [amounts];
      let conf = amounts.map(x =>  Number((x * 1e18).toFixed(0))).reduce((sum, x) => sum += x, 0);
      blockchainExplorer.getBalance = sinon.stub().callsArgWith(1, null, { unconfirmed: 0, confirmed: conf, balance: conf });
      return;
    }

    if (wallet.coin == 'xrp') {
      amounts = Array.isArray(amounts) ? amounts : [amounts];
      let conf = amounts.map(x => Number((x * 1e6).toFixed(0))).reduce((sum, x) => sum += x, 0);
      conf = conf + Defaults.MIN_XRP_BALANCE;
      blockchainExplorer.getBalance = sinon.stub().callsArgWith(1, null, { unconfirmed: 0, confirmed: conf, balance: conf });
      return;
    }

    const S = Bitcore_[wallet.coin].Script;
    const addresses = opts.addresses || [];
    if (!addresses.length) {
      const addysToCreate = amounts.length > 2 ? 2 : 1;
      for (let i = 0; i < addysToCreate; i++) {
        const address = await util.promisify(server.createAddress).bind(server)({});
        addresses.push(address);
      }
    }

    addresses.should.not.be.empty;

    const utxos = [].concat(amounts).map((amount, i) => {
      const parsed = this._parseAmount(amount);
      if (parsed.amount <= 0) return null;

      const address = addresses[i % addresses.length];

      let scriptPubKey;
      switch (wallet.addressType) {
        case Constants.SCRIPT_TYPES.P2SH:
          scriptPubKey = S.buildMultisigOut(address.publicKeys, wallet.m).toScriptHashOut();
          break;
        case Constants.SCRIPT_TYPES.P2PKH:
          scriptPubKey = S.buildPublicKeyHashOut(address.address);
          break;
        case Constants.SCRIPT_TYPES.P2WPKH:
          scriptPubKey = S.buildWitnessV0Out(address.address);
          break;
        case Constants.SCRIPT_TYPES.P2WSH:
          scriptPubKey = S.buildWitnessV0Out(address.address);
          break;
        case Constants.SCRIPT_TYPES.P2TR:
          scriptPubKey = S.buildWitnessV1Out(address.address);
          break;
      }
      should.exist(scriptPubKey, 'unknown address type:' + wallet.addressType);

      return {
        txid: this.randomTXID(),
        vout: Math.round((Math.round(Math.random() * 100) / 10)), // random between 0 and 10 (inclusive)
        satoshis: parsed.amount,
        scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
        address: address.address,
        confirmations: parsed.confirmations,
        publicKeys: address.publicKeys,
        wallet: wallet.id,
      };
    }).filter(x => !!x);

    if (opts.keepUtxos) {
      this._utxos = this._utxos.concat(utxos);
    } else {
      this._utxos = utxos;
    }

    blockchainExplorer.getUtxos = (param1, height, cb) => {
      const selected = this._utxos.filter(x => x.wallet == param1.id);
      return cb(null, selected);
    };


    blockchainExplorer.getAddressUtxos = (param1, height, cb) => {
      const selected = this._utxos.filter(x => x.address == param1);
      return cb(null, selected);
    };

    return this._utxos;
  }

  stubBroadcast(txid) {
    blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, null, txid || '112233');
    blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
  }

  createTxsV8(nr, bcHeight, txs?) {
    txs = txs || [];
    // Will generate
    // order / confirmations  / height / txid
    //  0.  => -1     / -1            /   txid0   / id0  <=  LAST ONE!
    //  1.  => 1      / bcHeight      /   txid1
    //  2.  => 2      / bcHeight - 1  /   txid2
    //  3.  => 3...   / bcHeight - 2  /   txid3

    if (Array.isArray(txs) && txs.length === 0) {
      for (let i = 0; i < nr; i++) {
        txs.push({
          id: 'id' + i,
          txid: 'txid' + i,
          size: 226,
          category: 'receive',
          satoshis: 30001,
          // this is translated on V8.prototype.getTransactions
          amount: 30001 /1e8,
          height: (i == 0) ? -1 : bcHeight - i + 1,
          address: 'muFJi3ZPfR5nhxyD7dfpx2nYZA8Wmwzgck',
          blockTime: '2018-09-21T18:08:31.000Z',
        });
      }
    }

    return txs;
  }


  stubHistory(nr, bcHeight, txs?) {
    txs = this.createTxsV8(nr, bcHeight, txs);
    blockchainExplorer.getTransactions = function(walletId, startBlock, cb) {
      startBlock = startBlock || 0;
      const page = txs.filter((x) => x.height >= startBlock || x.height == -1);
      return cb(null, page);
    };
  }


  async stubCheckData(bc, server, isBCH, cb?) {
    if (cb) {
      throw new Error('USE PROMISES = stubCheckData'); // REMOVE ME
    }
    const x = await server.storage.walletCheck({ walletId:server.walletId, bch: isBCH });
    bc.getCheckData = sinon.stub().callsArgWith(1, null, { sum: x.sum });
  }


  // fill => fill intermediary levels
  stubFeeLevels(levels, fill?, chain?) {
    chain = chain || 'btc';
    let div = 1;
    if (['btc', 'bch', 'doge', 'ltc'].includes(chain)) {
      div = 1e8;  // bitcoind returns values in BTC amounts
    }

    blockchainExplorer.estimateFee = function(nbBlocks, cb) {
      const result = nbBlocks.reduce((acc, n) => {
          const fee = levels[n];
          acc[n] = fee > 0 ? fee / div : fee;
          return acc;
        }, {});

      if (fill) {
        let last;
        for (const n of nbBlocks) {
          if (result[n]) {
            last = result[n];
          }
          result[n] = last;
        }
      }
      return cb(null, result);
    };
  }


  stubAddressActivity(activeAddresses, failsOn?) {

    stubAddressActivityFailsOnCount = 1;

    // could be null
    stubAddressActivityFailsOn = failsOn;

    blockchainExplorer.getAddressActivity = function(address, cb) {
      if (stubAddressActivityFailsOnCount === stubAddressActivityFailsOn)
        return cb('failed on request');

      stubAddressActivityFailsOnCount++;

      return cb(null, activeAddresses.includes(address));
    };
  }

  clientSign(txp, derivedXPrivKey) {
    const privs = [];
    const derived = {};
    const xpriv = new BitcoreLib.HDPrivateKey(derivedXPrivKey, txp.network);
    let signatures;

    switch(txp.coin) {
      case 'eth':
      case 'xrp':
        // For eth => account, 0, change = 0
        const priv =  xpriv.derive('m/0/0').privateKey;
        const privKey = priv.toString('hex');
        let tx = ChainService.getBitcoreTx(txp).uncheckedSerialize();
        const isERC20 = txp.tokenAddress && !txp.payProUrl;
        const chain = isERC20 ? Utils.getChain(txp.coin) + 'ERC20' : Utils.getChain(txp.coin);
        tx = typeof tx === 'string'? [tx] : tx;
        signatures = [];
        for (const rawTx of tx) {
          const signed = Transactions.getSignature({
            chain: chain.toUpperCase(),
            tx: rawTx,
            key: { privKey: privKey.toString('hex') },
          });
          signatures.push(signed);
        }
        break;
      default:
        for (const i of txp.inputs) {
          if (!derived[i.path]) {
            derived[i.path] = xpriv.deriveChild(i.path).privateKey;
            privs.push(derived[i.path]);
          }
        }

        const t = ChainService.getBitcoreTx(txp);
        signatures = privs.flatMap(priv => t.getSignatures(priv, undefined, txp.signingMethod));
        signatures = signatures
          .sort((a, b) => a.inputIndex - b.inputIndex)
          .map(s => s.signature.toDER(txp.signingMethod).toString('hex'));
    }

    return signatures;
  }

  getProposalSignatureOpts(txp, signingKey) {
    const raw = txp.getRawTx();
    const proposalSignature = this.signMessage(raw, signingKey);
    return {
      txProposalId: txp.id,
      proposalSignature: proposalSignature,
    };
  }


  async createAddresses(server, wallet, main, change, cb?) {
    if (cb) {
      throw new Error('USE PROMISES = createAddresses'); // REMOVE ME
    }
    const mainAddresses = [];
    const changeAddresses = [];
    for (let i = 0; i < main + change; i++) {
      let isChange = i >= main;
      const address = wallet.createAddress(isChange);
      await util.promisify(server.storage.storeAddressAndWallet).call(server.storage, wallet, address);
      if (isChange) {
        changeAddresses.push(address);
      } else {
        mainAddresses.push(address);
      }
    }
    return { main: mainAddresses, change: changeAddresses };
  }

  async createAndPublishTx(server, txOpts, signingKey, cb?) {
    if (cb) {
      throw new Error('USE PROMISES = createAndPublishTx'); // REMOVE ME
    }
    return new Promise<any>((resolve, reject) => {
      server.createTx(txOpts, (err, txp) => {
        if (err) console.log(err);
        should.not.exist(err, 'Error creating a TX');
        should.exist(txp, 'Error... no txp');
        const publishOpts = this.getProposalSignatureOpts(txp, signingKey);
        server.publishTx(publishOpts, (err) => {
          if (err) console.log(err);
          should.not.exist(err);
          return resolve(txp);
        });
      });
    });
  }


  historyCacheTest(items) {
    const template = {
      txid: "fad88682ccd2ff34cac6f7355fe9ecd8addd9ef167e3788455972010e0d9d0de",
      vin: [{
        txid: "0279ef7b21630f859deb723e28beac9e7011660bd1346c2da40321d2f7e34f04",
        vout: 0,
        n: 0,
        addr: "2NAVFnsHqy5JvqDJydbHPx393LFqFFBQ89V",
        valueSat: 45753,
        value: 0.00045753,
      }],
      vout: [{
        value: "0.00011454",
        n: 0,
        scriptPubKey: {
          addresses: [
            "2N7GT7XaN637eBFMmeczton2aZz5rfRdZso"
          ]
        }
      }, {
        value: "0.00020000",
        n: 1,
        scriptPubKey: {
          addresses: [
            "mq4D3Va5mYHohMEHrgHNGzCjKhBKvuEhPE"
          ]
        }
      }],
      confirmations: 1,
      blockheight: 423499,
      time: 1424472242,
      blocktime: 1424472242,
      valueOut: 0.00031454,
      valueIn: 0.00045753,
      fees: 0.00014299
    };

    const ret = [];
    for (const i of Array.from({ length: items }, (_, i) => i)) {
      const t = JSON.parse(JSON.stringify(template));
      t.txid = 'txid:' + i;
      t.confirmations = items - i - 1;
      t.blockheight = i;
      t.time = t.blocktime = i;
      ret.unshift(t);
    }

    return ret;
  }
}

export default new Helpers();
