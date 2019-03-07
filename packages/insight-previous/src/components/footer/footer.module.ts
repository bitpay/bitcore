import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { DenominationComponentModule } from '../denomination/denomination.module';
import { FooterComponent } from './footer';

@NgModule({
  declarations: [FooterComponent],
  imports: [IonicModule, DenominationComponentModule],
  exports: [FooterComponent]
})
export class FooterComponentModule {}
