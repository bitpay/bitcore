import { BlockModel, IBlock } from "../../src/models/block";
import { AsyncRPC } from '../../src/rpc';
import { expect } from 'chai';
import { TransactionModel, ITransaction } from "../../src/models/transaction";
import { CoinModel } from "../../src/models/coin";
import { ChainNetwork } from "../../src/types/ChainNetwork";
import { WalletAddressModel } from "../../src/models/walletAddress";


export async function blocks(info: ChainNetwork, creds: {
  username: string;
  password: string;
  host: string;
  port: number;
}) {
  const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);
  const tip = await BlockModel.getLocalTip(info);
  const heights = new Array(tip.height).fill(false);
  const times = new Array(tip.height).fill(0);
  const normalizedTimes = new Array(tip.height).fill(0);

  // check each block
  await new Promise(resolve => {
    const cursor = BlockModel.find({
      chain: info.chain,
      network: info.network,
    }).cursor();
    cursor.on('data', async (block: IBlock) => {
      const truth = await rpc.verbose_block(block.hash);
      const expectations: [string, any][] = [
        ['height', truth.height],
        ['hash', truth.hash],
        ['version', truth.version],
        ['merkleRoot', truth.merkleroot],
        ['nonce', truth.nonce],
        ['previousBlockHash', truth.previousblockhash],
        ['nextBlockHash', truth.nextblockhash],
        ['transactionCount', truth.tx.length],
        ['size', truth.size],
        ['bits', truth.bits],
        ['processed', true],
      ];

      // Check basic properties
      for (const [ours, theirs] of expectations) {
        expect(block[ours], `block ${ours}`).to.equal(theirs);
      }

      // Check there's all unique heights
      expect(block.height, 'block height').to.be.gte(1);
      expect(block.height, 'block height').to.be.lte(tip.height);
      expect(heights[block.height - 1], 'height already used').to.be.false;
      heights[block.height - 1] = true;

      // Check times are increasing
      times[block.height - 1] = block.time;
      normalizedTimes[block.height - 1] = block.timeNormalized;

      // Transaction Specifics
      {
        const coinbase = truth.tx[0];

        // Check reward
        expect(block.reward, 'block reward').to.equal(coinbase.vout[0].value);

        // Check block only has all `truth`'s transactions
        const ours = await TransactionModel.find({
          chain: info.chain,
          network: info.network,
          txid: {
            $in: truth.tx,
          },
        }, {
          blockHash: true,
        });

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
          expect(our.blockTime, 'tx block time').to.equal(block.time);
          expect(our.blockTimeNormalized, 'tx block time normalized').to.equal(block.timeNormalized);
        }

        // Check no other tx points to our block hash
        const extra = await TransactionModel.find({
          chain: info.chain,
          network: info.network,
          blockHash: block.hash,
          txid: {
            $nin: truth.tx
          },
        });
        expect(extra.length, 'number of extra transactions').to.equal(0);
      }
    });
    cursor.on('end', resolve);
  });

  // Check the heights are all unique
  expect(heights.filter(h => !h).length).to.equal(0);
  expect(heights.length).to.equal(tip.height);

  // Check increasing times
  const increases = l => !!l.reduce((prev, curr) => prev < curr? curr : undefined);
  expect(increases(times), 'block times only increase').to.be.true;
  expect(increases(normalizedTimes), 'normalized block times only increase').to.be.true;
}

export async function transactions(info: ChainNetwork, creds: {
  username: string;
  password: string;
  host: string;
  port: number;
}) {
  const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

  // check each transaction
  await new Promise(resolve => {
    const cursor = TransactionModel.find({
      chain: info.chain,
      network: info.network,
    }).cursor();
    cursor.on('data', async (tx: ITransaction) => {
      const truth = await rpc.transaction(tx.txid, tx.blockHash);

      expect(tx.size, 'tx size').to.equal(truth.size);
      expect(tx.locktime, 'tx locktime').to.equal(truth.locktime);

      { // Minted by this transaction
        const ours = await CoinModel.find({
          network: info.network,
          chain: info.chain,
          mintTxid: tx.txid,
        });
        expect(ours.length, 'number mint txids').to.equal(truth.vout.length);
        for (const our of ours) {
          // coins
          expect(our.mintTxid, 'tx mint height').to.equal(tx.blockHeight);
          expect(our.value, 'tx mint value').to.equal(
            truth.vout[our.mintIndex].value
          );
          expect(truth.vout[our.mintIndex].scriptPubKey.addresses,
                 'tx mint address').to.include(our.address);
          expect(our.mintIndex === 0 && our.coinbase
                 || our.mintIndex !== 0 && !our.coinbase).to.be.true;

          // wallets
          expect(tx.wallets).to.include.members(our.wallets);
          if (our.wallets.length > 0) {
            const wallets = await WalletAddressModel.find({
              wallet: {
                $in: our.wallets,
              },
              address: our.address,
              chain: info.chain,
              network: info.network,
            });
            expect(wallets.length, 'wallet exists').to.be.greaterThan(0);
          }
        }
      }

      { // Spent by this transaction
        const ours = await CoinModel.find({
          network: info.network,
          chain: info.chain,
          spentTxid: tx.txid,
        });
        expect(ours.length, 'number spent txids').to.equal(truth.vin.length);
        for (const our of ours) {
          expect(our.spentTxid, 'tx spent height').to.equal(tx.blockHeight);
          expect(tx.wallets).to.include.members(our.wallets);
        }
      }
    });
    cursor.on('end', resolve);
  });
}
