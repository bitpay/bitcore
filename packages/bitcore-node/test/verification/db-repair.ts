#!/usr/bin/env node

import { Storage } from "../../src/services/storage";
(async () => {

const { CHAIN, NETWORK, FILE} = process.env;
await Storage.start();

// Read in each line from FILE as path

// for each line, JSON.parse
// with parsed object pass that into a reducer / switch
// for that type of object
//
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
