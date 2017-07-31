import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AddressPage } from './address';

@NgModule({
  declarations: [
    AddressPage
  ],
  imports: [
    IonicPageModule.forChild(AddressPage)
  ],
  exports: [
    AddressPage
  ]
})
export class AddressPageModule {}
