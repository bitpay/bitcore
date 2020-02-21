#!/usr/bin/env node
import { expect } from 'chai';
import config from '../../src/config';
import logger from '../../src/logger';
import { BitcoinBlockStorage, IBtcBlock } from '../../src/models/block';
import { CoinStorage } from '../../src/models/coin';
import { IBtcTransaction, TransactionStorage } from '../../src/models/transaction';
import { WalletAddressStorage } from '../../src/models/walletAddress';
import { ChainStateProvider } from '../../src/providers/chain-state';
import { AsyncRPC } from '../../src/rpc';
import { Storage } from '../../src/services/storage';
import { ChainNetwork } from '../../src/types/ChainNetwork';

const SATOSHI = 100000000.0;

export async function blocks(
  info: ChainNetwork,
  creds: {
    username: string;
    password: string;
    host: string;
    port: number;
  }
) {
  const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);
  const tip = await ChainStateProvider.getLocalTip({ chain: info.chain, network: info.network });
  const heights = new Array(tip!.height).fill(false);
  const times = new Array(tip!.height).fill(0);
  const normalizedTimes = new Array(tip!.height).fill(0);

  // check each block
  const cursor = BitcoinBlockStorage.collection.find({
    chain: info.chain,
    network: info.network
  });

  while (await cursor.hasNext()) {
    const block: IBtcBlock | null = await cursor.next();
    if (!block) break;
    if (!block.processed) continue;
    logger.info(`verifying block ${block.hash}: ${block.height}`);

    // Check there's all unique heights
    expect(block.height, 'block height').to.be.gte(1);
    expect(block.height, 'block height').to.be.lte(tip!.height);
    expect(heights[block.height - 1], 'height already used').to.be.false;
    heights[block.height - 1] = true;

    // Check times are increasing
    times[block.height - 1] = block.time.getTime();
    normalizedTimes[block.height - 1] = block.timeNormalized.getTime();

    const truth = await rpc.verbose_block(block.hash);
    expect(block.height, 'block height').to.equal(truth.height);
    expect(block.hash, 'block hash').to.equal(truth.hash);
    expect(block.version, 'block version').to.equal(truth.version);
    expect(block.merkleRoot, 'block merkle root').to.equal(truth.merkleroot);
    expect(block.nonce, 'block nonce').to.equal(truth.nonce);
    expect(block.previousBlockHash, 'block prev hash').to.equal(truth.previousblockhash);
    expect(block.transactionCount, 'block tx count').to.equal(truth.tx.length);
    if (info.network !== 'regtest') {
      expect(block.size, 'block size').to.equal(truth.size);
    }
    expect(block.bits.toString(16), 'block bits').to.equal(truth.bits);
    expect(block.processed, 'block processed').to.equal(true);
    expect(block.time.getTime(), 'block time').to.equal(truth.time * 1000);

    if (block.height < tip!.height) {
      expect(block.nextBlockHash, 'block next hash').to.equal(truth.nextblockhash);
    }

    // Transaction Specifics
    {
      const coinbase = truth.tx[0];

      // Check reward
      const reward = coinbase.vout.reduce((a, b) => a + b.value, 0);
      expect(block.reward, 'block reward').to.equal(Math.round(reward * SATOSHI));

      // Check block only has all `truth`'s transactions
      const ours = await TransactionStorage.collection
        .find({
          chain: info.chain,
          network: info.network,
          txid: {
            $in: truth.tx.map(tx => tx.txid)
          }
        })
        .project({
          txid: true,
          coinbase: true,
          blockHash: true,
          blockHeight: true,
          blockTime: true,
          blockTimeNormalized: true
        })
        .toArray();

      // Check coinbase flag
      const ourCoinbase = ours.filter(tx => tx.coinbase);
      expect(ourCoinbase.length, 'number of coinbases').to.equal(1);
      expect(ourCoinbase[0].txid, 'coinbase txid to match truth').to.equal(coinbase.txid);

      // Check both sets of txs are the same size and contain no duplicates
      const txidset = new Set(ours.map(tx => tx.txid));
      expect(ours.length, 'number of txs').to.equal(truth.tx.length);
      expect(txidset.size, 'number of unique txs').to.equal(truth.tx.length);

      for (const our of ours) {
        // Check every one of our txs is contained in `truth`
        const tx = truth.tx.find(tx => tx.txid === our.txid);
        expect(tx, 'tx to be in the block').to.not.be.undefined;
        // Check our txs' block hash matches the mongo block
        expect(our.blockHash, 'tx block hash').to.equal(block.hash);
        expect(our.blockHeight, 'tx block height').to.equal(block.height);

        const time = our.blockTime && our.blockTime.getTime();
        expect(time, 'tx block time').to.equal(block.time.getTime());

        const ntime = our.blockTimeNormalized && our.blockTimeNormalized.getTime();
        expect(ntime, 'tx block time normalized').to.equal(block.timeNormalized.getTime());
      }

      // Check no other tx points to our block hash
      const extra = await TransactionStorage.collection.countDocuments({
        chain: info.chain,
        network: info.network,
        blockHash: block.hash,
        txid: {
          $nin: truth.tx.map(tx => tx.txid)
        }
      });
      expect(extra, 'number of extra transactions').to.equal(0);
    }
  }

  // Check the heights are all unique
  expect(heights.filter(h => !h).length, 'no duplicate heights').to.equal(0);

  // Check increasing times
  const increases = l => !!l.reduce((prev, curr) => (prev < curr ? curr : undefined));
  expect(increases(normalizedTimes), 'normalized block times only increase').to.be.true;
}

