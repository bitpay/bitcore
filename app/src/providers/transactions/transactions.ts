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
    address: string,
    chain: string,
    network: string,
    txid: string,
    blockHeight: number,
    blockHash: string,
    blockTime: Date,
    blockTimeNormalized: Date,
    coinbase: boolean,
    size: number,
    locktime: number,
    inputs: Array<ApiTx>,
    outputs: Array<ApiTx>,
    mintTxid: string,
    mintHeight: number,
    spentTxid: string,
    spentHeight: number,
    value: number,
    version: number
};

export type AppInput = {
    coinbase: string,
    sequence: number,
    n: number,
    txid: string,
    vout: number,
    scriptSig: {
        hex: string,
        asm: string,
        addresses: Array<string>,
        type: string

    },
    addr: string,
    valueSat: number,
    value: number,
    doubleSpentTxID: string,
    isConfirmed: boolean,
    confirmations: number,
    unconfirmedInput: string
};

export type AppOutput = {
    value: number,
    n: number,
    scriptPubKey: {
        hex: string,
        asm: string,
        addresses: Array<string>,
        type: string
    },
    spentTxId: null,
    spentIndex: null,
    spentHeight: null
};

export type AppTx = {
    txid: string,
    blockhash: string,
    version: number,
    locktime: number,
    isCoinBase: boolean,
    vin: Array<any>,
    vout: Array<any>,
    confirmations: number,
    time: number,
    valueOut: number,
    size: number,
    fees: number,
    blockheight: number,
    blocktime: number
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
            txid: tx.txid,
            fees: fee / (10 ** 8),
            blockheight: tx.blockHeight,
            confirmations: 0,
            blockhash: tx.blockHash,
            blocktime: new Date(tx.blockTime).getTime() / 1000,
            time: new Date(tx.blockTime).getTime() / 1000,
            isCoinBase: tx.coinbase,
            size: tx.size,
            locktime: tx.locktime,
            vin: [],
            vout: [],
            valueOut: tx.value,
            version: tx.version
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
