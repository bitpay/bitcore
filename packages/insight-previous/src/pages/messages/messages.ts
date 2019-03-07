import { Component, Injectable } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { PriceProvider } from '../../providers/price/price';

import * as bitcoreLib from 'bitcore-lib';
import * as bitcoreLibCash from 'bitcore-lib-cash';

@Injectable()
@IonicPage({
  name: 'messages',
  segment: ':chain/:network/verify-message',
  defaultHistory: ['home']
})
@Component({
  selector: 'page-messages',
  templateUrl: 'messages.html'
})
export class MessagesPage {
  private chainNetwork: ChainNetwork;
  public messageForm: FormGroup;
  public error: string;
  public success: string;

  constructor(
    public formBuilder: FormBuilder,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private logger: Logger,
    private priceProvider: PriceProvider,
    private currencyProvider: CurrencyProvider
  ) {
    const chain: string =
      navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      navParams.get('network') || this.apiProvider.getConfig().network;

    this.chainNetwork = {
      chain,
      network
    };
    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency();
    this.priceProvider.setCurrency();

    this.messageForm = formBuilder.group({
      address: [
        '',
        Validators.compose([Validators.minLength(1), Validators.required])
      ],
      signature: [
        '',
        Validators.compose([Validators.minLength(1), Validators.required])
      ],
      message: [
        '',
        Validators.compose([Validators.minLength(1), Validators.required])
      ]
    });
  }

  public verify(): void {
    this.success = this.error = null;
    const values = this.messageForm.value;
    if (!this.isAddressValid(values.address)) {
      this.error = 'Invalid Address';
      return;
    }

    const bitcore =
      this.chainNetwork.chain === 'BTC' ? bitcoreLib : bitcoreLibCash;
    const message = new bitcore.Message(values.message);

    try {
      if (message.verify(values.address, values.signature)) {
        this.success = 'Message verified!';
      } else {
        this.error = message.error;
      }
    } catch (e) {
      this.error = e.message;
      this.logger.error(e.message);
    }
  }

  private isAddressValid(addr): boolean {
    const bitcore =
      this.chainNetwork.chain === 'BTC' ? bitcoreLib : bitcoreLibCash;
    return !!bitcore.Address.isValid(addr, this.chainNetwork.network)
      ? true
      : false;
  }
}
