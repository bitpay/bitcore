import { BitcoreLib as bitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import config from '../../src/config';
import { Storage } from '../../src/services/storage';
import { BitcoinBlockStorage } from '../../src/models/block';
import { BitcoinBlockType } from '../../src/types/namespaces/Bitcoin/Block';
import { resetDatabase } from '../helpers/index.js';
import * as crypto from 'crypto';
import { BitcoinTransactionType } from '../../src/types/namespaces/Bitcoin/Transaction';

const { Transaction, PrivateKey } = bitcoreLib;
const UnspentOutput = Transaction.UnspentOutput;

function randomHash() {
  return crypto.randomBytes(32).toString('hex');
}
function* generateBlocks(blockCount: number, blockSizeMb: number) {
  let prevBlock: BitcoinBlockType | undefined = undefined;
  for (let i = 0; i < blockCount; i++) {
    const tempBlock = generateBlock(blockSizeMb, prevBlock);
    yield tempBlock;
    prevBlock = tempBlock;
  }
}

function preGenerateBlocks(blockCount: number, blockSizeMb: number) {
  const blocks = new Array<BitcoinBlockType>();
  for (const block of generateBlocks(blockCount, blockSizeMb)) {
    blocks.push(block);
  }
  return blocks;
}

function generateBlock(blockSizeMb: number, previousBlock?: BitcoinBlockType): BitcoinBlockType {
  const txAmount = 100000;
  const prevHash = previousBlock ? previousBlock.hash : '';
  const block: BitcoinBlockType = {
    hash: randomHash(),
    transactions: [],
    toBuffer: () => {
      return { length: 264 } as Buffer;
    },
    header: {
      toObject: () => {
        return {
          hash: randomHash(),
          confirmations: 1,
          strippedsize: 228,
          size: 264,
          weight: 948,
          height: 1355,
          version: 536870912,
          versionHex: '20000000',
          merkleRoot: randomHash(),
          tx: [randomHash()],
          time: 1526756523,
          mediantime: 1526066375,
          nonce: 2,
          bits: parseInt('207fffff', 16),
          difficulty: 4.656542373906925e-10,
          chainwork: '0000000000000000000000000000000000000000000000000000000000000a98',
          prevHash: prevHash
        };
      }
    }
  };
  const transactions = new Array<any>();
  if (previousBlock) {
    for (const transaction of previousBlock.transactions) {
      // each transaction should have one input and one output
      const utxos = transaction.outputs.map(output => {
        return new UnspentOutput({
          txid: transaction.hash,
          vout: 0,
          address: output.script.toAddress('mainnet').toString(false),
          scriptPubKey: output.script.toBuffer().toString('hex'),
          amount: Number(txAmount)
        });
      });
      const newTx = new Transaction().from(utxos);
      for (const _ of newTx.inputs!) {
        newTx.to(newAddress(), txAmount);
      }
      transactions.push(newTx);
    }
    block.transactions = transactions;
  } else {
    const txPerMb = 2500;
    const blockSize = txPerMb * blockSizeMb;
    for (let i = 0; i < blockSize; i++) {
      const newTx = new Transaction().to(newAddress(), txAmount) as BitcoinTransactionType;
      block.transactions.push(newTx);
    }
  }
  return block;
}

const addresses = new Array<string>();
for (let i = 0; i < 100; i++) {
  const privateKey = new PrivateKey();
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress().toString();
  addresses.push(address);
}

function newAddress() {
  const index = Math.floor(Math.random() * 100);
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
  console.log('Generating blocks');
  const blocks = preGenerateBlocks(blockCount, blockSizeMb);
  const startTime = new Date();
  console.log('Adding blocks');
  for (const block of blocks) {
    process.stdout.write('.');
    await BitcoinBlockStorage.addBlock({ block, chain: 'BENCH', network: 'MARK', initialSyncComplete: false });
  }
  process.stdout.write('\n');
  const endTime = new Date();
  const time = endTime.getTime() - startTime.getTime();
  const seconds = time / 1000;
  console.log(`Benchmark for ${blockCount} (${blockSizeMb} MB) blocks completed after ${seconds} s`);
  console.log(`${(blockSizeMb * blockCount) / seconds} MB/s`);
  console.log(`${seconds / blockCount} Seconds/Block`);
}

startBenchmarkDatabase()
  .then(() => benchmark(80, 1))
  .then(() => benchmark(5, 32))
  .then(() => benchmark(1, 64))
  .then(() => process.exit());
