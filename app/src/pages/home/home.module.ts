import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { HomePage } from './home';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';

@NgModule({
  declarations: [
    HomePage
  ],
  imports: [
    IonicPageModule.forChild(HomePage),
    HeadNavComponentModule
  ],
  exports: [
    HomePage
  ]
})
export class HomePageModule {}
