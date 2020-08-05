import { Component, Input, OnInit } from '@angular/core';
import { Events } from 'ionic-angular';
import * as _ from 'lodash';
import { AddressProvider } from '../../providers/address/address';
import { ChainNetwork } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import {
  ApiEthTx,
  AppEthCoin,
  TxsProvider
} from '../../providers/transactions/transactions';

@Component({
  selector: 'transaction-list',
  templateUrl: 'transaction-list.html'
})
export class TransactionListComponent implements OnInit {
  public loading = true;
  @Input()
  public queryType?: string;
  @Input()
  public queryValue?: string;
  @Input()
  public transactions?: any = [];
  @Input()
  public blocktime: any;
  @Input()
  public chainNetwork: ChainNetwork;
  public blockPageNum = 1;
  public limit = 10;
  public chunkSize = 100;

  constructor(
    private txProvider: TxsProvider,
    private addrProvider: AddressProvider,
    private blocksProvider: BlocksProvider,
    private events: Events
  ) {}

  public ngOnInit(): void {
    if (this.transactions && this.transactions.length === 0) {
      if (this.queryType === 'blockHash') {
        if (
          this.chainNetwork.chain === 'BTC' ||
          this.chainNetwork.chain === 'BCH'
        ) {
          this.fetchBlockTxCoinInfo(1);
        } else {
          this.txProvider
            .getTxs(this.chainNetwork, { blockHash: this.queryValue })
            .subscribe(txs => {
              _.forEach(txs, (tx: ApiEthTx) => {
                this.transactions.push(this.txProvider.toEthAppTx(tx));
              });
            });
          this.loading = false;
        }
      } else if (this.queryType === 'address') {
        const txs: any = [];

        if (
          this.chainNetwork.chain === 'BTC' ||
          this.chainNetwork.chain === 'BCH'
        ) {
          this.addrProvider
            .getAddressActivityCoins(this.queryValue, this.chainNetwork)
            .subscribe(
              (response: any) => {
                this.populateTxsForAddress(
                  response.mintedTxids,
                  response.fundingTxInputs,
                  response.fundingTxOutputs
                );
                this.populateTxsForAddress(
                  response.spentTxids,
                  response.spendingTxInputs,
                  response.spendingTxOutputs
                );
                this.events.publish('TransactionList', {
                  length: this.transactions.length
                });
                this.loading = false;
              },
              () => {
                this.loading = false;
              }
            );
        } else {
          this.addrProvider
            .getAddressActivity(this.queryValue, this.chainNetwork)
            .subscribe(transactions => {
              _.forEach(transactions, (tx: any) => {
                this.transactions.push(this.txProvider.toEthAppTx(tx));
              });
            });
          this.loading = false;
        }
      }
    } else {
      this.loading = false;
    }
  }

  public populateTxsForAddress(txids, inputs, outputs) {
    _.forEach(txids, (txid: any) => {
      const tx: any = {};
      tx.txid = txid;
      tx.vin = inputs.filter(input => input.spentTxid === txid);
      tx.vout = outputs.filter(output => output.mintTxid === txid);
      tx.blockheight = tx.vout[0].mintHeight;
      tx.fee = this.txProvider.getFee(tx);
      tx.valueOut = tx.vout
        .filter(output => output.mintTxid === txid)
        .reduce((a, b) => a + b.value, 0);
      tx.vin.length === 0 ? (tx.isCoinBase = true) : (tx.isCoinBase = false);
      this.transactions.push(tx);
    });
  }

  public populateTxsForBlock(txidCoins) {
    _.forEach(txidCoins.txids, (txid: any) => {
      const tx: any = {};
      tx.txid = txid;
      tx.vin = txidCoins.inputs.filter(input => input.spentTxid === txid);
      tx.vout = txidCoins.outputs.filter(output => output.mintTxid === txid);
      tx.fee = this.txProvider.getFee(tx);
      tx.blockheight = tx.vout[0].mintHeight;
      tx.blocktime = new Date(tx.blockTime).getTime() / 1000;
      tx.time = this.blocktime
        ? this.blocktime
        : new Date(tx.blockTime).getTime() / 1000;
      tx.valueOut = tx.vout
        .filter(output => output.mintTxid === txid)
        .reduce((a, b) => a + b.value, 0);
      tx.vin.length === 0 ? (tx.isCoinBase = true) : (tx.isCoinBase = false);

      this.transactions.push(tx);
    });
  }

  public fetchBlockTxCoinInfo(pageNum) {
    this.blocksProvider
      .getCoinsForBlockHash(this.queryValue, this.chainNetwork, 100, pageNum)
      .subscribe(txidCoins => {
        this.populateTxsForBlock(txidCoins);
        this.loading = false;
        if (txidCoins.next !== '') {
          this.blockPageNum = this.blockPageNum + 1;
        }
      });
  }

  public loadMore(infiniteScroll) {
    if (
      (this.queryType === 'blockHash' && this.chainNetwork.chain === 'BTC') ||
      this.chainNetwork.chain === 'BCH'
    ) {
      this.fetchBlockTxCoinInfo(this.blockPageNum);
      this.limit += this.chunkSize;
    } else {
      this.limit += this.chunkSize;
      this.chunkSize *= 2;
    }
    infiniteScroll.complete();
  }
}
