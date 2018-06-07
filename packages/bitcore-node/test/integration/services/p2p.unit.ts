import logger from '../../../src/logger';
import config from '../../../src/config';
import { expect } from 'chai';
import { P2pProvider, P2pEvents } from '../../../src/services/p2p';
import { BlockModel } from '../../../src/models/block';
import { TransactionModel } from '../../../src/models/transaction';
import { Storage } from '../../../src/services/storage';
import { sleep } from '../../../src/utils/async';
import { RPC } from '../../../src/rpc';

describe('P2P Service', () => {
  it('should sync to latest and listen for new blocks', async function() {
    this.timeout(15000);
    await Storage.start({});

    expect(config.chains.BTC).to.not.be.undefined;;
    expect(config.chains.BTC.regtest).to.not.be.undefined;;
    expect(config.chains.BTC.regtest.rpc).to.not.be.undefined;;

    const creds = config.chains.BTC.regtest.rpc;
    const rpc = new RPC(creds.username, creds.password, creds.host, creds.port);
    const chain = 'BTC';
    const network = 'regtest';

    // add some blocks to sync on startup
    await rpc.generate(10);

    // start and connect the service
    const runner = P2pProvider.build({
      chain,
      network,
      blocks: BlockModel,
      transactions: TransactionModel,
      config: Object.assign(config.chains.BTC.regtest, {
        chain,
        network,
        parentChain: chain,
        forkHeight: 0,
      }),
    });
    const stream = await runner.start();

    // wait for it to stop syncing
    await new Promise(r => runner.events.once(P2pEvents.SYNC_COMPLETE, r));

    // check DB that all the new blocks are synced correctly
    await verify(rpc, 10);

    // slowly add some blocks
    for (let i = 0; i < 5; i += 1) {
      await rpc.generate(1);
      await sleep(100);
    }

    // wait for all the new blocks to hit the database
    let recent;
    const stored = new Promise(r => stream.blocks.subscribe(pair => {
      if (pair.block.hash === recent) {
        r();
      }
      recent = pair.block.hash;
    }));
    const added = (await rpc.generate(1))[0];
    if (added !== recent) {
      recent = added;
      await stored;
    }

    // check that blocks got updated when not explicitly syncing
    await verify(rpc, 16);
  });
});

async function verify(rpc: RPC, tail: number) {
  const myTip = await BlockModel.getLocalTip({
    chain: 'BTC',
    network: 'regtest',
  });
  const poolTip = await rpc.bestBlockHashAsync();

  // check that we're at the right tip
  expect(myTip.hash, 'local tip').to.equal(poolTip);

  let hash = poolTip;

  // loop back `height` blocks and check that everything is OK
  for (; tail > 0; tail -= 1) {
    logger.info(`Checking block ${hash}`);

    // check block is correct
    const truth = await rpc.blockAsync(hash);
    const ours = await BlockModel.find({ hash });
    expect(ours.length, 'number of blocks').to.equal(1);
    expect(ours[0].previousBlockHash, 'previous block hash').to.equal(truth.previousblockhash);
    expect(ours[0].nextBlockHash, 'next block hash').to.equal(truth.nextblockhash);
    expect(ours[0].merkleRoot, 'merkle root').to.equal(truth.merkleroot);
    expect(ours[0].height, 'block height').to.equal(truth.height);

    // check that we got all transactions
    for (const txid of truth.tx) {
      logger.info(` - transaction ${txid}`);
      const tx = await TransactionModel.find({ txid });
      expect(tx.length, 'number of transactions').to.equal(1);
      expect(tx[0].blockHash, 'block hash of transaction').to.equal(hash);
      expect(tx[0].blockHeight, 'block height of transaction').to.equal(truth.height);
    }

    // check we have no extra transactions
    const extra = await TransactionModel.find({
      blockHash: hash,
      txid: {
        $nin: truth.tx
      },
    });
    expect(extra.length, 'number of extra transactions').to.equal(0);

    // move on to the next hash
    hash = ours[0].previousBlockHash;
  }
}
