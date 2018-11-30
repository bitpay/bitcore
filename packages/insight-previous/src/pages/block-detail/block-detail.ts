import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';

@IonicPage({
  name: 'block-detail',
  segment: ':chain/:network/block/:blockHash'
})
@Component({
  selector: 'page-block-detail',
  templateUrl: 'block-detail.html'
})
export class BlockDetailPage {
  public loading = true;
  private blockHash: string;
  public block: any = {
    tx: []
  };

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private blockProvider: BlocksProvider,
    private apiProvider: ApiProvider,
    public currency: CurrencyProvider
  ) {
    this.blockHash = navParams.get('blockHash');
    const chain: string = navParams.get('chain');
    const network: string = navParams.get('network');
    this.apiProvider.changeNetwork({ chain, network });
  }

  public ionViewDidLoad(): void {
    this.blockProvider.getBlock(this.blockHash).subscribe(
      data => {
        this.block = data.block;
        this.loading = false;
      },
      err => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }

  public goToPreviousBlock(): void {
    this.navCtrl.push('block-detail', {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network,
      blockHash: this.block.previousblockhash
    });
  }

  public goToNextBlock(): void {
    this.navCtrl.push('block-detail', {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network,
      blockHash: this.block.nextblockhash
    });
  }
}
