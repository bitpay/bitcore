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

  async getEstimateSmartFee(target: number) {
    return this.asyncCall('estimatesmartfee', [target]);
  }

}

@LoggifyClass
export class AsyncRPC {
  private rpc: RPC;

  constructor(
    username: string,
    password: string,
    host: string,
    port: number
  ) {
    this.rpc = new RPC(username, password, host, port);
  }

  async call(method: string, params: any[]) {
    return new Promise((resolve, reject) => {
      this.rpc.callMethod(method, params, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  }

  async block(hash: string): Promise<RPCBlock<string>> {
    return await this.call('getblock', [hash, 1]) as RPCBlock<string>;
  }

  async verbose_block(hash: string): Promise<RPCBlock<RPCTransaction>> {
    return await this.call('getblock', [hash, 2]) as RPCBlock<RPCTransaction>;
  }

  async generate(n: number): Promise<string[]> {
    return await this.call('generate', [n]) as string[];
  }

  async transaction(txid: string, block?: string): Promise<RPCTransaction> {
    const args = [txid, true];
    if (block) {
      args.push(block);
    }
    return await this.call('getrawtransaction', args) as RPCTransaction;
  }
}

export type RPCBlock<T> = {
  hash: string;
  confirmations: number;
  size: number;
  strippedsize: number;
  weight: number;
  height: number;
  version: number;
  versionHex: string;
  merkleroot: string;
  tx: T[];
  time: number;
  mediantime: number;
  nonce: number;
  bits: string;
  difficulty: number;
  chainwork: string;
  previousblockhash: string;
  nextblockhash: string;
};

export type RPCTransaction = {
  in_active_chain: boolean;
  hex: string;
  txid: string;
  hash: string;
  size: number;
  vsize: number;
  version: number;
  locktime: number;
  vin: {
    txid: string;
    vout: number;
    scriptSig: {
      asm: string;
      hex: string;
    };
    sequence: number;
    txinwitness: string[];
  }[];
  vout: {
    value: number;
    n: number;
    scriptPubKey: {
      asm: string;
      hex: string;
      reqSigs: number;
      type: string;
      addresses: string[];
    }
  }[];
  blockhash: string;
  confirmations: number;
  time: number;
  blocktime: number;
}
