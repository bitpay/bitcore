import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from 'ionic-angular';
import { SplitPipe } from '../pipes/split/split';

@NgModule({
  declarations: [SplitPipe],
  imports: [FormsModule, IonicModule, ReactiveFormsModule],
  exports: [],
  entryComponents: [],
  providers: []
})
export class ComponentsModule {}
