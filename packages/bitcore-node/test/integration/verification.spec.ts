import { expect } from 'chai';
import config from '../../src/config';
import { BitcoinBlockStorage } from '../../src/models/block';
import { CoinStorage } from '../../src/models/coin';
import { TransactionStorage } from '../../src/models/transaction';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';
import { VerificationPeer } from '../../src/modules/bitcoin/VerificationPeer';
import { AsyncRPC } from '../../src/rpc';
import { Config } from '../../src/services/config';
import { wait } from '../../src/utils/wait';
import { resetDatabase } from '../helpers';
import { intAfterHelper, intBeforeHelper } from '../helpers/integration';

const chain = 'BTC';
const network = 'regtest';
const address = '2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t';

const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

async function sendBitcoin() {
  try {
    await rpc.sendtoaddress(address, 0.1);
    console.log('Sending');
  } catch (e) {
    // Handle insufficent balance issues
    console.log('Generating blocks');
    const ourAddress = await rpc.getnewaddress('');
    await rpc.call('generatetoaddress', [130, ourAddress]);
    await wait(5000);
    console.log('Sending after generating');
    await rpc.sendtoaddress(address, 0.1);
  }
}

function addBlock1() {
  return BitcoinBlockStorage.collection.insertOne({
    chain,
    network,
    height: 8976158,
    hash: '0x9997699519d116dfa89256d0f6ebd1737db13adca583dc80dbd533d90083961c',
    version: 100,
    merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
    time: new Date(1526326784),
    timeNormalized: new Date(1526326784),
    transactionCount: 1,
    reward: 50,
    nonce: 3,
    previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
    nextBlockHash: '0xddae2bf21fb5836dec837671afd7bea1cc49d7111462e803ed3efc10570f1858',
    size: 264,
    bits: parseInt('207fffff', 16),
    processed: true
  });
}

function addTx() {
  return TransactionStorage.collection.insertOne({
    chain,
    network,
    txid: '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098',
    blockHash: '0x9997699519d116dfa89256d0f6ebd1737db13adca583dc80dbd533d90083961c',
    blockHeight: 8976158,
    blockTime: new Date('2009-01-09T02:54:25.000Z'),
    blockTimeNormalized: new Date('2009-01-09T02:54:25.000Z'),
    coinbase: true,
    fee: 0,
    inputCount: 1,
    locktime: 0,
    outputCount: 1,
    size: 134,
    value: 5000000000.0,
    wallets: []
  });
}
function addCoin() {
  return CoinStorage.collection.insertOne({
    chain,
    network,
    mintIndex: 0,
    mintTxid: '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098',
    address: '12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX',
    coinbase: true,
    mintHeight: 1,
    script: Buffer.from('QQSWtTjoU1GccmoskeYewRYArhOQgTpifGb7i+eUe+Y8Utp1iTeVFdTgpgT4FBeB5iKUchFmv2Iec6gsvyNCyFjurA=='),
    spentHeight: -2,
    spentTxid: '',
    value: 5000000000.0,
    wallets: []
  });
}

