import { Component, Injectable, Input } from '@angular/core';
import { Nav } from 'ionic-angular';
import { ChainNetwork } from '../../providers/api/api';

@Injectable()
@Component({
  selector: 'footer',
  templateUrl: 'footer.html'
})
export class FooterComponent {
  @Input()
  public chainNetwork: ChainNetwork;

  constructor(public nav: Nav) {}

  public openPage(page: string): void {
    this.nav.push(page, {
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    });
  }
}
