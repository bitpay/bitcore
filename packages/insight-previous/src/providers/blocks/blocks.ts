import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { Observable } from 'rxjs/Observable';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';

export interface ApiBlock {
  height: number;
  nonce: number;
  bits: number;
  size: number;
  confirmations: number;
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
}

export interface AppBlock {
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
}

@Injectable()
export class BlocksProvider {
  constructor(
    public http: Http,
    private api: ApiProvider,
    public currency: CurrencyProvider
  ) {}

  private toAppBlock(block: ApiBlock): AppBlock {
    const difficulty: number = 0x1d00ffff / block.bits;
    return {
      height: block.height,
      confirmations: block.confirmations,
      nonce: block.nonce,
      size: block.size,
      virtualSize: block.size,
      merkleroot: block.merkleRoot,
      version: block.version,
      difficulty,
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
      reward: block.reward
    };
  }

  public getCurrentHeight(): Observable<number> {
    const heightUrl: string = this.api.getUrl() + '/block/tip';
    return this.http.get(heightUrl).map(blockResp => {
      const block: ApiBlock = blockResp.json();
      return block.height;
    });
  }

  public getBlocks(numBlocks: number = 10): Observable<{ blocks: AppBlock[] }> {
    const url: string = this.api.getUrl() + '/block?limit=' + numBlocks;
    return this.http.get(url).map(data => {
      const blocks: ApiBlock[] = data.json();
      const appBlocks: AppBlock[] = blocks.map(block => this.toAppBlock(block));
      return { blocks: appBlocks };
    });
  }

  /**
   * example: http://localhost:8100/api/BTC/regtest/block?since=582&limit=100&paging=height&direction=1
   */
  public pageBlocks(
    since: number,
    numBlocks: number = 10
  ): Observable<{ blocks: AppBlock[] }> {
    const url = `${this.api.getUrl()}/block?since=${since}&limit=${numBlocks}&paging=height&direction=-1`;
    return this.http.get(url).map(data => {
      const blocks: ApiBlock[] = data.json();
      const appBlocks: AppBlock[] = blocks.map(block => this.toAppBlock(block));
      return { blocks: appBlocks };
    });
  }

  public getBlock(hash: string): Observable<{ block: AppBlock }> {
    const url: string = this.api.getUrl() + '/block/' + hash;
    return this.http.get(url).map(data => {
      const block: ApiBlock = data.json();
      const appBlock: AppBlock = this.toAppBlock(block);
      return { block: appBlock };
    });
  }
}
