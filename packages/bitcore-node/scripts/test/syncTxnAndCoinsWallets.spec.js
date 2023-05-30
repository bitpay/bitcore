'use strict';

const { expect } = require('chai');
const { execSync } = require('child_process');
const { ObjectId } = require('mongodb');
const { Storage } = require('../../build/src/services/storage');
const { TransactionStorage } = require('../../build/src/models/transaction');
const { CoinStorage } = require('../../build/src/models/coin');


describe('syncTxnAndCoinsWallets', function() {
  this.timeout(20000);

  const DB_NAME = 'bitcore_mocha_scripts';
  before(async function() {
    if (!Storage.connected) {
      await Storage.start({ dbName: DB_NAME });
    }
    
    await TransactionStorage.collection.deleteMany({});
    await CoinStorage.collection.deleteMany({});

    await setupDb();
  });

  after(async function() {
    if (Storage.connected) {
      await Storage.stop();
    }
  });

  it('should add wallets to txns from coins', async function() {
    const buf = execSync(__dirname + '/../syncTxnAndCoinsWallets.js --chain BTC --network mainnet --startHeight 784431 --endHeight 784432 --no-dry --no-log-file', { env: { ...process.env, DB_NAME }});

    for (const t of txnsAndCoins) {
      const tx = await TransactionStorage.collection.findOne({ txid: t.txid });
      const coins = await CoinStorage.collection.find({ $or: [{ spentTxid: t.txid }, { mintTxid: t.txid }] }).toArray();

      const txWalletStrings = tx.wallets.map(w => w.toString());
      for (const c of coins) {
        for (const w of c.wallets) {
          if (!txWalletStrings.includes(w.toString())) {
            console.log(wallets);
            console.log(tx.txid, txWalletStrings, c.wallets.map(w => w.toString()));
            console.log(buf.toString());
          }
          expect(txWalletStrings.includes(w.toString())).to.be.true;
        }
      }
    }
  });
});



async function setupDb() {
  const promises = [];

  for (const tx of txnsAndCoins) {
    const c = CoinStorage.collection.insertMany(tx.COINS);
    promises.push(c);
    delete tx.COINS;
    const t = TransactionStorage.collection.insert(tx);
    promises.push(t);
  }
  return Promise.all(promises);
}


const wallets = new Array(10).fill(0).map(() => new ObjectId());

