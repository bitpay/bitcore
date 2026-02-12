import sinon from 'sinon';
import assert from 'assert';
import * as CWC from '@bitpay-labs/crypto-wallet-core';
import BWS from '@bitpay-labs/bitcore-wallet-service';
import { API } from '@bitpay-labs/bitcore-wallet-client';
import { Constants } from '@bitpay-labs/bitcore-wallet-client/src/lib/common/constants';
import { MongoClient } from 'mongodb';
import supertest from 'supertest';
import config from '../test/data/test-config';

const Bitcore = CWC.BitcoreLib;
const Bitcore_ = {
  btc: CWC.BitcoreLib,
  bch: CWC.BitcoreLibCash
};
const { ExpressApp, Storage } = BWS;

let client: MongoClient;
let expressApp: InstanceType<typeof ExpressApp>;

export async function newDb() {
  client = await MongoClient.connect(config.mongoDb.uri);
  const db = client.db(config.mongoDb.dbname);
  await db.dropDatabase();
  return { client, db };
}

export async function startBws() {
  const { db } = await newDb();
  const storage = new Storage({ db });
  Storage.createIndexes(db);
  expressApp = new ExpressApp();
  return new Promise<void>(resolve => {
    expressApp.start(
      {
        ignoreRateLimiter: true,
        storage: storage,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
        doNotCheckV8: true
      },
      () => {
        sinon.stub(API.prototype, 'constructor').callsFake(function(opts) {
          opts.request = supertest(expressApp.app);
          return (API.prototype.constructor as any).wrappedMethod.call(API.prototype, opts);
        });
        resolve();
      }
    );
  });
}

export async function stopBws() {
  return new Promise<void>(resolve => {
    expressApp.app.removeAllListeners();
    client.close(false, resolve);
  });
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
    const selected = blockchainExplorerMock.utxos.filter(utxo => {
      return address.includes(utxo.address);
    });

    return cb(null, JSON.parse(JSON.stringify(selected)));
  },
  setUtxo: (address, amount, m, confirmations?) => {
    const B = Bitcore_[address.coin];
    let scriptPubKey;
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
    assert(!!scriptPubKey, 'scriptPubKey not defined');
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
      const tx = new Bitcore.Transaction(raw);
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
    let list = [].concat(blockchainExplorerMock.txHistory);
    // -1 = mempool, always included in server' s v8.js
    list = list.filter(x => {
      return x.height >= startBlock || x.height == -1;
    });
    return cb(null, list);
  },
  getAddressActivity: (address, cb) => {
    const activeAddresses = blockchainExplorerMock.utxos.map(u => u.address);
    return cb(null, activeAddresses.includes(address));
  },
  setFeeLevels: levels => {
    blockchainExplorerMock.feeLevels = levels;
  },
  estimateFee: (nbBlocks, cb) => {
    const levels = {};
    for (const nb of nbBlocks) {
      const feePerKb = blockchainExplorerMock.feeLevels[nb];
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