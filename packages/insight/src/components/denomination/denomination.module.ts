import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { DenominationComponent } from './denomination';

@NgModule({
  declarations: [DenominationComponent],
  imports: [IonicModule],
  exports: [DenominationComponent],
  entryComponents: [DenominationComponent]
})
export class DenominationComponentModule {}
