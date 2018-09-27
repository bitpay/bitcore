import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { CoinListComponent } from './coin-list';
import { CoinComponentModule } from '../coin/coin.module';

@NgModule({
  declarations: [CoinListComponent],
  imports: [IonicModule, CoinComponentModule],
  exports: [CoinListComponent]
})
export class CoinListComponentModule {}
