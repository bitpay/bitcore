import { CryptoRpc } from 'crypto-rpc';
import * as elasticsearch from 'elasticsearch';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { Config } from './config';
const wait = util.promisify(setTimeout);

export class ElasticSync {
  client: elasticsearch.Client;
  rpc: any;
  operations: Array<elasticsearch.BulkIndexDocumentsParams['body']> = [];
  indexes = { block: '', tx: '' };

  constructor(public configs: Config) {
    this.client = new elasticsearch.Client({
      host: `${this.configs.elasticHost}:${this.configs.elasticPort}`,
      log: this.configs.elasticLogLevel,
      apiVersion: this.configs.elasticVersion, // use the same version of your Elasticsearch instance
      requestTimeout: 1000 * 60 * 60,
      keepAlive: false,
      deadTimeout: 6000000,
      maxRetries: 15
    });
    this.rpc = new CryptoRpc(this.configs, {});

    const { chain, network } = this.configs;
    this.indexes = {
      block: `${chain}-${network}-block`.toLowerCase(),
      tx: `${chain}-${network}-transaction`.toLowerCase()
    };
  }

  async isConnected() {
    try {
      await this.client.ping({});
      return true;
    } catch (e) {
      return false;
    }
  }

  async connect() {
    const minute = 60 * 1000;
    let connected = await this.isConnected();
    while (!connected) {
      await wait(minute);
    }
  }

  async getCurrentHeight() {
    try {
      const results = await this.client.search<{ height: number }>({
        index: this.indexes.block,
        body: { query: { match_all: {} }, sort: [{ height: 'desc' }], size: 1 }
      });
      const data = results.hits.hits;
      return data.length ? data[0].fields.height : 0;
    } catch (e) {
      return 0;
    }
  }

  async getBestBlock() {
    const { chain, network } = this.configs;
    let bestBlock = await this.rpc.getTip({ currency: chain, network });
    return bestBlock;
  }

  async getBestBlockHeight() {
    const { chain, network } = this.configs;
    let bestBlock = await this.rpc.getTip({ currency: chain, network });
    return bestBlock.height;
  }

  async getHashForBlockNum(height: number) {
    const { chain } = this.configs;
    return this.rpc.get(chain).asyncCall('getBlockHash', [height]);
  }

  async getBlock(params: { height: number; hash?: string }) {
    let { height, hash } = params;
    const { chain } = this.configs;
    hash = hash || (await this.getHashForBlockNum(height));
    const block = await this.rpc.get(chain).asyncCall('getBlock', [hash, 2]);
    return block;
  }

  async sync() {
    const { chain, network } = this.configs;
    let currentHeight = await this.getCurrentHeight();
    let nextHash = '';
    let bestBlock = await this.getBestBlock();
    let bestHeight = bestBlock.height;
    console.log('Starting sync for', chain, network, 'at height', currentHeight, 'til', bestHeight);
    while (currentHeight < bestHeight) {
      try {
        const block = await this.getBlock({ height: currentHeight + 1, hash: nextHash });
        await this.processBlock(block);
        nextHash = block.nextBlockHash;
        currentHeight++;
        if (block.height === bestHeight) {
          bestHeight = await this.getBestBlockHeight();
        }
      } catch (e) {
        console.error(e);
      }
    }
    await this.finish();
  }

  transformBlock(block) {
    delete block.tx;
    block.date = new Date(block.mediantime * 1000);
    return block;
  }

  transformTxs(txs, _block?: any) {
    for (const tx of txs) {
      delete tx.vin;
      delete tx.vout;
      delete tx.hex;
    }
    return txs;
  }

  async processBlock(block) {
    const txs = block.tx || [];
    const transformed = this.transformBlock(block);
    this.operations.push({ index: { _index: this.indexes.block, _type: 'block' } });
    this.operations.push({
      index: {
        type: 'block',
        index: this.indexes.block,
        body: transformed
      }
    });

    const transformedTxs = this.transformTxs(txs, block);
    transformedTxs.forEach(tx => {
      this.operations.push({ index: { _index: this.indexes.tx, _type: 'transaction' } });
      this.operations.push({
        index: {
          type: 'transaction',
          index: this.indexes.tx,
          body: tx
        }
      });
    });

    if (this.operations.length > 50000) {
      console.log('Flushing for block', block.height);
      await this.flush();
    }
  }

  async flush() {
    console.time('Flushing');
    console.log('Flushing', this.operations.length, 'operations');
    await this.client.bulk({ body: this.operations });
    console.timeEnd('Flushing');
    console.log('Flushed', this.operations.length, 'operations');
    this.operations = [];
  }

  async finish() {
    await this.flush();
    await this.client.close();
  }
}

if (require.main === module) {
  async function main() {
    let config;
    const defaultPath = path.join(__dirname, '../config.js');
    const defaultExists = fs.existsSync(defaultPath);
    console.log('Default Path for Config', defaultPath);
    if (process.env.CONFIG_PATH) {
      config = require(process.env.CONFIG_PATH);
    } else if (defaultExists) {
      // check default location
      config = require('../config.js');
    }

    if (!config) {
      throw new Error('Please provide a CONFIG_PATH env variable with the path of a valid config file');
    }

    const elastic = new ElasticSync(config);
    await elastic.connect();
    await elastic.sync();
  }
  main();
}
