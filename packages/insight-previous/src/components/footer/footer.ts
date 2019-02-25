import { Component, Injectable, Input } from '@angular/core';
import {
  ActionSheetController,
  App,
  PopoverController,
  ToastController
} from 'ionic-angular';
import * as _ from 'lodash';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { PriceProvider } from '../../providers/price/price';
import { RedirProvider } from '../../providers/redir/redir';
import { SearchProvider } from '../../providers/search/search';

@Injectable()
@Component({
  selector: 'footer',
  templateUrl: 'footer.html'
})
export class FooterComponent {
  public showSearch = false;
  public loading: boolean;
  @Input()
  public title: string;
  public q: string;
  public config: ChainNetwork;
  public redirTo: any;
  public params: any;

  constructor(
    private apiProvider: ApiProvider,
    public app: App,
    public currency: CurrencyProvider,
    public price: PriceProvider,
    public actionSheetCtrl: ActionSheetController,
    public popoverCtrl: PopoverController,
    public toastCtrl: ToastController,
    public searchProvider: SearchProvider,
    public redirProvider: RedirProvider
  ) {
    this.config = this.apiProvider.getConfig();
  }
}
