import request = require('request');

import { LoggifyClass } from './decorators/Loggify';
type CallbackType = (err: any, data?: any) => any;

@LoggifyClass
export class RPC {
  constructor(
    private username: string,
    private password: string,
    private host: string,
    private port: number
  ) {}

  public callMethod(method: string, params: any, callback: CallbackType) {
    request(
      {
        method: 'POST',
        url: `http://${this.username}:${this.password}@${this.host}:${
          this.port
        }`,
        body: {
          jsonrpc: '1.0',
          id: Date.now(),
          method: method,
          params: params
        },
        json: true
      },
      function(err, res) {
        const {body} = res;
        if (err) {
          return callback(err);
        }
        if (body && body.error) {
          return callback(body.error);
        }
        callback(null, body && body.result);
      }
    );
  }

  async asyncCall(method: string, params: any[]) {
    return new Promise((resolve, reject) => {
      this.callMethod(method, params, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  }

  getChainTip(callback: CallbackType) {
    this.callMethod('getchaintips', [], function(err, result) {
      if (err) {
        return callback(err);
      }
      callback(null, result[0]);
    });
  }

  getBestBlockHash(callback: CallbackType) {
    this.callMethod('getbestblockhash', [], callback);
  }

  getBlockHeight(callback: CallbackType) {
    this.callMethod('getblockcount', [], callback);
  }

  getBlock(hash: string, verbose: boolean, callback: CallbackType) {
    this.callMethod('getblock', [hash, verbose], callback);
  }

  getBlockHash(height: number, callback: CallbackType) {
    this.callMethod('getblockhash', [height], callback);
  }

  getBlockByHeight(height: number, callback: CallbackType) {
    var self = this;
    self.getBlockHash(height, function(err, hash) {
      if (err) {
        return callback(err);
      }
      self.getBlock(hash, false, callback);
    });
  }

  getTransaction(txid: string, callback: CallbackType) {
    var self = this;
    self.callMethod('getrawtransaction', [txid, true], function(err, result) {
      if (err) {
        return callback(err);
      }
      callback(null, result);
    });
  }

  sendTransaction(rawTx: string, callback: CallbackType) {
    var self = this;
    self.callMethod('sendrawtransaction', [rawTx], callback);
  }

  decodeScript(hex: string, callback: CallbackType) {
    this.callMethod('decodescript', [hex], callback);
  }

  getWalletAddresses(account: string, callback: CallbackType) {
    this.callMethod('getaddressesbyaccount', [account], callback);
  }

  async generate(n: number): Promise<string[]> {
    return await this.asyncCall('generate', [n]) as string[];
  }

  async bestBlockHashAsync(): Promise<string> {
    return await this.asyncCall('getbestblockhash', []) as string;
  }

  async blockAsync(hash: string): Promise<any> {
    return await this.asyncCall('getblock', [hash]);
  }

  async getEstimateSmartFee(target: number) {
    return this.asyncCall('estimatesmartfee', [target]);
  }

}
