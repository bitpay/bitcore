import { Component }       from '@angular/core';
import { NavController }   from 'ionic-angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  templateUrl: './broadcastTxPage.html'
})

export class BroadcastTxPage {

  public title: string;
  private nav: NavController;
  public transaction: string;
  public txForm: FormGroup;

  constructor(nav: NavController, public formBuilder: FormBuilder) {
    this.nav = nav;
    this.title = 'Broadcast Transaction';
    this.txForm = formBuilder.group({
      rawData: ['', Validators.pattern(/^[0-9A-Fa-f]+$/)]
    });
  }

  public send(): void {
    let postData: any = {
      rawtx: this.transaction
    };

    console.log('the postData is', postData);
  }
}
