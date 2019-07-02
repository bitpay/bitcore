import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { AlertComponentModule } from '../alert/alert.module';
import { CoinComponentModule } from '../coin/coin.module';
import { LoaderComponentModule } from '../loader/loader.module';
import { CoinListComponent } from './coin-list';

@NgModule({
  declarations: [CoinListComponent],
  imports: [
    IonicModule,
    CoinComponentModule,
    LoaderComponentModule,
    AlertComponentModule
  ],
  exports: [CoinListComponent]
})
export class CoinListComponentModule {}
