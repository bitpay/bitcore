import logger from '../../../src/logger';
import fetch from 'node-fetch';
import config from '../../../src/config';
import { expect } from 'chai';
import { build, P2pRunner, P2pEvents } from '../../../src/services/p2p';
import { BlockModel } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { Storage } from '../../../src/services/storage';
import { sleep } from '../../../src/utils/async';

describe('P2P Service', () => {
  it('should sync to latest and listen for new blocks', async function() {
    this.timeout(15000);
    await Storage.start({});

    const chain = 'BTC';
    const network = 'regtest';
    const service = build(chain, Object.assign(config.chains.BTC.regtest, {
      chain,
      network,
    }));

    // add some blocks to sync on startup
    await btcrpc('generate', [10]);

    // start and connect the service
    const runner = new P2pRunner(chain, network, BlockModel, TransactionModel, service);
    await runner.start();

    // wait for it to stop syncing
    await new Promise(r => runner.events.once(P2pEvents.SYNC_COMPLETE, r));

    // check DB that all the new blocks are synced correctly
    await verify(10);

    // slowly add some blocks
    for (let i = 0; i < 5; i += 1) {
      await btcrpc('generate', [1]);
      await sleep(100);
    }

    // check that blocks got updated when not explicitly syncing
    await verify(15);
  });
});

const RPC_CONFIG = config.chains.BTC.regtest.rpc;

async function btcrpc(method: string, params: any[] = [], config: {
  host: string,
  port: number,
  username: string,
  password: string,
} = RPC_CONFIG) {
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  return fetch(`http://${config.host}:${config.port}`, {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '1.0',
      id: Date.now().toString(),
      method,
      params,
    }),
    headers: {
      'Content-Type': 'text/plain',
      'Authorization': `Basic ${auth}`,
    }
  })
  .then(res => res.json())
  .then(res => {
    if (res.error) {
      throw new Error(res.error);
    }
    return res.result;
  });
}

async function verify(tail: number) {
  const myTip = await BlockModel.getLocalTip({
    chain: 'BTC',
    network: 'regtest',
  });
  const poolTip = await btcrpc('getbestblockhash');

  // check that we're at the right tip
  expect(myTip.hash).to.equal(poolTip);

  let hash = poolTip;

  // loop back `height` blocks and check that everything is OK
  for (; tail > 0; tail -= 1) {
    logger.info(`Checking block ${hash}`);

    // check block is correct
    const truth = await btcrpc('getblock', [ hash ]);
    const ours = await BlockModel.find({ hash });
    expect(ours.length).to.equal(1);
    expect(ours[0].previousBlockHash).to.equal(truth.previousblockhash);
    expect(ours[0].nextBlockHash).to.equal(truth.nextblockhash);
    expect(ours[0].merkleRoot).to.equal(truth.merkleroot);
    expect(ours[0].height).to.equal(truth.height);

    // check that we got all transactions
    for (const txid of truth.tx) {
      logger.info(` - transaction ${txid}`);
      const tx = await TransactionModel.find({ txid });
      expect(tx.length).to.equal(1);
      expect(tx[0].blockHash).to.equal(hash);
      expect(tx[0].blockHeight).to.equal(truth.height);
    }

    // check we have no extra transactions
    const extra = await TransactionModel.find({
      blockHash: hash,
      txid: {
        $nin: truth.tx
      },
    });
    expect(extra.length).to.equal(0);

    // move on to the next hash
    hash = ours[0].previousBlockHash;
  }
}
