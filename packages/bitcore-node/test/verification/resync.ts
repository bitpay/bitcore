import { Config } from '../../src/services/config';
import { Storage } from '../../src/services/storage';
import { VerificationPeer } from '../../src/modules/bitcoin/VerificationPeer';

(async () => {
  const { CHAIN: chain, NETWORK: network, START, END } = process.env;
  if (!chain || !network || !START || !END) {
    console.log('CHAIN, NETWORK, START, and END are required env variables');
    process.exit(1);
  } else {
    await Storage.start();
    const chainConfig = Config.chainConfig({ chain, network });
    const worker = new VerificationPeer({ chain, network, chainConfig });
    await worker.connect();

    await worker.resync(Number(START), Number(END));

    process.exit(0);
  }
})();