export async function transactions(
  info: ChainNetwork,
  creds: {
    username: string;
    password: string;
    host: string;
    port: number;
  }
) {
  const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

  const txcursor = TransactionStorage.collection.find({
    chain: info.chain,
    network: info.network
  });

  while (await txcursor.hasNext()) {
    const tx: IBtcTransaction | null = await txcursor.next();
    if (!tx) {
      break;
    }
    logger.info(`verifying tx ${tx.txid}: ${tx.blockHeight}`);
    const truth = await rpc.transaction(tx.txid, tx.blockHash);

    if (info.network !== 'regtest') {
      expect(tx.size, 'tx size').to.equal(truth.size);
    }
    expect(tx.locktime, 'tx locktime').to.equal(truth.locktime);

    {
      // Minted by this transaction
      const ours = await CoinStorage.collection
        .find({
          network: info.network,
          chain: info.chain,
          mintTxid: tx.txid
        })
        .toArray();
      expect(ours.length, 'number mint txids').to.equal(truth.vout.length);
      for (const our of ours) {
        // coins
        expect(our.mintHeight, 'tx mint height').to.equal(tx.blockHeight);
        expect(our.value, 'tx mint value').to.equal(Math.round(truth.vout[our.mintIndex].value * SATOSHI));
        // TODO: why?
        if (our.address && our.address !== 'false') {
          expect(truth.vout[our.mintIndex].scriptPubKey.addresses, 'tx mint address').to.include(our.address);
        }
        expect(our.coinbase).to.equal(tx.coinbase);

        // wallets
        expect(tx.wallets).to.include.members(Array.from(our.wallets));
        if (our.wallets.length > 0) {
          const wallets = await WalletAddressStorage.collection
            .find({
              wallet: {
                $in: our.wallets
              },
              address: our.address,
              chain: info.chain,
              network: info.network
            })
            .toArray();
          expect(wallets.length, 'wallet exists').to.be.greaterThan(0);
        }
      }
    }

    {
      // Spent by this transaction
      const ours = await CoinStorage.collection
        .find({
          network: info.network,
          chain: info.chain,
          spentTxid: tx.txid
        })
        .toArray();
      const nspent = truth.vin.length + (tx.coinbase ? -1 : 0);
      expect(ours.length, 'number spent txids').to.equal(nspent);
      for (const our of ours) {
        expect(our.spentHeight, 'tx spent height').to.equal(tx.blockHeight);
        expect(tx.wallets).to.include.members(Array.from(our.wallets));
      }
    }
  }
}

if (require.main === module)
  (async () => {
    const info = {
      chain: process.env.CHAIN || 'BTC',
      network: process.env.NETWORK || 'testnet'
    };
    const creds = config.chains[info.chain][info.network].rpc;

    await Storage.start({});
    logger.info('verifying blocks');
    await blocks(info, creds);
    logger.info('verifying transactions');
    await transactions(info, creds);
    process.exit();
  })().catch(err => {
    logger.error(err);
    process.exit(1);
  });
