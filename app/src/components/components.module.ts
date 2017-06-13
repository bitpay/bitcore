import { NgModule }                         from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule }                      from 'ionic-angular';
import { ClickerButton }                    from './clickerButton/clickerButton';
import { ClickerForm }                      from './clickerForm/clickerForm';

@NgModule({
  declarations: [
    ClickerForm,
    ClickerButton,
  ],
  imports: [
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
  ],
  exports: [
    ClickerButton,
    ClickerForm,
  ],
  entryComponents: [],
  providers: [ ],
})

export class ComponentsModule {}
