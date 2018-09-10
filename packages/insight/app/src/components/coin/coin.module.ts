import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { CoinComponent } from './coin';

@NgModule({
  declarations: [CoinComponent],
  imports: [IonicModule],
  exports: [CoinComponent]
})
export class CoinComponentModule {}