const txnsAndCoins = [
  {
    "_id": "64384bbe4d124e905184fedb",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "ac857c7c8679d33cfc54430db060ac310fba30240c775fa21fc32de5c2c98d66",
    "blockHeight": 784432,
    "blockHash": "00000000000000000001604e0e5c3b39a826b442c0ba5154339eb4f18e77d361",
    "blockTime": "2023-04-08T01:42:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:42:07.000Z",
    "coinbase": false,
    "fee": 9856,
    "size": 224,
    "locktime": 0,
    "inputCount": 1,
    "outputCount": 2,
    "value": 6570756,
    "wallets": [wallets[0]],
  
    COINS: [
      {
        "_id": "64384b2f4d124e9051827d7b",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "cb80d89647f0bcf447492d15993831560439db5dce84071a519e05b2312038ad",
        "network": "mainnet",
        "address": "1CiVa3Uvm11dgx3UT6vKQVNdwqbuWayXDR",
        "mintHeight": 784412,
        "coinbase": false,
        "value": 6580612,
        "script": "BinData(0,\"dqkUgIJJbnwSh18CfIdiWGbfhL6vsReIrA==\")",
        "spentHeight": 784432,
        "wallets": [wallets[0]],
        "spentTxid": "ac857c7c8679d33cfc54430db060ac310fba30240c775fa21fc32de5c2c98d66",
        "sequenceNumber": 4294967295
      },
      {
        "_id": "64384bba4d124e905184f23e",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "ac857c7c8679d33cfc54430db060ac310fba30240c775fa21fc32de5c2c98d66",
        "network": "mainnet",
        "address": "14nnjfaqULBmJZvBJr5T2vCz41vorEViM2",
        "mintHeight": 784432,
        "coinbase": false,
        "value": 6373919,
        "script": "BinData(0,\"dqkUKZFGF2HsCCRYUTv8MaAVpAJgUvmIrA==\")",
        "spentHeight": -2,
        "wallets": [wallets[1]]
      },
      {
        "_id": "64384bba4d124e905184f20c",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "ac857c7c8679d33cfc54430db060ac310fba30240c775fa21fc32de5c2c98d66",
        "network": "mainnet",
        "address": "3DtTHEV4tmp7nK8AEZxCBFPkK3AW4U2t2t",
        "mintHeight": 784432,
        "coinbase": false,
        "value": 196837,
        "script": "BinData(0,\"qRSFy0BvytD7F59FohIAJr2z2aR14Ic=\")",
        "spentHeight": -2,
        "wallets": [wallets[0]]
      }
    ]
  },

  {
    "_id": "64384bbe4d124e905184fed5",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "4e3a060bce79848612f19e1dd1d2218b01288d76e36316299a647f9578500387",
    "blockHeight": 784432,
    "blockHash": "00000000000000000001604e0e5c3b39a826b442c0ba5154339eb4f18e77d361",
    "blockTime": "2023-04-08T01:42:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:42:07.000Z",
    "coinbase": false,
    "fee": 6780,
    "size": 225,
    "locktime": 0,
    "inputCount": 1,
    "outputCount": 2,
    "value": 168600724,
    "wallets": [],
  
    COINS: [
      {
        "_id": "64348de24657342b7081ba6b",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "d4b71bedf012f492f635f8c85954aa606e530415264826c0a1dbfcb2d7c29b92",
        "network": "mainnet",
        "address": "189ovYutiESEqQnmEP8oGRjvRV3umAgrnz",
        "mintHeight": 309,
        "coinbase": false,
        "value": 168607504,
        "script": "BinData(0,\"dqkUTnNgtP/7l4zXYxJcOqYaCwx0C2iIrA==\")",
        "spentHeight": 784432,
        "wallets": [],
        "spentTxid": "4e3a060bce79848612f19e1dd1d2218b01288d76e36316299a647f9578500387",
        "sequenceNumber": 4294967295
      },
      {
        "_id": "64384bba4d124e905184f0ba",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "4e3a060bce79848612f19e1dd1d2218b01288d76e36316299a647f9578500387",
        "network": "mainnet",
        "address": "189ovYutiESEqQnmEP8oGRjvRV3umAgrnz",
        "mintHeight": 784432,
        "coinbase": false,
        "value": 168407711,
        "script": "BinData(0,\"dqkUTnNgtP/7l4zXYxJcOqYaCwx0C2iIrA==\")",
        "spentHeight": -2,
        "wallets": []
      },
      {
        "_id": "64384bba4d124e905184f088",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "4e3a060bce79848612f19e1dd1d2218b01288d76e36316299a647f9578500387",
        "network": "mainnet",
        "address": "1KgjKSHEmC1wUh8xfP2u59hJMydW3GnjGW",
        "mintHeight": 784432,
        "coinbase": false,
        "value": 193013,
        "script": "BinData(0,\"dqkUzPXP0VfcQg13fzqERAF0ILOgq2yIrA==\")",
        "spentHeight": -2,
        "wallets": [wallets[9]]
      },
    ]
  },

  {
    "_id": "64384bbe4d124e905184fed2",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "ab3c8ae8042f250b98f1d8a21f930221c4c6ced958e0c1bcede4efbe7f4969cc",
    "blockHeight": 784432,
    "blockHash": "00000000000000000001604e0e5c3b39a826b442c0ba5154339eb4f18e77d361",
    "blockTime": "2023-04-08T01:42:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:42:07.000Z",
    "coinbase": true,
    "fee": 0,
    "size": 178,
    "locktime": 0,
    "inputCount": 1,
    "outputCount": 2,
    "value": 635151892,
    "wallets": [],
  
    COINS: [
      {
        "_id": "64384bb94d124e905184eb15",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "ab3c8ae8042f250b98f1d8a21f930221c4c6ced958e0c1bcede4efbe7f4969cc",
        "network": "mainnet",
        "address": "false",
        "mintHeight": 784432,
        "coinbase": true,
        "value": 0,
        "script": "BinData(0,\"aiSqIanthbeydZUKpaswvxj4MigMRgMyXKVhMyR/2pb7aV5gQLA=\")",
        "spentHeight": -2,
        "wallets": []
      },
      {
        "_id": "64384bb94d124e905184eae1",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "ab3c8ae8042f250b98f1d8a21f930221c4c6ced958e0c1bcede4efbe7f4969cc",
        "network": "mainnet",
        "address": "bc1qxhmdufsvnuaaaer4ynz88fspdsxq2h9e9cetdj",
        "mintHeight": 784432,
        "coinbase": true,
        "value": 635151892,
        "script": "BinData(0,\"ABQ19t4mDJ873uR1JMRzpgFsDAVcuQ==\")",
        "spentHeight": -2,
        "wallets": []
      }
    ]
  },

  {
    "_id": "64384bb84d124e905184eaad",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "e807d2be9521c3c66161cd53af1991831d1dc07f679a9ffdd1bbfe7b297c544d",
    "blockHeight": 784431,
    "blockHash": "0000000000000000000504cebfd5e445001f4769f0ce6607dcd753bd5ee883fd",
    "blockTime": "2023-04-08T01:35:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:35:07.000Z",
    "coinbase": false,
    "fee": 47550,
    "size": 94,
    "locktime": 0,
    "inputCount": 1,
    "outputCount": 1,
    "value": 10000,
    "wallets": [[wallets[1]]],

    COINS: [
      {
        "_id": "64384bb34d124e905184d7c9",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "e807d2be9521c3c66161cd53af1991831d1dc07f679a9ffdd1bbfe7b297c544d",
        "network": "mainnet",
        "address": "bc1p6m0qrk26xp7xu9egjaupte6upnmkh4sfu5wte7sewjzkvplpj40sqy8xr5",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 10000,
        "script": "BinData(0,\"USDW3gHZWjB8bhcol3gV51wM92vWCeUcvPoZdIVmB+GVXw==\")",
        "spentHeight": 784432,
        "wallets": [],
        "spentTxid": "d740e2aeacd432fac357eb6813e5bc7c9d4ba023f9d5d0112b3bcf08f5aab924",
        "sequenceNumber": 4294967293
      },
      {
        "_id": "64384bb34d124e905184d764",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "e25a298aff6f1a5daf0c2440b349f3248788efe4365233ddc31655bbb2a3c4b8",
        "network": "mainnet",
        "address": "bc1pw066xq735kykp0qy09pvut8v9hzhue6lfwwe5nxyfk35stxefjasxs0ecm",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 57550,
        "script": "BinData(0,\"USBz9aMD0aWJYLwEeULOLOwtxX5nX0udmkzETaNILNlMuw==\")",
        "spentHeight": 784431,
        "wallets": [],
        "spentTxid": "e807d2be9521c3c66161cd53af1991831d1dc07f679a9ffdd1bbfe7b297c544d",
        "sequenceNumber": 4294967293
      }
    ]
  },

  {
    "_id": "64384bb84d124e905184eaac",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "4d0dac567201b57b91254d63d3be2fdc3f77d87d7ae0381faf067324e15a8e4a",
    "blockHeight": 784431,
    "blockHash": "0000000000000000000504cebfd5e445001f4769f0ce6607dcd753bd5ee883fd",
    "blockTime": "2023-04-08T01:35:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:35:07.000Z",
    "coinbase": false,
    "fee": 1377,
    "size": 195,
    "locktime": 0,
    "inputCount": 3,
    "outputCount": 2,
    "value": 39283010,
    "wallets": [wallets[6]],

    COINS: [
      {
        "_id": "64384a294d124e90517da554",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "10665c4bca71833c9391419b2682a2eb42d812722931f478dd03161c73306d1c",
        "network": "mainnet",
        "address": "bc1q75mqgk96mjautt9vlsxlc3h4mj6qng44ruljhm",
        "mintHeight": 391,
        "coinbase": false,
        "value": 9329820,
        "script": "BinData(0,\"ABT1NgRYuty7xays/A38RvXctAmitQ==\")",
        "spentHeight": 784431,
        "wallets": [wallets[6]],
        "spentTxid": "4d0dac567201b57b91254d63d3be2fdc3f77d87d7ae0381faf067324e15a8e4a",
        "sequenceNumber": 4294967295
      },
      {
        "_id": "643849fa4d124e90517cd5c0",
        "chain": "BTC",
        "mintIndex": 9,
        "mintTxid": "3187fffc5036c5160e0f19f3b83cd39509c20c78696dae0b9ec8a0be61130ee7",
        "network": "mainnet",
        "address": "bc1qesvqtk30xpaucs57nyyvlup0sx7z3t44vsyzkp",
        "mintHeight": 386,
        "coinbase": false,
        "value": 13314063,
        "script": "BinData(0,\"ABTMGAXaLzB7zEKemQjP8C+BvCiutQ==\")",
        "spentHeight": 784431,
        "wallets": [wallets[6]],
        "spentTxid": "4d0dac567201b57b91254d63d3be2fdc3f77d87d7ae0381faf067324e15a8e4a",
        "sequenceNumber": 4294967295
      },
      {
        "_id": "643849fa4d124e90517cd1e8",
        "chain": "BTC",
        "mintIndex": 9,
        "mintTxid": "d5d9c4a4402432919500164620332226e0990dee7095b397952edc3c959039fd",
        "network": "mainnet",
        "address": "bc1qesvqtk30xpaucs57nyyvlup0sx7z3t44vsyzkp",
        "mintHeight": 386,
        "coinbase": false,
        "value": 16640504,
        "script": "BinData(0,\"ABTMGAXaLzB7zEKemQjP8C+BvCiutQ==\")",
        "spentHeight": 784431,
        "wallets": [wallets[7]],
        "spentTxid": "4d0dac567201b57b91254d63d3be2fdc3f77d87d7ae0381faf067324e15a8e4a",
        "sequenceNumber": 4294967295
      },
      {
        "_id": "64384bb54d124e905184e0de",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "4d0dac567201b57b91254d63d3be2fdc3f77d87d7ae0381faf067324e15a8e4a",
        "network": "mainnet",
        "address": "bc1qnz4vksrtgnpupve52auu08hcd32x5hk4qp33tk",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 2506140,
        "script": "BinData(0,\"ABSYqstAa0TDwLM0V3nHnvhsVGpe1Q==\")",
        "spentHeight": -2,
        "wallets": []
      },
      {
        "_id": "64384bb54d124e905184e0ad",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "4d0dac567201b57b91254d63d3be2fdc3f77d87d7ae0381faf067324e15a8e4a",
        "network": "mainnet",
        "address": "bc1qwdjcrfuw0jsssm0ldwyphl49xx362j90e3k3f0",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 36776870,
        "script": "BinData(0,\"ABRzZYGnjnyhCG3/a4gb/qUxo6VIrw==\")",
        "spentHeight": -2,
        "wallets": []
      }
    ]
  },

  {
    "_id": "64384bb84d124e905184eaab",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "2a21850b496a85b3ea7b8daf28b7aa66b5e39050ee9537db538a11367de82216",
    "blockHeight": 784431,
    "blockHash": "0000000000000000000504cebfd5e445001f4769f0ce6607dcd753bd5ee883fd",
    "blockTime": "2023-04-08T01:35:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:35:07.000Z",
    "coinbase": false,
    "fee": 1272,
    "size": 94,
    "locktime": 0,
    "inputCount": 1,
    "outputCount": 1,
    "value": 546,
    "wallets": [],

    COINS: [
      {
        "_id": "64384bb54d124e905184df0d",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "a64bfe1444280897ae096bfc1343b62f0452f2108680ea987cd517f45a1a6bd6",
        "network": "mainnet",
        "address": "bc1pqekkkx5pzlp0kzcstusv7fpzgdwcl8wkwchp7gqcu0l6k05sx22s7ck4jh",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 1818,
        "script": "BinData(0,\"USAGbWsagRfC+wsQXyDPJCJDXY+d1nYuHyAY4/+rPpAylQ==\")",
        "spentHeight": 784431,
        "wallets": [],
        "spentTxid": "2a21850b496a85b3ea7b8daf28b7aa66b5e39050ee9537db538a11367de82216",
        "sequenceNumber": 4294967295
      },
      {
        "_id": "64384bb54d124e905184e0fd",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "2a21850b496a85b3ea7b8daf28b7aa66b5e39050ee9537db538a11367de82216",
        "network": "mainnet",
        "address": "bc1p2flh78z54p99fs3hlzmcdmwxgk3np6kgm2p5vd6uem4gt42756es332tm8",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 546,
        "script": "BinData(0,\"USBSf38cVKhKVMI3+LeG7cZFozDqyNqDRjdczuqF1V6msw==\")",
        "spentHeight": -2,
        "wallets": []
      }
    ]
  },

  {
    "_id": "64384bb84d124e905184eaaa",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "5a262a1bdac1fb80093d6648340bd19c0330be8ee159b14defdc5cc021bfd4f0",
    "blockHeight": 784431,
    "blockHash": "0000000000000000000504cebfd5e445001f4769f0ce6607dcd753bd5ee883fd",
    "blockTime": "2023-04-08T01:35:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:35:07.000Z",
    "coinbase": false,
    "fee": -22373,
    "size": 178,
    "locktime": 0,
    "inputCount": 2,
    "outputCount": 2,
    "value": 65925,
    "wallets": [],

    COINS: [
      {
        "_id": "64384b994d124e90518451fc",
        "chain": "BTC",
        "mintIndex": 21,
        "mintTxid": "76c4215470be1696cf14249dca025aea2764128ce4090ee17a64f66f1ca97e17",
        "network": "mainnet",
        "address": "bc1pyjkqseesv7h5x4syrrv8pr3nc3qvt9zsq2s6wywjrsl3auea8juqtw5eed",
        "mintHeight": 434,
        "coinbase": false,
        "value": 43552,
        "script": "BinData(0,\"USAkrAhnMGevQ1YEGNhwjjPEQMWUUAKhpxHSHD8e8z08uA==\")",
        "spentHeight": 784431,
        "wallets": [],
        "spentTxid": "5a262a1bdac1fb80093d6648340bd19c0330be8ee159b14defdc5cc021bfd4f0",
        "sequenceNumber": 4294967293
      },
      {
        "_id": "64384bb54d124e905184e294",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "5a262a1bdac1fb80093d6648340bd19c0330be8ee159b14defdc5cc021bfd4f0",
        "network": "mainnet",
        "address": "bc1pdglczhyxf4yzsqaxgwenclhfm9xnx0eyhza3hgrg9ppyycudwhhq4dcxds",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 3425,
        "script": "BinData(0,\"USBqP4Fchk1IKAOmQ7M8funZTTM/JLi7G6BoKEJCY4117g==\")",
        "spentHeight": -2,
        "wallets": [wallets[4]]
      },
      {
        "_id": "64384bb54d124e905184e263",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "5a262a1bdac1fb80093d6648340bd19c0330be8ee159b14defdc5cc021bfd4f0",
        "network": "mainnet",
        "address": "bc1p0xfhu05c789jgl8re4np2scpsfsz2vfxxsla0m8q258j2hymq42sh7h7xk",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 62500,
        "script": "BinData(0,\"USB5k34+mPHLJHzjzWYVQwGCYCUxJjQ/1+zgVQ8lXJsFVQ==\")",
        "spentHeight": 784431,
        "wallets": [],
        "spentTxid": "96854625adcb30f6f39247fe537ffdddffaf3baaae134e9baba8f236a7033938",
        "sequenceNumber": 4294967293
      },
    ]
  },

  {
    "_id": "64384bb84d124e905184eaa9",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "487dd715fa70be2a05c7054df57e699e22d266250b1d7d092e6e869f1805f46e",
    "blockHeight": 784431,
    "blockHash": "0000000000000000000504cebfd5e445001f4769f0ce6607dcd753bd5ee883fd",
    "blockTime": "2023-04-08T01:35:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:35:07.000Z",
    "coinbase": false,
    "fee": 885,
    "size": 149,
    "locktime": 0,
    "inputCount": 1,
    "outputCount": 2,
    "value": 226048,
    "wallets": [],

    COINS: [
      {
        "_id": "64384b794d124e905183c874",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "763574098afb283fc23aaee5fd7d1c03fbf316c558218385bce40be25d864458",
        "network": "mainnet",
        "address": "38kgoQ8PNvnHEmxWGz9Le7UYqASWQUGFLo",
        "mintHeight": 429,
        "coinbase": false,
        "value": 226933,
        "script": "BinData(0,\"qRRNepTDp1rGps1dJXjGH8HHSniLC4c=\")",
        "spentHeight": 784431,
        "wallets": [],
        "spentTxid": "487dd715fa70be2a05c7054df57e699e22d266250b1d7d092e6e869f1805f46e",
        "sequenceNumber": 4294967295
      },
      {
        "_id": "64384bb44d124e905184db2f",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "487dd715fa70be2a05c7054df57e699e22d266250b1d7d092e6e869f1805f46e",
        "network": "mainnet",
        "address": "38kgoQ8PNvnHEmxWGz9Le7UYqASWQUGFLo",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 150099,
        "script": "BinData(0,\"qRRNepTDp1rGps1dJXjGH8HHSniLC4c=\")",
        "spentHeight": -2,
        "wallets": []
      },
      {
        "_id": "64384bb44d124e905184dafd",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "487dd715fa70be2a05c7054df57e699e22d266250b1d7d092e6e869f1805f46e",
        "network": "mainnet",
        "address": "bc1pyedtf5g6jvpn0ws25a38kv9nnrtzlyfv362aku3n2c3kdgc86hdq4nhuth",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 75949,
        "script": "BinData(0,\"USAmWrTRGpMDN7oKp2J7MLOY1i+RLI6V23IzViNmowfV2g==\")",
        "spentHeight": 784432,
        "wallets": [],
        "spentTxid": "e67081d95aec02e141202b41e9a3decdca29d54554a906b351aa0b4b5f3d2edf",
        "sequenceNumber": 4294967293
      }
    ]
  },

  {
    "_id": "64384bb84d124e905184eaa8",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "8af29b05e56294d3fb62b8ac6ba23d01eb44bf438f0bb0a349e0553bc108f05f",
    "blockHeight": 784431,
    "blockHash": "0000000000000000000504cebfd5e445001f4769f0ce6607dcd753bd5ee883fd",
    "blockTime": "2023-04-08T01:35:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:35:07.000Z",
    "coinbase": false,
    "fee": 770,
    "size": 137,
    "locktime": 0,
    "inputCount": 1,
    "outputCount": 2,
    "value": 37265,
    "wallets": [],

    COINS: [
      {
        "_id": "643484a94657342b7068b2dc",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "edce616bc3b5077f0b753a3119da9761a76323eadcaee80e14f52f4be9519b4d",
        "network": "mainnet",
        "address": "bc1psg68yaevy8u23nkp6zfsaef9enh94kl5eupc9935q5pfja3j6vvqr77jl0",
        "mintHeight": 146,
        "coinbase": false,
        "value": 38035,
        "script": "BinData(0,\"USCCNHJ3LCH4qM7B0JMO5SXM7lrb9M8DgpY0BQKZdjLTGA==\")",
        "spentHeight": 784431,
        "wallets": [],
        "spentTxid": "8af29b05e56294d3fb62b8ac6ba23d01eb44bf438f0bb0a349e0553bc108f05f",
        "sequenceNumber": 4294967293
      },
      {
        "_id": "64384bb54d124e905184e011",
        "chain": "BTC",
        "mintIndex": 1,
        "mintTxid": "8af29b05e56294d3fb62b8ac6ba23d01eb44bf438f0bb0a349e0553bc108f05f",
        "network": "mainnet",
        "address": "bc1p6d59ukemxzuewmvx983lm8xlvn7gvazppxh425flr63dg5uzpt3qr6yp09",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 36070,
        "script": "BinData(0,\"USDTaF5bOzC5l22GKeP9nN9k/IZ0QQmvVVE/HqLUU4IK4g==\")",
        "spentHeight": -2,
        "wallets": []
      },
      {
        "_id": "64384bb54d124e905184dfe0",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "8af29b05e56294d3fb62b8ac6ba23d01eb44bf438f0bb0a349e0553bc108f05f",
        "network": "mainnet",
        "address": "bc1ptcppl5qc0tchwnqwl2j9nsnh09vtmpc3ng6pzy56aaeq5995ghkq54ke2r",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 1195,
        "script": "BinData(0,\"USBeAh/QGHrxd0wO+qRZwnd5WL2HEZo0ERKa73IKFLRF7A==\")",
        "spentHeight": 784431,
        "wallets": [],
        "spentTxid": "b387b21dcd4af2b385276ef44a33ef06419b0ab9821d3ec6aacf29b339f5eee0",
        "sequenceNumber": 4294967293
      }
    ]
  },

  {
    "_id": "64384bb84d124e905184eaa7",
    "chain": "BTC",
    "network": "mainnet",
    "txid": "cfbfb835e7227608e927edb6ea949e0a563ba463514a26f2a1982e38d4c6699a",
    "blockHeight": 784431,
    "blockHash": "0000000000000000000504cebfd5e445001f4769f0ce6607dcd753bd5ee883fd",
    "blockTime": "2023-04-08T01:35:07.000Z",
    "blockTimeNormalized": "2023-04-08T01:35:07.000Z",
    "coinbase": false,
    "fee": 1484,
    "size": 94,
    "locktime": 0,
    "inputCount": 1,
    "outputCount": 1,
    "value": 546,
    "wallets": [wallets[1]],

    COINS: [
      {
        "_id": "64384bb44d124e905184d8f6",
        "chain": "BTC",
        "mintIndex": 7,
        "mintTxid": "8d549b05a91a1852c8152ca7b65fa39654ad87d1e6833e9b0a5ee8897253c6fa",
        "network": "mainnet",
        "address": "bc1pzxt0d2p0f8mfglkln3z0kzs5j7wedkwf7dcgvnd7d6pyfnukz5fqcw9mvt",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 2030,
        "script": "BinData(0,\"USARlvaoL0n2lH7fnET7ChSXnZbZyfNwhk2+boJEz5YVEg==\")",
        "spentHeight": 784431,
        "wallets": [wallets[1]],
        "spentTxid": "cfbfb835e7227608e927edb6ea949e0a563ba463514a26f2a1982e38d4c6699a",
        "sequenceNumber": 4294967295
      },
      {
        "_id": "64384bb54d124e905184dfaa",
        "chain": "BTC",
        "mintIndex": 0,
        "mintTxid": "cfbfb835e7227608e927edb6ea949e0a563ba463514a26f2a1982e38d4c6699a",
        "network": "mainnet",
        "address": "bc1pyymz64g66dqrm2nkvmcswjqhw4c3evjrmdygyqsg0u0dj5rg59msr7j2sk",
        "mintHeight": 784431,
        "coinbase": false,
        "value": 546,
        "script": "BinData(0,\"USAhNi1VGtNAPap2ZvEHSBd1cRyyQ9tIggIIfx7ZUGihdw==\")",
        "spentHeight": -2,
        "wallets": [wallets[1]]
      }
    ]
  }
];
