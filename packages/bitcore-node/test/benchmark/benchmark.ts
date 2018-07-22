const bitcoreLib = require('bitcore-lib');
const { Transaction, PrivateKey } = bitcoreLib;
const UnspentOutput = Transaction.UnspentOutput;

import config from '../../src/config';
import { Storage } from '../../src/services/storage';
import { BlockModel } from '../../src/models/block';
import { BitcoinBlockType } from '../../src/types/namespaces/Bitcoin/Block';
import { resetDatabase } from "../helpers/index.js";

function * generateBlocks(blockCount: number, blockSizeMb: number) {
  let prevBlock: BitcoinBlockType | undefined = undefined;
  for (let i = 0; i < blockCount; i++) {
      let tempBlock = generateBlock(blockSizeMb, prevBlock);
      yield tempBlock;
      prevBlock = tempBlock;
  }
}

function generateBlock(blockSizeMb: number, previousBlock?: BitcoinBlockType): BitcoinBlockType {
  const txAmount = 100000;
  const prevHash = previousBlock ? previousBlock.hash : '';
  let block: BitcoinBlockType = {
    hash: Buffer.from((Math.random() * 10000).toString()).toString('hex'),
    transactions: [],
    toBuffer: () => {
      return { length: 264 } as Buffer;
    },
    header: {
      toObject: () => {
        return {
          hash: Buffer.from((Math.random() * 10000).toString()).toString('hex'),
          confirmations: 1,
          strippedsize: 228,
          size: 264,
          weight: 948,
          height: 1355,
          version: '536870912',
          versionHex: '20000000',
          merkleRoot: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
          tx: ['08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08'],
          time: 1526756523,
          mediantime: 1526066375,
          nonce: '2',
          bits: parseInt('207fffff', 16).toString(),
          difficulty: 4.656542373906925e-10,
          chainwork: '0000000000000000000000000000000000000000000000000000000000000a98',
          prevHash: prevHash
        };
      }
    }
  };
  let transactions = new Array<any>();
  if (previousBlock) {
    for (let transaction of previousBlock.transactions) {
      const utxos = transaction.outputs.map((output) => {
        return new UnspentOutput({
          txid: transaction.hash,
          vout: 0,
          address: output.script.toAddress('mainnet'),
          scriptPubKey: output.script.toBuffer().toString('hex'),
          amount: Number(txAmount)
        })
      });
      let newTx = new Transaction().from(utxos);
      for (let _ of newTx.inputs) {
        newTx.to(newAddress(), txAmount);
      }
      transactions.push(newTx);
    }
    block.transactions = transactions;
  } else {
    let txPerMb = 2500;
    let blockSize = txPerMb * blockSizeMb;
    for (let i = 0; i < blockSize; i++) {
      let newTx = new Transaction().to(newAddress(), txAmount);
      block.transactions.push(newTx);
    }
  }
  return block;
}

let addresses = new Array<string>();
for (let i = 0; i < 100; i++) {
  var privateKey = new PrivateKey();
  var publicKey = privateKey.toPublicKey();
  var address = publicKey.toAddress().toString();
  addresses.push(address);
}

function newAddress() {
  let index = Math.floor(Math.random() * 100);
  return addresses[index];
}

function startBenchmarkDatabase() {
  const storageArgs = {
    dbHost: config.dbHost,
    dbName: 'bitcore-benchmark'
  };

  return Storage.start(storageArgs);
}

async function benchmark(blockCount: number, blockSizeMb: number) {
  await resetDatabase();
  const startTime = new Date();
  for (let block of generateBlocks(blockCount, blockSizeMb)) {
    console.log('Adding block', block.hash);
    await BlockModel.addBlock({ block, chain: 'BENCH', network: 'MARK', initialSyncComplete: false });
  }
  const endTime = new Date();
  const time = endTime.getTime() - startTime.getTime();
  const seconds = time/1000;
  console.log(`Benchmark for ${blockCount} (${blockSizeMb} MB) blocks completed after ${seconds} s`);
  console.log(`${blockSizeMb * blockCount / seconds} MB/s`);
  console.log(`${seconds / blockCount } Seconds/Block`);
}

startBenchmarkDatabase()
.then(() => benchmark(160, 1))
.then(() => benchmark(5, 32))
.then(() => process.exit());
