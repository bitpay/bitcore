#!/usr/bin/env node

import * as _ from 'lodash';
import { BitcoinBlockStorage } from '../../src/models/block';
import { Modules } from '../../src/modules';
import { Config } from '../../src/services/config';
import { Storage } from '../../src/services/storage';
import { IVerificationPeer, Verification } from '../../src/services/verification';

if (require.main === module) {
  (async () => {
    const { CHAIN = '', NETWORK = '', HEIGHT, VERIFYSPENDS } = process.env;
    const resumeHeight = Number(HEIGHT) || 1;
    const chain = CHAIN || '';
    const network = NETWORK || '';

    Modules.loadConfigured();
    const chainConfig = Config.chainConfig({ chain, network });

    let worker: IVerificationPeer;
    if (Verification.get(CHAIN)) {
      const workerClass = Verification.get(CHAIN);
      worker = new workerClass({ chain, network, chainConfig });
      worker.connect();
      if (VERIFYSPENDS) {
        worker.enableDeepScan();
      }

      await Storage.start();
      if (!chain || !network) {
        console.log('Please provide a CHAIN and NETWORK environment variable');
        process.exit(1);
      }
      const tip = await BitcoinBlockStorage.getLocalTip({ chain, network });

      if (tip) {
        for (let i = resumeHeight; i <= tip.height; i++) {
          const { success } = await worker.validateDataForBlock(i, tip.height, true);
          console.log({ block: i, success });
        }
      }
    }
    process.exit(0);
  })();
}
