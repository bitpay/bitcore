import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Observable } from 'rxjs';
import { Block } from '../../models';
import { BlocksService } from '../../services';
import { Http } from '@angular/http';

@Component({
  templateUrl: './blocksPage.html'
})

export class BlocksPage {

  public title: string;
  public blocks: Observable<Block[]>;
  public q: string;
  public badQuery: boolean = false;

  constructor(private nav: NavController, private http: Http, private blocksService: BlocksService) {
    this.nav = nav;
    this.title = 'Blocks';
    this.blocks = blocksService.latestBlocks;
    // this.blocks.subscribe((blocks) => {
    //   console.log(blocks);
    // });
    blocksService.getLatestBlocks();
  }

  public search(event) {
    console.log('q is', this.q);
    let apiPrefix = 'http://insight.bitpay.com/api/';
    this.http.get(apiPrefix + 'block/' + this.q).subscribe(
      (data) => {
        this.resetSearch();
        console.log('block', data);
        //this.router.navigate(['./block/' + q]);
      },
      () => {
        this.http.get(apiPrefix + 'tx/' + this.q).subscribe(
          (data) => {
            this.resetSearch();
            console.log('tx', data);
            //this.router.navigate(['./tx/' + q]);
          },
          function (err) { this.reportBadQuery() }.bind(this)
        );
      }
    );

    /*
    Block.get({
      blockHash: q
    }, function() {
      _resetSearch();
      $location.path('block/' + q);
    }, function() { //block not found, search on TX
      Transaction.get({
        txId: q
      }, function() {
        _resetSearch();
        $location.path('tx/' + q);
      }, function() { //tx not found, search on Address
        Address.get({
          addrStr: q
        }, function() {
          _resetSearch();
          $location.path('address/' + q);
        }, function() { // block by height not found
          if (isFinite(q)) { // ensure that q is a finite number. A logical height value.
            BlockByHeight.get({
              blockHeight: q
            }, function(hash) {
              _resetSearch();
              $location.path('/block/' + hash.blockHash);
            }, function() { //not found, fail :(
              $scope.loading = false;
              _badQuery();
            });
          }
          else {
            $scope.loading = false;
            _badQuery();
          }
        });
      });
    });
     */
  }

  resetSearch = function() {
    this.q = '';
    this.loading = false;
  };

  reportBadQuery() {
    this.badQuery = true;
    console.log('badQuery', this.badQuery);

    setTimeout(function() {
      this.badQuery = false;
      console.log('badQuery', this.badQuery);
    }.bind(this), 2000);
  };
}
