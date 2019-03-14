#!/usr/bin/env node
import fs from 'fs';
import { Transform } from 'stream';
import { CoinStorage } from '../../src/models/coin';
import { Storage } from '../../src/services/storage';
import { P2pWorker } from '../../src/services/p2p';
import { Config } from '../../src/services/config';
import { BlockStorage } from '../../src/models/block';
import { validateDataForBlock } from './db-verify';
import { TransactionStorage } from '../../src/models/transaction';

(async () => {
  const { CHAIN, NETWORK, FILE, DRYRUN } = process.env;
  if (!CHAIN || !NETWORK || !FILE) {
    console.log('CHAIN, NETWORK, and FILE env variable are required');
    process.exit(1);
  }
  const chain = CHAIN || '';
  const network = NETWORK || '';
  await Storage.start();
  const chainConfig = Config.chainConfig({ chain, network });
  const worker = new P2pWorker({ chain, network, chainConfig });
  await worker.connect();

  const handleRepair = async data => {
    switch (data.type) {
      case 'DUPE_TRANSACTION':
        {
          const tx = data.payload.tx;
          const dupeTxs = await TransactionStorage.collection
            .find({ chain: tx.chain, network: tx.network, txid: tx.txid })
            .sort({ blockHeight: -1 })
            .toArray();

          if (dupeTxs.length < 2) {
            console.log('No action required.', dupeTxs.length, 'transaction');
            return;
          }

          let toKeep = dupeTxs[0];
          const wouldBeDeleted = dupeTxs.filter(c => c._id != toKeep._id);

          if (DRYRUN) {
            console.log('WOULD DELETE');
            console.log(wouldBeDeleted);
          } else {
            console.log('Deleting', wouldBeDeleted.length, 'transactions');
            await TransactionStorage.collection.deleteMany({
              chain,
              network,
              _id: { $in: wouldBeDeleted.map(c => c._id) }
            });
          }
        }
        break;
      case 'DUPE_COIN':
        {
          const coin = data.payload.coin;
          const dupeCoins = await CoinStorage.collection
            .find({ chain, network, mintTxid: coin.mintTxid, mintIndex: coin.mintIndex })
            .sort({ _id: -1 })
            .toArray();

          if (dupeCoins.length < 2) {
            console.log('No action required.', dupeCoins.length, 'coin');
            return;
          }

          let toKeep = dupeCoins[0];
          const spentCoin = dupeCoins.find(c => c.spentHeight > toKeep.spentHeight);
          toKeep = spentCoin || toKeep;
          const wouldBeDeleted = dupeCoins.filter(c => c._id != toKeep._id);

          if (DRYRUN) {
            console.log('WOULD DELETE');
            console.log(wouldBeDeleted);
          } else {
            const { mintIndex, mintTxid } = toKeep;
            console.log('Deleting', wouldBeDeleted.length, 'coins');
            await CoinStorage.collection.deleteMany({
              chain,
              network,
              mintTxid,
              mintIndex,
              _id: { $in: wouldBeDeleted.map(c => c._id) }
            });
          }
        }
        break;
      case 'COIN_HEIGHT_MISMATCH':
      case 'MISSING_BLOCK':
      case 'MISSING_TX':
      case 'MISSING_COIN_FOR_TXID':
      case 'VALUE_MISMATCH':
      case 'NEG_FEE':
        const blockHeight = Number(data.payload.blockNum);
        const { success } = await validateDataForBlock(blockHeight);
        if (DRYRUN) {
          console.log('WOULD RESYNC BLOCKS', blockHeight, 'to', blockHeight + 1);
          console.log(data.payload);
        } else {
          if (!success) {
            console.log('Resyncing Blocks', blockHeight, 'to', blockHeight + 1);
            await worker.resync(blockHeight - 1, blockHeight + 1);
          } else {
            console.log('No errors found, repaired previously');
          }
        }
        break;
      case 'DUPE_BLOCKHEIGHT':
      case 'DUPE_BLOCKHASH':
        const dupeBlock = await BlockStorage.collection
          .find({ chain, network, height: data.payload.blockNum })
          .toArray();

        if (dupeBlock.length < 2) {
          console.log('No action required.', dupeBlock.length, 'block');
          return;
        }

        let toKeepBlock = dupeBlock[0];
        const processedBlock = dupeBlock.find(b => b.processed === true);
        toKeepBlock = processedBlock || toKeepBlock;
        const wouldBeDeletedBlock = dupeBlock.filter(c => c._id !== toKeepBlock._id);

        if (DRYRUN) {
          console.log('WOULD DELETE');
          console.log(wouldBeDeletedBlock);
        } else {
          console.log('Deleting', wouldBeDeletedBlock.length, 'block');
          await BlockStorage.collection.deleteMany({
            chain,
            network,
            _id: { $in: wouldBeDeletedBlock.map(c => c._id) }
          });
        }
        break;
      default:
        console.log('skipping');
    }
  };

  function getLinesFromChunk(chunk) {
    return chunk.toString().split('\n');
  }

  async function repairLineIfValidJson(line: string) {
    const dataStr = line.trim();
    if (dataStr && dataStr.length > 2) {
      if (dataStr.startsWith('{') && dataStr.endsWith('}')) {
        try {
          const parsedData = JSON.parse(line);
          console.log('Inspecting...');
          console.log(dataStr);
          await handleRepair(parsedData);
        } catch (err) {}
      }
    }
  }

  async function transformFileChunks(chunk, _, cb) {
    for (let line of getLinesFromChunk(chunk)) {
      await repairLineIfValidJson(line);
    }
    cb();
  }

  const getFileContents = FILE => {
    fs.createReadStream(FILE)
      .pipe(
        new Transform({
          write: transformFileChunks
        })
      )
      .on('end', () => {
        process.exit(0);
      })
      .on('finish', () => {
        process.exit(0);
      });
  };

  getFileContents(FILE);
})();
