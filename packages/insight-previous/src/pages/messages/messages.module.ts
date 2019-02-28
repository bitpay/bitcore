import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { FooterComponentModule } from '../../components/footer/footer.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { MessagesPage } from './messages';

@NgModule({
  declarations: [MessagesPage],
  imports: [
    IonicPageModule.forChild(MessagesPage),
    FooterComponentModule,
    HeadNavComponentModule
  ],
  exports: [MessagesPage]
})
export class MessagesPageModule {}
