#!/usr/bin/env node
import fs from 'fs';
import { CoinStorage } from '../../src/models/coin';
import { Storage } from '../../src/services/storage';
import parseArgv from '../../src/utils/parseArgv';
const args = parseArgv([], ['DRYRUN']);
(async () => {
  const { CHAIN, NETWORK, FILE } = process.env;
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

        let toKeep = dupeCoins[0];
        const spentCoin = dupeCoins.find(c => c.spentHeight > toKeep.spentHeight);
        toKeep = spentCoin || toKeep;

        if (dupeCoins.length > 1) {
          if (args.DRYRUN) {
            console.log('WOULD DELETE');
            const wouldBeDeleted = dupeCoins.filter(c => c._id != toKeep._id);
            console.log(wouldBeDeleted);
          } else {
            const { mintIndex, mintTxid } = toKeep;
            CoinStorage.collection.deleteMany({ chain, network, mintTxid, mintIndex, _id: { $ne: toKeep._id } });
          }
        } else {
          console.log(toKeep.mintTxid, toKeep.mintIndex, 'only saw', dupeCoins.length);
        }
        break;
      default:
        console.log('done');
    }
  };

  const getFileContents = FILE => {
    fs.createReadStream(FILE).on('data', data => {
      const dataStr = data.toString();
      if (dataStr.startsWith('{') && dataStr.endsWith('}')) {
        const parsedData = JSON.parse(data);
        handleRepair(parsedData);
      }
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
