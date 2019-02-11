import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../shared/shared.module';
import { TransactionsPage } from './transactions.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([
      {
        path: '',
        component: TransactionsPage
      }
    ]),
    SharedModule
  ],
  declarations: [TransactionsPage]
})
export class TransactionsPageModule {}
