#!/usr/bin/env node

import * as _ from 'lodash';
import { IBlock } from '../../src/models/baseBlock';
import { BitcoinBlockStorage } from '../../src/models/block';
import { Modules } from '../../src/modules';
import { Storage } from '../../src/services/storage';

if (require.main === module) {
  (async () => {
    const { CHAIN = '', NETWORK = '', HEIGHT } = process.env;
    const resumeHeight = Number(HEIGHT) || 1;
    const chain = CHAIN || '';
    const network = NETWORK || '';

    Modules.loadConfigured();
    await Storage.start();
    let prevMatch = true;
    let nextMatch = true;
    let previousBlock: IBlock | undefined;
    let checkHeight = resumeHeight;

    console.log('Verifying headers for', chain, network, 'from height', resumeHeight);
    await BitcoinBlockStorage.collection
      .find({ chain, network, processed: true, height: { $gte: checkHeight } })
      .project({ height: 1, nextBlockHash: 1, previousBlockHash: 1, hash: 1 })
      .sort({ height: 1 })
      .forEach(locatorBlock => {
        let success = true;
        if (checkHeight !== locatorBlock.height) {
          const error = {
            model: 'block',
            err: true,
            type: 'MISSING_BLOCK',
            payload: { blockNum: checkHeight }
          };
          console.log(JSON.stringify(error));
          success = false;
          checkHeight = locatorBlock.height;
        } else if (previousBlock) {
          prevMatch = prevMatch && locatorBlock.previousBlockHash === previousBlock.hash;
          nextMatch = nextMatch && locatorBlock.hash === previousBlock.nextBlockHash;
          if (!prevMatch || !nextMatch) {
            const error = {
              model: 'block',
              err: true,
              type: 'CORRUPTED_BLOCK',
              payload: { blockNum: locatorBlock.height }
            };
            console.log(JSON.stringify(error));
            success = false;
          }
        }

        previousBlock = locatorBlock;
        checkHeight++;
        if (success) {
          console.log({ block: checkHeight, success });
        }
      });
    process.exit(0);
  })();
}
