'use strict';
// Node >= 17 started attempting to resolve all dns listings by ipv6 first, these lines are required to make it check ipv4 first
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import { singleton }from 'preconditions';
import chai from 'chai';
chai.config.includeStack = true;
import sinon from 'sinon';
import request from 'supertest';
import mongodb from 'mongodb';
import * as CWC from 'crypto-wallet-core';
import config from './data/test-config';
import Client from '../src';
import { Utils, Constants } from '../src/lib/common';

const $ = singleton();
const should = chai.should();


const Key = Client.Key;
const Bitcore = CWC.BitcoreLib;
const Bitcore_ = {
  btc: Bitcore,
  bch: CWC.BitcoreLibCash
};


export const helpers = {
  toSatoshi: btc => {
    if (Array.isArray(btc)) {
      return btc.map(helpers.toSatoshi);
    } else {
      return parseFloat((btc * 1e8).toPrecision(12));
    }
  },
  newClient: app => {
    $.checkArgument(app);
    return new Client({
      baseUrl: '/bws/api',
      request: request(app),
      bp_partner: 'xxx',
      bp_partner_version: 'yyy'
      //    logLevel: 'debug',
    });
  },
  stubRequest: (err, res?) => {
    var request = {
      accept: sinon.stub(),
      set: sinon.stub(),
      query: sinon.stub(),
      send: sinon.stub(),
      timeout: sinon.stub(),
      end: sinon.stub().yields(err, res)
    };
    var reqFactory = ['get', 'post', 'put', 'delete'].reduce((mem, verb) => {
      mem[verb] = url => {
        return request;
      };
      return mem;
    }, {});

    return reqFactory as any;
  },
  generateUtxos: (scriptType, publicKeyRing, path, requiredSignatures, amounts) => {
    amounts = [].concat(amounts);
    var utxos = amounts.map((amount, i) => {
      var address = Utils.deriveAddress(scriptType, publicKeyRing, path, requiredSignatures, 'testnet', 'btc');

      var scriptPubKey;
      switch (scriptType) {
        case Constants.SCRIPT_TYPES.P2WSH:
        case Constants.SCRIPT_TYPES.P2SH:
          scriptPubKey = new Bitcore.Script.buildMultisigOut(address.publicKeys, requiredSignatures).toScriptHashOut();
          break;
        case Constants.SCRIPT_TYPES.P2WPKH:
        case Constants.SCRIPT_TYPES.P2PKH:
          scriptPubKey = new Bitcore.Script.buildPublicKeyHashOut(address.address);
          break;
      }
      should.exist(scriptPubKey);

      var obj = {
        txid: new Bitcore.crypto.Hash.sha256(Buffer.alloc(i)).toString('hex'),
        vout: 100,
        satoshis: helpers.toSatoshi(amount),
        scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
        address: address.address,
        path: path,
        publicKeys: address.publicKeys
      };
      return obj;
    });
    return utxos;
  },
  createAndJoinWallet: async (clients, keys, m, n, opts, cb?) => {
    opts = opts || {};

    try {
      const chain = opts.chain || opts.coin || 'btc';
      const coin = opts.coin || chain;
      const network = opts.network || 'testnet';

      const keyOpts = {
        useLegacyCoinType: opts.useLegacyCoinType,
        useLegacyPurpose: opts.useLegacyPurpose,
        passphrase: opts.passphrase,
        seedType: 'new' as const
      };

      keys[0] = opts.key || new Key(keyOpts);
      const cred = keys[0].createCredentials(null, {
        coin: coin,
        chain: chain, // chain === coin for stored clients. NOT TRUE ANYMORE
        network: network,
        account: opts.account ? opts.account : 0,
        n: n,
        addressType: opts.addressType
      });
      clients[0].fromObj(cred);

      const { secret } = await clients[0].createWallet(
        'mywallet',
        'creator',
        m,
        n,
        {
          coin: coin,
          chain: chain, // chain === coin for stored clients. NOT TRUE ANYMORE
          network: network,
          singleAddress: !!opts.singleAddress,
          doNotCheck: true,
          useNativeSegwit: !!opts.useNativeSegwit,
          tssKeyId: opts.tssKeyId
        }
      );

      if (n > 1) {
        should.exist(secret);
      }

      for (const i of Array.from({ length: n - 1 }, (_, i) => i + 1)) { // range [1, n-1]
        keys[i] = keys[i] || new Key(keyOpts);
        clients[i].fromString(
          keys[i].createCredentials(null, {
            coin: coin,
            chain: chain, // chain === coin for stored clients. NOT TRUE ANYMORE
            network: network,
            account: 0,
            n: n,
            addressType: opts.addressType
          })
        );
        await clients[i].joinWallet(
          secret,
          'copayer ' + i,
          {
            coin: coin,
            chain: chain
          },
        );
      }
      for (const i of Array.from({ length: n }, (_, i) => i)) { // range [0, n-1]            
        await clients[i].openWallet();
      }
      
      const retval = {
        m: m,
        n: n,
        secret: secret
      };
      if (cb) { cb(retval); }
      return retval;
    } catch (err) {
      console.log(err);
      should.not.exist(err);
    }
  },
  tamperResponse: (clients, method, url, args, tamper, cb) => {
    clients = [].concat(clients);
    // Use first client to get a clean response from server
    clients[0].request.doRequest(method, url, args, false, (err, result) => {
      should.not.exist(err);
      tamper(result);
      // Return tampered data for every client in the list
      for (const client of clients) {
        client.request.doRequest = sinon
            .stub()
            .withArgs(method, url)
            .resolves({ body: result });
      }
      return cb();
    });
  },
  createAndPublishTxProposal: (client, opts, cb) => {
    if (!opts.outputs) {
      opts.outputs = [{
        toAddress: opts.toAddress,
        amount: opts.amount
      }];
    }
    client.createTxProposal(opts, (err, txp) => {
      if (err) return cb(err);
      client.publishTxProposal({ txp }, cb);
    });
  },
  newDb: (extra, cb) => {
    extra = extra || '';
    mongodb.MongoClient.connect(config.mongoDb.uri + extra, (err, connection) => {
      if (err) return cb(err);
      let db = connection.db(config.mongoDb.dbname + extra);
      db.dropDatabase(function(err) {
        return cb(err, db, connection);
      });
    });
  }
};