describe('VerificationPeer', function() {
  const suite = this;
  this.timeout(500000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  beforeEach(async () => {
    await resetDatabase();
  });

  it('should not save any mempoool transactions', async () => {
    const chainConfig = Config.chainConfig({ chain, network });
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();
    const sawTx = new Promise(r => {
      worker.events.on('transaction', r);
    });
    await sendBitcoin();
    await sawTx;
    const txCount = await TransactionStorage.collection.countDocuments({ chain, network });
    expect(txCount).to.be.eq(0);
    worker.disconnect();
  });

  it('should save any mempoool transactions', async () => {
    const chainConfig = Config.chainConfig({ chain, network });
    const worker = new BitcoinP2PWorker({ chain, network, chainConfig });
    worker.isSyncingNode = true;
    worker.isSyncing = true;
    await worker.connect();
    const sawTx = new Promise(r => {
      worker.events.on('transaction', r);
    });
    await sendBitcoin();
    await sawTx;
    const txCount = await TransactionStorage.collection.countDocuments({ chain, network });
    expect(txCount).to.be.gt(0);
    worker.disconnect();
  });

  it('should detect a fault in a series of blocks', async () => {
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();
    await addBlock1();
    await addTx();
    await addCoin();

    await BitcoinBlockStorage.collection.updateOne(
      { hash: '0x9997699519d116dfa89256d0f6ebd1737db13adca583dc80dbd533d90083961c' },
      { $unset: { nextBlockHash: '' } }
    );

    const tip = 8976159;
    const verified = await worker.validateDataForBlock(8976158, tip, true);
    expect(verified.success == false);
    expect(verified.errors.length).to.eq(1);
    expect(verified.errors[0].type).to.eq('CORRUPTED_BLOCK');
    expect(verified.errors[0].payload.txCount).to.eq(1);
    expect(verified.errors[0].payload.foundTxs).to.eq(1);
    await worker.disconnect();
  });

  it('should detect a missing transaction', async () => {
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();
    await addBlock1();
    await addCoin();

    const tip = 8976159;
    const verified = await worker.validateDataForBlock(8976158, tip, true);
    expect(verified.success == false);
    expect(verified.errors.length).to.eq(1);
    expect(verified.errors[0].type).to.eq('CORRUPTED_BLOCK');
    expect(verified.errors[0].payload.txCount).to.eq(1);
    expect(verified.errors[0].payload.foundTxs).to.eq(0);
    await worker.disconnect();
  });

  it('should detect a dupe transaction', async () => {
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();
    await addBlock1();
    await addTx();
    await addTx();
    await addCoin();

    const tip = 8976159;
    const verified = await worker.validateDataForBlock(8976158, tip, true);
    expect(verified.success == false);
    expect(verified.errors.length).to.eq(2);
    expect(verified.errors[0].type).to.eq('CORRUPTED_BLOCK');
    expect(verified.errors[0].payload.txCount).to.eq(1);
    expect(verified.errors[0].payload.foundTxs).to.eq(2);

    expect(verified.errors[1].type).to.eq('DUPE_TRANSACTION');
    expect(verified.errors[1].payload.tx.txid).to.eq(
      '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098'
    );

    await worker.disconnect();
  });

  it('should detect a missing transaction output', async () => {
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();
    await addBlock1();
    await addTx();

    const tip = 8976159;
    const verified = await worker.validateDataForBlock(8976158, tip, true);
    expect(verified.success == false);
    expect(verified.errors.length).to.eq(1);
    expect(verified.errors[0].type).to.eq('MISSING_COIN_FOR_TXID');
    expect(verified.errors[0].payload.txid).to.eq('0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098');
    await worker.disconnect();
  });

  it('should detect a dupe transaction output', async () => {
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();
    await addBlock1();
    await addTx();
    await addCoin();
    await addCoin();

    const tip = 8976159;
    const verified = await worker.validateDataForBlock(8976158, tip, true);
    expect(verified.success == false);
    expect(verified.errors.length).to.eq(1);
    expect(verified.errors[0].type).to.eq('DUPE_COIN');
    expect(verified.errors[0].payload.coin.mintTxid).to.eq(
      '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098'
    );
    await worker.disconnect();
  });

  it('should detect a missing block', async () => {
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();

    await addTx();
    await addCoin();
    const tip = 8976159;
    const verified = await worker.validateDataForBlock(8976158, tip, true);
    expect(verified.success == false);
    expect(verified.errors.length).to.eq(1);
    expect(verified.errors[0].type).to.eq('MISSING_BLOCK');
    expect(verified.errors[0].payload.blockNum).to.eq(8976158);
    await worker.disconnect();
  });

  it('should detect a dupe block', async () => {
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();

    await addBlock1();
    await addBlock1();
    await addTx();
    await addCoin();
    const tip = 8976159;
    const verified = await worker.validateDataForBlock(8976158, tip, true);
    expect(verified.success == false);
    expect(verified.errors.length).to.eq(2);
    expect(verified.errors[0].type).to.eq('DUPE_BLOCKHEIGHT');
    expect(verified.errors[0].payload.blockNum).to.eq(8976158);
    expect(verified.errors[1].type).to.eq('DUPE_BLOCKHASH');
    expect(verified.errors[1].payload.blockNum).to.eq(8976158);

    await worker.disconnect();
  });

  it('should handle non-linear scanning by ignoring previousBlockHash', async () => {
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();

    await addBlock1();
    await addTx();
    await addCoin();

    await BitcoinBlockStorage.collection.updateOne(
      { hash: '0x9997699519d116dfa89256d0f6ebd1737db13adca583dc80dbd533d90083961c' },
      { $set: { previousBlockHash: 'abcdefg' } }
    );

    const tip = 8976159;
    await worker.validateDataForBlock(8976154, tip, true);
    const verified = await worker.validateDataForBlock(8976158, tip, true);
    expect(verified.success == true);
    await worker.disconnect();
  });
});
