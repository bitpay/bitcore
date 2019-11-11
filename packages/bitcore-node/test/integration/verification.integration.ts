import { expect } from 'chai';
import { Modules } from '../../src/modules';
import { Config } from '../../src/services/config';
import { VerificationPeer } from '../verification/VerificationPeer';
import { AsyncRPC } from '../../src/rpc';
import config from '../../src/config';
import { TransactionStorage } from '../../src/models/transaction';
import { resetDatabase } from '../helpers';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';
const chain = 'BTC';
const network = 'regtest';
const address = '2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t';

const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

describe('VerificationPeer', function() {
  this.timeout(500000);
  before(async () => {
    await resetDatabase();
  });

  it('should not save any mempoool transactions', async () => {
    Modules.loadConfigured();
    const chainConfig = Config.chainConfig({ chain, network });
    const worker = new VerificationPeer({ chain, network, chainConfig });
    worker.isSyncingNode = true;
    worker.isSyncing = true;
    await worker.connect();
    const sawTx = new Promise(r => {
      worker.events.on('transaction', r);
    });
    for (let i = 0; i < 10; i++) {
      try {
        await rpc.sendtoaddress(address, 0.1);
        console.log('Sending');
      } catch (e) {
        console.log('Generating blocks');
        await rpc.call('generatetoaddress', [101, address]);
        await worker.syncDone();
        console.log('Sending after generating');
        await rpc.sendtoaddress(address, 0.1);
      }
    }
    await sawTx;
    const txCount = await TransactionStorage.collection.countDocuments({ chain, network });
    expect(txCount).to.be.eq(0);
    worker.disconnect();
  });

  it('should save any mempoool transactions', async () => {
    Modules.loadConfigured();
    const chainConfig = Config.chainConfig({ chain, network });
    const worker = new BitcoinP2PWorker({ chain, network, chainConfig });
    worker.isSyncingNode = true;
    worker.isSyncing = true;
    await worker.connect();
    const sawTx = new Promise(r => {
      worker.events.on('transaction', r);
    });
    for (let i = 0; i < 10; i++) {
      try {
        await rpc.sendtoaddress(address, 0.1);
        console.log('Sending');
      } catch (e) {
        console.log('Generating blocks');
        await rpc.call('generatetoaddress', [101, address]);
        await worker.syncDone();
        console.log('Sending after generating');
        await rpc.sendtoaddress(address, 0.1);
      }
    }
    await sawTx;
    const txCount = await TransactionStorage.collection.countDocuments({ chain, network });
    expect(txCount).to.be.gt(0);
    worker.disconnect();
  });
});
