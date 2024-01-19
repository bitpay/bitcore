import request from 'request';
import util from 'util';
import logger from '../../logger';
import { NetworkType } from '../../types/ChainNetwork';
import { FeeCacheType, IFeeProvider } from '../../types/FeeProvider';


export class MempoolSpaceClass implements IFeeProvider {
  // TODO run our own mempool.space server
  private feeUrls = {
    mainnet: 'https://mempool.space/api/v1/fees/recommended',
    testnet: 'https://mempool.space/testnet/api/v1/fees/recommended'
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

  private cacheTime = 1000 * 90; // 90 seconds

  public async getFee(network: NetworkType, nblocks: number): Promise<number> {
    network = network === 'regtest' ? 'testnet' : network;
    
    if (this.cache[network] && this.cache[network].timestamp > Date.now() - this.cacheTime) {
      return this._getFeeLevel(this.cache[network].response, nblocks);
    }

    try {
      const res = await util.promisify(request.get).call(request, {
        uri: this.feeUrls[network],
        json: true
      });
      if (res.statusCode !== 200) {
        if (res.statusCode === 429) {
          this.cacheTime += 1000 * 30; // add 30 seconds
        }  
        throw new Error(`Status code: ${res.statusCode}`);
      }
      const fee = res.body;
      this.cache[network] = {
        timestamp: Date.now(),
        response: fee
      };
      return this._getFeeLevel(fee, nblocks);
    } catch (err: any) {
      logger.warn('Error getting fee from mempool.space: %o', err.message || err);
      throw err;
    }
  }

  private _getFeeLevel(response, nblocks: number): number {
    const avgBlockTime = nblocks * 10; // 10 minutes per block on avg
    if (avgBlockTime <= 10) { // 0 or 1 block
      return response.fastestFee;
    } else if (avgBlockTime <= 30) {
      return response.halfHourFee;
    } else if (avgBlockTime <= 60) {
      return response.hourFee;
    } else if (avgBlockTime <= 60 * 24) { // one day
      return response.economyFee;
    } else {
      return response.minimumFee;
    }
  }
};

export const MempoolSpace = new MempoolSpaceClass();