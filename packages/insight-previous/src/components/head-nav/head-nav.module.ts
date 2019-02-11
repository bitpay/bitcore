import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { DenominationComponentModule } from '../denomination/denomination.module';
import { HeadNavComponent } from './head-nav';

@NgModule({
  declarations: [HeadNavComponent],
  imports: [IonicModule, DenominationComponentModule],
  exports: [HeadNavComponent]
})
export class HeadNavComponentModule {}
