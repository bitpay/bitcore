const bitcoreLib = require('../../../bitcore-lib');
const {Networks, Transaction, PrivateKey, Block } = bitcoreLib;

import config from '../../src/config';
import { StorageService } from '../../src/services/storage';

function generateBlocks(blockCount: number) {
  let blocks = new Array<any>();
  for(let i = 0; i < blockCount; i++ ) {
    if(i > 0 ) {
      blocks.push(generateBlock(blocks[i - 1]));
    } else {
      blocks.push(generateBlock());
    }
  }
  return blocks;
}

function generateBlock(previousBlock?: any) {
  const txAmount = 100000;
  let block = new Block();
  let transactions = new Array<any>();
  if(previousBlock) {
    for(let transaction of previousBlock.transactions) {
      let newTx = new Transaction();
      newTx.inputs = transaction.outputs;
      for(let input of newTx.inputs ) {
        newTx.to(newAddress(), input.amount);
      }
      transactions.push(newTx);
    }
    block.transactions = transactions;
  } else {
    let txPerMb = 2500;
    let blockSize = txPerMb * 32;
    for(let i = 0; i < blockSize; i ++ ) {
      let newTx = new Transaction()
        .to(newAddress(), txAmount);
      block.transactions.push(newTx);
    }
  }
  return block;
}


function newAddress() {
  var privateKey = new PrivateKey();
  var publicKey = privateKey.toPublicKey();
  var address = publicKey.toAddress(Networks.livenet);
  return address;
}

function startTestDatabase() {
  const storageArgs = {
    dbHost: config.dbHost,
    dbName: 'bitcore-benchmark'
  };


  let storage = new StorageService();
  return storage.start(storageArgs);
}


async function benchmark() {

 await startTestDatabase();
 let blocks = generateBlocks(1000);
  console.log(blocks.length);

}

benchmark();
