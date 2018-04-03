import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { ApiProvider } from '../../providers/api/api';
import { Observable } from 'rxjs/Observable';

/*
  Generated class for the TxsProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/

export type ApiTx = {
    address: string;
    chain: string;
    network: string;
    txid: string;
    blockHeight: number;
    blockHash: number;
    blockTime: Date;
    blockTimeNormalized: Date;
    coinbase: boolean;
    size: number;
    locktime: number;
    inputs: Array<ApiTx>;
    outputs: Array<ApiTx>;
    mintTxid: string;
    mintHeight: number;
    spentTxid: string;
    spentHeight: number;
    value: number;
};

export type AppTx = {
    address: string;
    chain: string;
    network: string;
    txid: string;
    blockHeight: number;
    blockhash: number;
    blockTime: Date;
    blockTimeNormalized: Date;
    coinbase: boolean;
    size: number;
    locktime: number;
    inputs: Array<ApiTx>;
    outputs: Array<ApiTx>;
    mintTxid: string;
    mintHeight: number;
    spentTxid: string;
    spentHeight: number;
    value: number;
    fees: number;
};

@Injectable()
export class TxsProvider {

    constructor(public http: Http, private api: ApiProvider) {
    }

    private toAppTx(tx: ApiTx): AppTx {
        let sumSatoshis: (arr: any) => number = (arr) => arr.reduce((prev, cur) => prev + cur.value, 0);
        let inputs: number = sumSatoshis(tx.inputs);
        let outputs: number = sumSatoshis(tx.outputs);
        let fee: number = tx.coinbase ? 0 : (inputs - outputs);
        console.log(inputs, outputs, tx.outputs);

        return {
            address: tx.address,
            chain: tx.chain,
            network: tx.network,
            txid: tx.txid,
            fees: fee / (10 ** 8),
            blockHeight: tx.blockHeight,
            blockhash: tx.blockHash,
            blockTime: tx.blockTime,
            blockTimeNormalized: tx.blockTimeNormalized,
            coinbase: tx.coinbase,
            size: tx.size,
            locktime: tx.locktime,
            inputs: tx.inputs,
            outputs: tx.outputs,
            mintTxid: tx.mintTxid,
            mintHeight: tx.mintHeight,
            spentTxid: tx.spentTxid,
            spentHeight: tx.spentHeight,
            value: tx.value
        };
    }

    public getTxs(args?: { blockHash?: string }): Observable<{ txs: Array<AppTx> }> {
        let queryString: string = '';
        if (args.blockHash) {
            queryString += `?blockHash=${args.blockHash}`;
        }
        return this.http.get(this.api.apiPrefix + 'BTC/testnet/tx' + queryString)
            .map((data) => {
                let txs: Array<ApiTx> = data.json();
                let appTxs: Array<AppTx> = txs.map(this.toAppTx);
                return { txs: appTxs };
            });
    }

    public getTx(hash: string): Observable<{ tx: AppTx }> {
        return this.http.get(this.api.apiPrefix + 'BTC/testnet/tx/' + hash)
            .map((data) => {
                let apiTx: ApiTx = data.json()[0];
                let appTx: AppTx = this.toAppTx(apiTx);
                return { tx: appTx };
            });
    }
}
