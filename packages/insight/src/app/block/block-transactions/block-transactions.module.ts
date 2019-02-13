import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { BlockTransactionsPage } from './block-transactions.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([
      {
        path: '',
        component: BlockTransactionsPage
      }
    ]),
    SharedModule
  ],
  declarations: [BlockTransactionsPage]
})
export class BlockTransactionsPageModule {}