export const blockchainExplorerMock = {
  register: sinon.stub().callsArgWith(1, null, null),
  getCheckData: sinon.stub().callsArgWith(1, null, { sum: 100 }),
  addAddresses: sinon.stub().callsArgWith(2, null, null),
  utxos: [],
  lastBroadcasted: null,
  txHistory: [],
  feeLevels: [],
  getUtxos: (wallet, height, cb) => {
    return cb(null, JSON.parse(JSON.stringify(blockchainExplorerMock.utxos)));
  },
  getAddressUtxos: (address, height, cb) => {
    var selected = blockchainExplorerMock.utxos.filter(utxo => {
      return address.includes(utxo.address);
    });

    return cb(null, JSON.parse(JSON.stringify(selected)));
  },
  setUtxo: (address, amount, m, confirmations?) => {
    var B = Bitcore_[address.coin];
    var scriptPubKey;
    switch (address.type) {
      case Constants.SCRIPT_TYPES.P2SH:
        scriptPubKey = address.publicKeys ? B.Script.buildMultisigOut(address.publicKeys, m).toScriptHashOut() : '';
        break;
      case Constants.SCRIPT_TYPES.P2WPKH:
      case Constants.SCRIPT_TYPES.P2PKH:
        scriptPubKey = B.Script.buildPublicKeyHashOut(address.address);
        break;
      case Constants.SCRIPT_TYPES.P2WSH:
        scriptPubKey = B.Script.buildWitnessV0Out(address.address);
        break;
    }
    should.exist(scriptPubKey);
    blockchainExplorerMock.utxos.push({
      txid: new Bitcore.crypto.Hash.sha256(Buffer.alloc(Math.random() * 100000)).toString('hex'),
      outputIndex: 0,
      amount: amount,
      satoshis: amount * 1e8,
      address: address.address,
      scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
      confirmations: confirmations == null ? Math.floor(Math.random() * 100 + 1) : +confirmations
    });
  },
  supportsGrouping: () => {
    return false;
  },
  getBlockchainHeight: cb => {
    return cb(null, 1000);
  },
  broadcast: (raw, cb) => {
    blockchainExplorerMock.lastBroadcasted = raw;

    let hash;
    try {
      let tx = new Bitcore.Transaction(raw);
      if (!tx.outputs.length) {
        throw 'no bitcoin';
      }
      hash = tx.id;
      // btc/bch
      return cb(null, hash);
    } catch (e) {
      // try eth
      hash = CWC.Transactions.getHash({
        tx: raw[0],
        chain: 'ETH'
      });
      return cb(null, hash);
    }
  },
  setHistory: txs => {
    blockchainExplorerMock.txHistory = txs;
  },
  getTransaction: (txid, cb) => {
    return cb();
  },
  getTransactions: (wallet, startBlock, cb) => {
    var list = [].concat(blockchainExplorerMock.txHistory);
    // -1 = mempool, always included in server' s v8.js
    list = list.filter(x => {
      return x.height >= startBlock || x.height == -1;
    });
    return cb(null, list);
  },
  getAddressActivity: (address, cb) => {
    var activeAddresses = blockchainExplorerMock.utxos.map(u => u.address);
    return cb(null, activeAddresses.includes(address));
  },
  setFeeLevels: levels => {
    blockchainExplorerMock.feeLevels = levels;
  },
  estimateFee: (nbBlocks, cb) => {
    var levels = {};
    for (const nb of nbBlocks) {
      var feePerKb = blockchainExplorerMock.feeLevels[nb];
      levels[nb] = typeof feePerKb === 'number' ? feePerKb / 1e8 : -1;
    }

    return cb(null, levels);
  },
  estimateFeeV2: (opts, cb) => {
    return cb(null, 20000);
  },
  estimatePriorityFee: (opts, cb) => {
    return cb(null, 5000);
  },
  estimateGas: (nbBlocks, cb) => {
    return cb(null, '20000000000');
  },
  getBalance: (nbBlocks, cb) => {
    return cb(null, {
      unconfirmed: 0,
      confirmed: 20000000000 * 5,
      balance: 20000000000 * 5
    });
  },
  getTransactionCount: (addr, cb) => {
    return cb(null, 0);
  },
  reset: () => {
    blockchainExplorerMock.utxos = [];
    blockchainExplorerMock.txHistory = [];
    blockchainExplorerMock.feeLevels = [];
  }
};