import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../shared/shared.module';
import { BlockListComponent } from './block-list/block-list.component';
import { BlocksPage } from './blocks.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([
      {
        path: '',
        component: BlocksPage
      }
    ]),
    SharedModule
  ],
  declarations: [BlocksPage, BlockListComponent]
})
export class BlocksPageModule {}
