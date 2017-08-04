import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Observable } from 'rxjs';
import { Block } from '../../models';
import { BlocksService } from '../../services';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';

@Component({
  templateUrl: './blocksPage.html'
})

export class BlocksPage {

  public loading: boolean;
  public title: string;
  public blocks: Observable<Block[]>;
  public q: string;
  public badQuery: boolean = false;

  constructor(private navCtrl: NavController, private http: Http, private blocksService: BlocksService, private api: ApiProvider) {
    this.title = 'Blocks';
    this.blocks = blocksService.latestBlocks;
    this.blocks.subscribe((blocks) => {
      console.log('blocks', blocks);
    });
    blocksService.getLatestBlocks();
  }

  public search(): void {
    let apiPrefix: string = this.api.apiPrefix;

    this.http.get(apiPrefix + 'block/' + this.q).subscribe(
      function (data: any) {
        this.resetSearch();
        console.log('block', data);
        let parsedData: any = JSON.parse(data._body);
        this.navCtrl.push('block-detail', {
          'blockHash': parsedData.hash
        });
      }.bind(this),
      () => {
        this.http.get(apiPrefix + 'tx/' + this.q).subscribe(
          function (data: any) {
            this.resetSearch();
            console.log('tx', data);
            let parsedData: any = JSON.parse(data._body);
            this.navCtrl.push('transaction', {
              'txId': parsedData.txid
            });
          }.bind(this),
          () => {
            this.http.get(apiPrefix + 'addr/' + this.q).subscribe(
              function (data: any) {
                this.resetSearch();
                console.log('addr', data);
                let parsedData: any = JSON.parse(data._body);
                this.navCtrl.push('address', {
                  'addrStr': parsedData.addrStr
                });
              }.bind(this),
              () => {
                this.http.get(apiPrefix + 'block-index/' + this.q).subscribe(
                  function (data: any): void {
                    this.resetSearch();
                    let parsedData: any = JSON.parse(data._body);
                    this.navCtrl.push('block-detail', {
                      'blockHash': parsedData.blockHash
                    });
                  }.bind(this),
                  function (): void {
                    this.loading = false;
                    this.reportBadQuery();
                  }.bind(this)
                );
              }
            );
          }
        );
      }
    );
  }

  private resetSearch(): void {
    this.q = '';
    this.loading = false;
  }

  /* tslint:disable:no-unused-variable */
  private reportBadQuery(): void {
    this.badQuery = true;
    console.log('badQuery', this.badQuery);

    setTimeout(
      function (): void {
        this.badQuery = false;
        console.log('badQuery', this.badQuery);
      }.bind(this),
      2000
    );
  };
  /* tslint:enable:no-unused-variable */

  public goToBlock(blockHash: string): void {
    this.navCtrl.push('block-detail', {
      'blockHash': blockHash
    });
  }

}
