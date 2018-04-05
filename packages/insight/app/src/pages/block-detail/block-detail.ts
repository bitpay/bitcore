import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { CurrencyProvider } from '../../providers/currency/currency';
import { BlocksProvider } from '../../providers/blocks/blocks';

/**
 * Generated class for the BlockDetailPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
    name: 'block-detail',
    segment: 'block/:blockHash'
})
@Component({
    selector: 'page-block-detail',
    templateUrl: 'block-detail.html'
})
export class BlockDetailPage {

    public loading: boolean = true;
    private blockHash: string;
    public block: any = {
        tx: []
    };

    constructor(public navCtrl: NavController, public navParams: NavParams,
                private blockProvider: BlocksProvider, public currency: CurrencyProvider) {
        this.blockHash = navParams.get('blockHash');
    }

    public ionViewDidLoad(): void {
        this.blockProvider.getBlock(this.blockHash).subscribe(
            (data) => {
                this.block = data.block;
                this.loading = false;
            },
            (err) => {
                console.log('err is', err);
                this.loading = false;
            }
        );
    }

    public goToPreviousBlock(): void {
        this.navCtrl.push('block-detail', {
            'blockHash': this.block.previousblockhash
        });
    }

    public goToNextBlock(): void {
        this.navCtrl.push('block-detail', {
            'blockHash': this.block.nextblockhash
        });
    }

}
