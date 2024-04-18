import request from 'request';
import util from 'util';
import logger from '../../logger';
import { NetworkType } from '../../types/ChainNetwork';
import { FeeCacheType, IFeeProvider } from '../../types/FeeProvider';

export class BlockCypherClass implements IFeeProvider {
  private feeUrls = {
    mainnet: 'https://api.blockcypher.com/v1/btc/main',
    testnet: 'https://api.blockcypher.com/v1/btc/test3'
  };

  private cache: {
    mainnet: FeeCacheType;
    testnet: FeeCacheType
  } = {
    mainnet: {
      timestamp: 0,
      response: null
    },
    testnet: {
      timestamp: 0,
      response: null
    }
  };

  public async getFee(network: NetworkType, nblocks: number): Promise<number> {
    try {
      network = network === 'regtest' ? 'testnet' : network;

      // blockcypher rate limits to 3 req/s or 100 req/hr, so cache for 1.5 minutes
      if (this.cache[network] && this.cache[network].timestamp > Date.now() - 1000 * 90) {
        return this._getFeeLevel(this.cache[network].response, nblocks);
      }

      const res = await util.promisify(request.get).call(request, {
        uri: this.feeUrls[network],
        json: true
      });
      if (res.statusCode !== 200) {
        throw new Error(`Status code: ${res.statusCode}`);
      }
      const fee = res.body;
      this.cache[network] = {
        timestamp: Date.now(),
        response: fee
      };
      return this._getFeeLevel(fee, nblocks);
    } catch (err: any) {
      logger.warn('Error getting fee from blockcypher: %o', err.message || err);
      throw err;
    }
  };

  /**
   * Return the appropriate fee level for nblocks per the ref.
   * REF: https://www.blockcypher.com/dev/bitcoin/#blockchain
   * @param response 
   * @param nblocks 
   * @returns 
   */
  private _getFeeLevel(response, nblocks: number): number {
    if (nblocks <= 2) {
      return response.high_fee_per_kb / 1000;
    } else if (nblocks <= 6) {
      return response.medium_fee_per_kb / 1000;
    } else {
      return response.low_fee_per_kb / 1000;
    }
  };
};

export const BlockCypher = new BlockCypherClass();
