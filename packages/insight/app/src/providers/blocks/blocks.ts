import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { ApiProvider } from '../../providers/api/api';
import { Observable } from 'rxjs/Observable';
import { CurrencyProvider } from '../../providers/currency/currency';

/*
  Generated class for the BlocksProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/

export type ApiBlock = {
  height: number;
  nonce: number;
  bits: number;
  size: number;
  hash: string;
  merkleRoot: string;
  nextBlockHash: string;
  previousBlockHash: string;
  transactionCount: number;
  reward: number;
  minedBy: string;
  version: number;
  time: Date;
  timeNormalized: Date;
};

export type AppBlock = {
  height: number;
  merkleroot: string;
  nonce: number;
  size: number;
  confirmations: number;
  version: number;
  difficulty: number;
  bits: string;
  virtualSize: number;
  hash: string;
  time: number;
  tx: {
    length: number;
  };
  txlength: number;
  previousblockhash: string;
  nextblockhash: string;
  poolInfo: {
    poolName: string;
    url: string;
  };
  reward: number;
};

@Injectable()
export class BlocksProvider {
  constructor(public http: Http, private api: ApiProvider, public currency: CurrencyProvider) {}

  private toAppBlock(block: ApiBlock, bestHeight: number): AppBlock {
    let difficulty: number = 0x1d00ffff / block.bits;
    return {
      height: block.height,
      confirmations: bestHeight - block.height,
      nonce: block.nonce,
      size: block.size,
      virtualSize: block.size,
      merkleroot: block.merkleRoot,
      version: block.version,
      difficulty: difficulty,
      bits: block.bits.toString(16),
      hash: block.hash,
      time: new Date(block.time).getTime() / 1000,
      tx: {
        length: block.transactionCount
      },
      txlength: block.transactionCount,
      previousblockhash: block.previousBlockHash,
      nextblockhash: block.nextBlockHash,
      poolInfo: {
        poolName: block.minedBy,
        url: ''
      },
      reward: block.reward / 10 ** 8
    };
  }

  public getCurrentHeight(): Observable<number> {
    let heightUrl: string = this.api.apiPrefix + '/block/tip';
    return this.http.get(heightUrl).map(blockResp => {
      const block: ApiBlock = blockResp.json();
      return block.height;
    });
  }

  public getBlocks(numBlocks: number = 10): Observable<{ blocks: Array<AppBlock> }> {
    let url: string = this.api.apiPrefix + '/block?limit=' + numBlocks;
    return this.getCurrentHeight().flatMap(height => {
      return this.http.get(url).map(data => {
        let blocks: Array<ApiBlock> = data.json();
        let appBlocks: Array<AppBlock> = blocks.map(block => this.toAppBlock(block, height));
        return { blocks: appBlocks };
      });
    });
  }

  /**
   * example: http://localhost:8100/api/BTC/regtest/block?since=582&limit=100&paging=height&direction=1
   */
  public pageBlocks(since: number, numBlocks: number = 10): Observable<{ blocks: Array<AppBlock> }> {
    let url: string = `${this.api.apiPrefix}/block?since=${since}&limit=${numBlocks}&paging=height&direction=-1`;
    return this.getCurrentHeight().flatMap(height => {
      return this.http.get(url).map(data => {
        let blocks: Array<ApiBlock> = data.json();
        let appBlocks: Array<AppBlock> = blocks.map(block => this.toAppBlock(block, height));
        return { blocks: appBlocks };
      });
    });
  }

  public getBlock(hash: string): Observable<{ block: AppBlock }> {
    let url: string = this.api.apiPrefix + '/block/' + hash;
    return this.getCurrentHeight().flatMap(height => {
      return this.http.get(url).map(data => {
        let block: ApiBlock = data.json();
        let appBlock: AppBlock = this.toAppBlock(block, height);
        return { block: appBlock };
      });
    });
  }
}
