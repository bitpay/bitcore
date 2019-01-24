#!/usr/bin/env node
import fs from 'fs';
import { Transform } from 'stream';
import { CoinStorage } from '../../src/models/coin';
import { Storage } from '../../src/services/storage';
(async () => {
  const { CHAIN, NETWORK, FILE, DRYRUN } = process.env;
  if (!CHAIN || !NETWORK || !FILE) {
    console.log('CHAIN, NETWORK, and FILE env variable are required');
    process.exit(1);
  }

  const chain = CHAIN;
  const network = NETWORK;
  await Storage.start();
  const handleRepair = async data => {
    switch (data.type) {
      case 'DUPE_COIN':
        const dupeCoins = await CoinStorage.collection
          .find({ chain, network, mintTxid: data.payload.mintTxid, mintIndex: data.payload.mintIndex })
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
        } catch (err) {
          //console.log(err);
        }
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

  //type: 'DUPE_BLOCKHASH'
  //type: 'NEG_FEE'
  //type: 'DUPE_COIN'
  //type: 'MISSING_COIN_FOR_TXID'
  //type: 'MISSING_TX'
  //type: 'VALUE_MISMATCH'
  //type: 'DUPE_BLOCKHEIGHT'
  //
  // will need to handle each of those error types
})();
