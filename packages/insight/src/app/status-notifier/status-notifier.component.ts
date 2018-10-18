import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ApiService } from '../services/api/api.service';
import { NetworkService } from '../services/network/network.service';

@Component({
  selector: 'app-status-notifier',
  templateUrl: './status-notifier.component.html',
  styleUrls: ['./status-notifier.component.scss']
})
export class StatusNotifierComponent {
  private statusToast?: HTMLIonToastElement;
  constructor(
    private apiService: ApiService,
    private networkService: NetworkService,
    private toastController: ToastController
  ) {
    // FIXME: implement a custom status notifier UI to allow for localization
    // and further customization
    this.networkService.isOnline.subscribe(async isOnline => {
      if (!isOnline) {
        this.statusToast = await this.toastController.create({
          message: `Internet connection lost. Please check your network settings.`,
          position: 'bottom'
        });
        this.statusToast.present();
        return;
      }
      if (this.statusToast) {
        this.statusToast.dismiss();
      }
    });
    // TODO: display errors from this.apiService.bitcoreAvailable
    // TODO: display errors from ratesApi failures
  }
}
