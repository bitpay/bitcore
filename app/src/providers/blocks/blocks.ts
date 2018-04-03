import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { ApiProvider } from '../../providers/api/api';
import { Observable } from 'rxjs/Observable';

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
    size: number;
    version: number;
    difficulty: number;
    bits: string;
    virtualSize: number;
    hash: string;
    time: number;
    tx: {
        length: number
    },
    txlength: number;
    previousblockhash: string,
    nextblockhash: string,
    poolInfo: {
        poolName: string;
        url: string;
    },
    reward: number;
};

@Injectable()
export class BlocksProvider {

    constructor(public http: Http, private api: ApiProvider) {
    }

    private toAppBlock(block: ApiBlock): AppBlock {
        let difficulty: number = 0x1d00ffff /  block.bits;
        return {
            height: block.height,
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
            reward: block.reward / (10 ** 8)
        };
    }
    public getBlocks(): Observable<{ blocks: Array<AppBlock> }> {
        return this.http.get(this.api.apiPrefix + 'BTC/testnet/block')
            .map((data) => {
                let blocks: Array<ApiBlock> = data.json();
                let appBlocks: Array<AppBlock> = blocks.map(this.toAppBlock);
                return { blocks: appBlocks };
            });
    }

    public getBlock(hash: string): Observable<{ block: AppBlock }> {
        return this.http.get(this.api.apiPrefix + 'BTC/testnet/block/' + hash).
            map((data) => {
                let block: ApiBlock = data.json();
                let appBlock: AppBlock = this.toAppBlock(block);
                return { block: appBlock };
            });
    }
}
