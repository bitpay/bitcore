import {
  Component,
  EventEmitter,
  Injectable,
  Input,
  Output
} from '@angular/core';
import * as bitcoreLib from 'bitcore-lib';
import * as bitcoreLibCash from 'bitcore-lib-cash';
import {
  ActionSheetController,
  App,
  NavController,
  PopoverController,
  ToastController
} from 'ionic-angular';
import * as _ from 'lodash';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { PriceProvider } from '../../providers/price/price';
import { RedirProvider } from '../../providers/redir/redir';
import { SearchProvider } from '../../providers/search/search';
import { DenominationComponent } from '../denomination/denomination';

@Injectable()
@Component({
  selector: 'footer',
  templateUrl: 'footer.html'
})
export class FooterComponent {
  @Output()
  public updateView = new EventEmitter<ChainNetwork>();
  public showSearch = false;
  public loading: boolean;
  @Input()
  public title: string;
  public q: string;
  public config: ChainNetwork;
  public redirTo: any;
  public params: any;

  constructor(
    private navCtrl: NavController,
    private apiProvider: ApiProvider,
    public app: App,
    public currency: CurrencyProvider,
    public price: PriceProvider,
    public actionSheetCtrl: ActionSheetController,
    public popoverCtrl: PopoverController,
    public toastCtrl: ToastController,
    private logger: Logger,
    public searchProvider: SearchProvider,
    public redirProvider: RedirProvider
  ) {
    this.config = this.apiProvider.getConfig();
  }

}
