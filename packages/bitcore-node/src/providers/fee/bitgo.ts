import request from 'request';
import util from 'util';
import logger from '../../logger';
import { NetworkType } from '../../types/ChainNetwork';
import { IFeeProvider } from '../../types/FeeProvider';

export class BitgoClass implements IFeeProvider {
  private feeUrls = {
    mainnet: 'https://www.bitgo.com/api/v2/btc/tx/fee',
    testnet: 'https://www.bitgo-test.com/api/v2/tbtc/tx/fee'
  };

  public async getFee(network: NetworkType, nblocks: number): Promise<number> {
    try {
      network = network === 'regtest' ? 'testnet' : network;
      nblocks = Math.min(Math.max(nblocks, 2), 1000); // min 2, max 1000

      const res = await util.promisify(request.get).call(request, {
        uri: `${this.feeUrls[network]}?numBlocks=${nblocks}`,
        json: true
      });
      if (res.statusCode !== 200) {
        throw new Error(`Status code: ${res.statusCode}`);
      }
      const fee = res.body;
      return fee.feePerKb / 1000; // convert to sats/B
    } catch (err: any) {
      logger.warn('Error getting fee from bitgo: %o', err.message || err);
      throw err;
    }
  };
};

export const Bitgo = new BitgoClass();
