import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { CoinComponentModule } from '../coin/coin.module';
import { CoinListComponent } from './coin-list';

@NgModule({
  declarations: [CoinListComponent],
  imports: [IonicModule, CoinComponentModule],
  exports: [CoinListComponent]
})
export class CoinListComponentModule {}
