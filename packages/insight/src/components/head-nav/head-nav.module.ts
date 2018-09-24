import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { HeadNavComponent } from './head-nav';
import { DenominationComponentModule } from '../denomination/denomination.module';

@NgModule({
  declarations: [
    HeadNavComponent
  ],
  imports: [
    IonicModule,
    DenominationComponentModule
  ],
  exports: [
    HeadNavComponent
  ]
})
export class HeadNavComponentModule {}
