import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionDetailsEthComponentModule } from '../../components/transaction-details-eth/transaction-details-eth.module';
import { CoinComponentModule } from '../coin/coin.module';
import { LoaderComponentModule } from '../loader/loader.module';
import { CoinListComponent } from './coin-list';

@NgModule({
  declarations: [CoinListComponent],
  imports: [
    IonicModule,
    CoinComponentModule,
    TransactionDetailsEthComponentModule,
    LoaderComponentModule
  ],
  exports: [CoinListComponent]
})
export class CoinListComponentModule {}
