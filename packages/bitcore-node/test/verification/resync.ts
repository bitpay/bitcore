import { Config } from '../../src/services/config';
import { Storage } from '../../src/services/storage';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';

(async () => {
  const { CHAIN: chain, NETWORK: network, START, END } = process.env;
  if (!chain || !network || !START || !END) {
    console.log('CHAIN, NETWORK, START, and END are required env variables');
    process.exit(1);
  } else {
    await Storage.start();
    const chainConfig = Config.chainConfig({ chain, network });
    const worker = new BitcoinP2PWorker({ chain, network, chainConfig });
    await worker.connect();

    await worker.resync(Number(START), Number(END));

    process.exit(0);
  }
})();
